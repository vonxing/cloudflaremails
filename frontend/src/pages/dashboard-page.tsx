import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  Download,
  Eraser,
  Copy,
  Inbox,
  Mail,
  MenuIcon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Menu,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  clearInboxEmails,
  deleteInboxEmail,
  deleteSentEmail,
  fetchInbox,
  fetchInboxDetail,
  fetchSent,
  fetchSentDetail,
  getInboxEmailDownloadUrl,
  sendEmail,
} from "@/lib/api"
import { useAppState } from "@/lib/app-state"
import { type MailMessage } from "@/lib/mock-mail"

function panelClassName() {
  return "workspace-panel rounded-2xl border border-border text-card-foreground shadow-[0_8px_30px_color-mix(in_oklab,var(--color-foreground)_6%,transparent)]"
}

function getMailIdentity(message: MailMessage, tab: "inbox" | "sent") {
  return tab === "inbox" ? message.sender : (message.recipients ?? message.sender)
}

function getDomainLogoUrl(identity?: string) {
  const domain = identity?.split("@")[1]?.trim().toLowerCase()
  if (!domain) {
    return null
  }
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`
}

function getIdentityInitials(identity?: string) {
  const localPart = identity?.split("@")[0]?.trim() || identity?.trim() || "mail"
  const normalized = Array.from(localPart.replace(/[\s._-]+/g, "")).slice(0, 2).join("")
  return normalized ? normalized.toUpperCase() : "ML"
}

function MailIdentityAvatar({
  identity,
  active,
  preferInitials = false,
}: {
  identity?: string
  active?: boolean
  preferInitials?: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const logoUrl = getDomainLogoUrl(identity)
  const initials = getIdentityInitials(identity)

  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? "border-primary/25 bg-primary/12 text-primary"
          : "border-border bg-secondary text-secondary-foreground"
      }`}
    >
      {!preferInitials && logoUrl && !imageFailed ? (
        <img
          src={logoUrl}
          alt={identity ?? "mail identity"}
          className="size-5 rounded-full"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-xs font-semibold tracking-[0.16em]">
          {initials}
        </span>
      )}
    </div>
  )
}

type ConfirmState = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmVariant: "default" | "destructive"
  action: null | (() => Promise<void> | void)
}

type ConfirmActionConfig = {
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: "default" | "destructive"
  action: () => Promise<void> | void
}

type CollapsedPreviewState = {
  visible: boolean
  top: number
  left: number
  identity: string
  subject: string
  preview: string
}

export function DashboardPage() {
  const queryClient = useQueryClient()
  const {
    quota,
    quotaLoading,
    domains,
    domainsLoading,
    mailboxes,
    mailboxesLoading,
    currentMailbox,
    selectedDomain,
    mailboxLength,
    forwardAddress,
    search,
    setSearch,
    setSelectedDomain,
    setMailboxLength,
    setComposeForwardAddress,
    selectMailbox,
    generateMailbox,
    createMailbox,
    toggleFavorite,
    saveForward,
    copyMailbox,
  } = useAppState()
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox")
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [mailboxDialogOpen, setMailboxDialogOpen] = useState(false)
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [desktopListCollapsed, setDesktopListCollapsed] = useState(false)
  const [detailView, setDetailView] = useState<"text" | "html">("text")
  const [composeTo, setComposeTo] = useState("")
  const [composeSubject, setComposeSubject] = useState("")
  const [composeBody, setComposeBody] = useState("")
  const [customLocalPart, setCustomLocalPart] = useState("")
  const [mailboxAction, setMailboxAction] = useState<
    null | "generate" | "create" | "copy" | "favorite" | "forward"
  >(null)
  const [collapsedPreview, setCollapsedPreview] = useState<CollapsedPreviewState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "确认",
    confirmVariant: "default",
    action: null,
  })

  const inboxQuery = useQuery<MailMessage[]>({
    queryKey: ["inbox", currentMailbox],
    queryFn: () => fetchInbox(currentMailbox),
    enabled: currentMailbox.length > 0,
  })
  const sentQuery = useQuery<MailMessage[]>({
    queryKey: ["sent", currentMailbox],
    queryFn: () => fetchSent(currentMailbox),
    enabled: currentMailbox.length > 0,
  })
  const selectedInboxDetailQuery = useQuery({
    queryKey: ["email-detail", selectedEmailId, currentMailbox],
    queryFn: () => fetchInboxDetail(selectedEmailId as number, currentMailbox),
    enabled: activeTab === "inbox" && selectedEmailId !== null && currentMailbox.length > 0,
  })
  const selectedSentDetailQuery = useQuery({
    queryKey: ["sent-detail", selectedEmailId, currentMailbox],
    queryFn: () => fetchSentDetail(selectedEmailId as number, currentMailbox),
    enabled: activeTab === "sent" && selectedEmailId !== null && currentMailbox.length > 0,
  })

  const visibleMessages = useMemo(() => {
    const source = activeTab === "inbox" ? inboxQuery.data ?? [] : sentQuery.data ?? []
    const keyword = search.trim().toLowerCase()
    if (!keyword) {
      return source
    }

    return source.filter((message) =>
      [message.subject, message.sender, message.preview, message.recipients]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword)),
    )
  }, [activeTab, inboxQuery.data, search, sentQuery.data])

  const selectedEmail =
    visibleMessages.find((message) => message.id === selectedEmailId) ??
    visibleMessages[0] ??
    null
  const selectedEmailDetail =
    (activeTab === "inbox"
      ? selectedInboxDetailQuery.data
      : selectedSentDetailQuery.data) ?? selectedEmail
  const canShowHtml = Boolean(selectedEmailDetail?.htmlContent?.trim())

  const currentMailboxRecord =
    mailboxes.find((mailbox) => mailbox.address === currentMailbox) ?? null
  const isMailboxActionBusy = mailboxAction !== null

  const openConfirmDialog = ({
    title,
    description,
    confirmLabel,
    confirmVariant = "default",
    action,
  }: ConfirmActionConfig) => {
    setConfirmState({
      open: true,
      title,
      description,
      confirmLabel,
      confirmVariant,
      action,
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmState.action) {
      return
    }

    try {
      setConfirmBusy(true)
      await confirmState.action()
      setConfirmState((current) => ({
        ...current,
        open: false,
        action: null,
      }))
    } finally {
      setConfirmBusy(false)
    }
  }

  const collapsedRail = (
    <div className="flex h-full min-h-0 flex-col items-center py-3">
      <div className="grid gap-2 px-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTab === "inbox" ? "default" : "outline"}
              size="icon"
              className="rounded-xl"
              onClick={() => setActiveTab("inbox")}
            >
              <Inbox className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            收件箱
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTab === "sent" ? "default" : "outline"}
              size="icon"
              className="rounded-xl"
              onClick={() => setActiveTab("sent")}
            >
              <Send className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            发件箱
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => setMailboxDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            邮箱设置
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-3 h-px w-9 bg-border" />

      <div
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-visible px-2 py-3"
        onMouseLeave={() =>
          setCollapsedPreview((current) =>
            current
              ? {
                  ...current,
                  visible: false,
                }
              : null,
          )
        }
      >
        <div className="grid gap-2">
          {visibleMessages.map((message) => {
            const active = selectedEmail?.id === message.id
            const identity = getMailIdentity(message, activeTab)
            return (
              <div key={message.id} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedEmailId(message.id)}
                  onMouseEnter={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    setCollapsedPreview({
                      visible: true,
                      top: rect.top + rect.height / 2,
                      left: Math.min(rect.right + 12, window.innerWidth - 304),
                      identity,
                      subject: message.subject,
                      preview: message.preview || message.content || "暂无邮件摘要",
                    })
                  }}
                  className={`flex size-12 items-center justify-center rounded-full p-0 transition-all duration-200 ease-out ${
                    active
                      ? "rounded-full bg-accent shadow-sm ring-1 ring-border"
                      : "hover:bg-muted"
                  }`}
                >
                  <MailIdentityAvatar identity={identity} active={active} preferInitials />
                </button>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )

  const handleCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) {
      return
    }

    try {
      await sendEmail({
        from: currentMailbox,
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        text: composeBody.trim(),
      })
      setComposeOpen(false)
      setComposeTo("")
      setComposeSubject("")
      setComposeBody("")
      await queryClient.invalidateQueries({ queryKey: ["sent", currentMailbox] })
      setActiveTab("sent")
    } catch {
      // keep dialog open if sending fails
    }
  }

  const handleOpenCompose = () => {
    setComposeOpen(true)
  }

  const handleCopyMailbox = async () => {
    try {
      setMailboxAction("copy")
      await copyMailbox()
      if (currentMailbox) {
        toast.success("邮箱地址已复制")
      } else {
        toast.error("请先选择邮箱")
      }
    } catch {
      toast.error("复制失败，请重试")
    } finally {
      setMailboxAction(null)
    }
  }

  const handleToggleFavorite = async () => {
    if (!currentMailboxRecord) {
      toast.error("请先选择邮箱")
      return
    }

    try {
      setMailboxAction("favorite")
      await toggleFavorite()
      toast.success(currentMailboxRecord.isFavorite ? "已取消喜欢" : "已加入喜欢")
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setMailboxAction(null)
    }
  }

  const handleSaveForward = async () => {
    if (!currentMailboxRecord) {
      toast.error("请先选择邮箱")
      return
    }

    try {
      setMailboxAction("forward")
      await saveForward()
      toast.success(forwardAddress.trim() ? "转发设置已保存" : "已清除转发地址")
    } catch {
      toast.error("保存失败，请重试")
    } finally {
      setMailboxAction(null)
    }
  }

  const handleDeleteCurrentMessage = async () => {
    if (!selectedEmailDetail?.id) {
      toast.error("请先选择邮件")
      return
    }

    openConfirmDialog({
      title: activeTab === "inbox" ? "删除当前邮件" : "删除发送记录",
      description:
        activeTab === "inbox"
          ? "确认后会删除这封收件邮件。"
          : "确认后会删除这条发件记录。",
      confirmLabel: "确认删除",
      confirmVariant: "destructive",
      action: async () => {
        try {
          if (activeTab === "inbox") {
            await deleteInboxEmail(selectedEmailDetail.id)
          } else {
            await deleteSentEmail(selectedEmailDetail.id)
          }

          setSelectedEmailId(null)
          await queryClient.invalidateQueries({ queryKey: [activeTab, currentMailbox] })
          toast.success(activeTab === "inbox" ? "邮件已删除" : "发送记录已删除")
        } catch {
          toast.error("删除失败，请重试")
        }
      },
    })
  }

  const handleClearInbox = async () => {
    if (!currentMailbox) {
      toast.error("请先选择邮箱")
      return
    }

    openConfirmDialog({
      title: "清空当前收件箱",
      description: "确认后会删除当前邮箱中的所有收件邮件。",
      confirmLabel: "确认清空",
      confirmVariant: "destructive",
      action: async () => {
        try {
          await clearInboxEmails(currentMailbox)
          setSelectedEmailId(null)
          await queryClient.invalidateQueries({ queryKey: ["inbox", currentMailbox] })
          toast.success("收件箱已清空")
        } catch {
          toast.error("清空失败，请重试")
        }
      },
    })
  }

  const handleDownloadCurrent = () => {
    if (activeTab !== "inbox" || !selectedEmailDetail?.id) {
      toast.error("当前邮件不支持下载")
      return
    }

    window.open(
      selectedEmailDetail.downloadUrl ?? getInboxEmailDownloadUrl(selectedEmailDetail.id),
      "_blank",
      "noopener,noreferrer",
    )
    toast.success("已开始下载原始邮件")
  }

  const handleCopyVerificationCode = async () => {
    if (!selectedEmailDetail?.verificationCode) {
      toast.error("当前邮件没有验证码")
      return
    }

    try {
      await navigator.clipboard.writeText(selectedEmailDetail.verificationCode)
      toast.success(`验证码 ${selectedEmailDetail.verificationCode} 已复制`)
    } catch {
      toast.error("复制失败，请重试")
    }
  }

  const handleCreateCustomMailbox = async () => {
    if (!customLocalPart.trim()) {
      toast.error("请输入自定义邮箱名前缀")
      return
    }

    try {
      setMailboxAction("create")
      await createMailbox(customLocalPart)
      setCustomLocalPart("")
      toast.success("自定义邮箱已创建")
    } catch {
      toast.error("创建失败，请检查格式或权限")
    } finally {
      setMailboxAction(null)
    }
  }

  const handleRefreshCurrentMailbox = async () => {
    if (!currentMailbox) {
      toast.error("请先选择邮箱")
      return
    }

    try {
      await queryClient.invalidateQueries({ queryKey: [activeTab, currentMailbox] })
      if (selectedEmailId !== null) {
        await queryClient.invalidateQueries({
          queryKey: [activeTab === "inbox" ? "email-detail" : "sent-detail", selectedEmailId, currentMailbox],
        })
      }
      toast.success(activeTab === "inbox" ? "收件箱已刷新" : "发件箱已刷新")
    } catch {
      toast.error("刷新失败，请重试")
    }
  }

  const listPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-border p-3">
        <div className="grid gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Select value={currentMailbox || undefined} onValueChange={selectMailbox}>
              <SelectTrigger className="h-10 w-full min-w-0 rounded-xl">
                <SelectValue
                  placeholder={
                    mailboxesLoading
                      ? "邮箱加载中..."
                      : activeTab === "inbox"
                        ? "选择邮箱"
                        : "选择发件邮箱"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {mailboxes.map((mailbox) => (
                  <SelectItem key={mailbox.id} value={mailbox.address}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">{mailbox.address}</span>
                      {mailbox.isFavorite ? (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      ) : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl"
                    onClick={handleCopyMailbox}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  复制当前邮箱地址
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => void handleRefreshCurrentMailbox()}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  刷新当前{activeTab === "inbox" ? "收件箱" : "发件箱"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setMailboxDialogOpen(true)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  打开邮箱设置
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        <Tabs
          className="mt-3"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "inbox" | "sent")}
        >
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-secondary">
            <TabsTrigger value="inbox" className="rounded-lg">
              收件箱
            </TabsTrigger>
            <TabsTrigger value="sent" className="rounded-lg">
              发件箱
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "inbox" && !currentMailbox ? (
          <div className="mt-3 rounded-xl border border-border bg-muted">
            <div className="px-3 py-2.5 text-sm text-muted-foreground">
              请先选择一个邮箱以查看收件内容。
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-1 p-2">
          {visibleMessages.map((message) => {
            const active = selectedEmail?.id === message.id
            return (
              <button
                key={message.id}
                type="button"
                onClick={() => {
                  setSelectedEmailId(message.id)
                  setMobileListOpen(false)
                }}
                className={`block w-full max-w-full min-w-0 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-border bg-accent shadow-sm"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                }`}
              >
                <div className="flex w-full min-w-0 max-w-full items-start justify-between gap-3 overflow-hidden">
                  <div className="min-w-0 max-w-full flex-1 overflow-hidden">
                    <div className="block w-full max-w-full truncate text-sm font-medium text-foreground">
                      {activeTab === "inbox"
                        ? message.sender
                        : message.recipients ?? message.sender}
                    </div>
                    <div className="mt-1 block w-full max-w-full truncate text-sm font-medium text-foreground">
                      {message.subject}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {message.receivedAt.slice(11)}
                  </div>
                </div>
                <div className="mt-2 block w-full max-w-full truncate text-sm text-muted-foreground">
                  {message.preview}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">
            {quota
              ? `${quota.used}/${quota.limit} 个邮箱已启用`
              : quotaLoading
                ? "邮箱配额加载中..."
                : "暂无配额信息"}
          </span>
          <span className="shrink-0">{visibleMessages.length} 封</span>
        </div>
      </div>
    </div>
  )

  return (
    <AppShell
      currentRoute="/app"
      headerLeading={
        <>
          <Button
            variant="outline"
            size="icon"
            className="hidden rounded-xl md:inline-flex"
            onClick={() => setDesktopListCollapsed((value) => !value)}
          >
            <MenuIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl md:hidden"
            onClick={() => setMobileListOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </>
      }
      headerContent={
        <div className="relative w-full md:max-w-[560px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索邮件"
            className="workspace-search h-10 rounded-2xl border-border pl-9"
          />
        </div>
      }
    >
      {collapsedPreview && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`pointer-events-none fixed z-[90] w-72 -translate-y-1/2 rounded-2xl border border-border bg-popover/96 p-3 text-popover-foreground shadow-[0_18px_40px_color-mix(in_oklab,var(--color-foreground)_14%,transparent)] backdrop-blur-xl transition-[top,left,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,left,opacity,transform] ${
                collapsedPreview.visible
                  ? "translate-x-0 opacity-100"
                  : "translate-x-2 opacity-0"
              }`}
              style={{
                top: `${collapsedPreview.top}px`,
                left: `${collapsedPreview.left}px`,
              }}
            >
              <div className="space-y-1.5">
                <p className="truncate text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {activeTab === "inbox" ? "发件人：" : "收件人："}
                  </span>
                  <span className="text-foreground">{collapsedPreview.identity}</span>
                </p>
                <p className="truncate text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">主题：</span>
                  <span className="text-foreground">{collapsedPreview.subject}</span>
                </p>
                <p className="truncate text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">正文：</span>
                  <span className="text-foreground">{collapsedPreview.preview}</span>
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
      {composeOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[85]">
              <div
                role="dialog"
                aria-modal="false"
                aria-labelledby="compose-panel-title"
            className="workspace-panel pointer-events-auto absolute inset-x-3 bottom-3 flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-border text-card-foreground shadow-[0_24px_80px_color-mix(in_oklab,var(--color-foreground)_16%,transparent)] animate-in fade-in-0 slide-in-from-bottom-6 duration-300 md:inset-x-auto md:bottom-24 md:right-6 md:w-[min(34rem,calc(100vw-3rem))] md:rounded-2xl md:slide-in-from-bottom-5 md:slide-in-from-right-5"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <div id="compose-panel-title" className="truncate text-sm font-semibold text-foreground">
                      新建邮件
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      发件箱撰写面板
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-muted-foreground"
                      onClick={() => setComposeOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 border-b border-border px-4 py-4">
                  <div className="grid gap-1.5">
                    <div className="text-xs font-medium text-muted-foreground">收件人</div>
                    <Input
                      value={composeTo}
                      onChange={(event) => setComposeTo(event.target.value)}
                      placeholder="输入收件人邮箱"
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <div className="text-xs font-medium text-muted-foreground">标题</div>
                    <Input
                      value={composeSubject}
                      onChange={(event) => setComposeSubject(event.target.value)}
                      placeholder="输入邮件标题"
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 px-4 py-4">
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">正文</div>
                  <Textarea
                    value={composeBody}
                    onChange={(event) => setComposeBody(event.target.value)}
                    placeholder="输入邮件正文..."
                    className="h-full min-h-[220px] resize-none rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <div className="truncate text-xs text-muted-foreground">
                    From: {currentMailbox || "未选择邮箱"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setComposeOpen(false)}
                    >
                      关闭
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={handleCompose}
                    >
                      <Send className="h-4 w-4" />
                      立即发送
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className={`workspace-panel-soft relative z-20 hidden min-h-0 min-w-0 shrink-0 border-r border-border transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
              desktopListCollapsed ? "w-[76px]" : "w-[300px]"
            } ${
              desktopListCollapsed ? "overflow-visible" : "overflow-hidden"
            }`}
          >
            {desktopListCollapsed ? (
              collapsedRail
            ) : (
              <div className="flex h-full min-h-0 min-w-0 flex-col animate-in fade-in-0 slide-in-from-left-2 duration-300">
                {listPane}
              </div>
            )}
          </div>

          <div className="relative z-0 min-w-0 flex-1 overflow-hidden p-3">
            <div className={`${panelClassName()} flex h-full min-h-0 flex-col p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                      <Mail className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {activeTab === "inbox"
                          ? selectedEmailDetail?.sender ?? "暂无发件人"
                          : (selectedEmailDetail?.recipients ?? currentMailbox) || "暂无邮箱"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {activeTab === "inbox"
                          ? `To: ${currentMailbox || "--"}`
                          : `From: ${currentMailbox || "--"}`}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeTab === "inbox" ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl"
                      onClick={handleDownloadCurrent}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl text-destructive hover:text-destructive"
                    onClick={handleDeleteCurrentMessage}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-b border-border pb-3">
                <div className=" font-medium tracking-[0.18em] text-muted-foreground">
                  标题：<span className="tracking-[-0.04em] text-foreground">
                  {selectedEmailDetail?.subject ?? "请选择一封邮件"} </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {canShowHtml ? (
                    <Tabs
                      value={detailView}
                      onValueChange={(value) => setDetailView(value as "text" | "html")}
                    >
                      <TabsList className="rounded-xl bg-secondary">
                        <TabsTrigger value="text" className="rounded-lg">
                          文本
                        </TabsTrigger>
                        <TabsTrigger value="html" className="rounded-lg">
                          HTML
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  ) : null}
                  {selectedEmailDetail?.verificationCode ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={handleCopyVerificationCode}
                    >
                      <Copy className="h-4 w-4" />
                      复制验证码
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col py-5">
                <div className="min-h-0 flex-1">
                  {detailView === "html" && canShowHtml ? (
                    <div className="workspace-panel h-full overflow-hidden rounded-xl border border-border">
                      <iframe
                        title={selectedEmailDetail?.subject ?? "email-preview"}
                        srcDoc={selectedEmailDetail?.htmlContent ?? ""}
                        className="h-full min-h-0 w-full bg-white"
                      />
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="min-h-full whitespace-pre-line leading-7 text-foreground/80">
                        {selectedEmailDetail?.content ?? "当前没有可阅读的邮件内容。"}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      {activeTab === "inbox" ? "收件箱" : "发件箱"}
                    </Badge>
                  {selectedEmailDetail?.verificationCode ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground transition hover:bg-accent/80"
                        onClick={handleCopyVerificationCode}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Verification Code {selectedEmailDetail.verificationCode}
                      </button>
                    ) : null}
                    {currentMailboxRecord?.isFavorite ? (
                      <Badge className="rounded-full bg-secondary text-secondary-foreground">
                        收藏邮箱
                      </Badge>
                    ) : null}
                  </div>
                  {activeTab === "sent" ? (
                    <Button
                      className="rounded-xl"
                      onClick={handleOpenCompose}
                    >
                      <Plus className="h-4 w-4" />
                      新建邮件
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={handleClearInbox}
                    >
                      <Eraser className="h-4 w-4" />
                      清空收件
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={mailboxDialogOpen} onOpenChange={setMailboxDialogOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>邮箱管理</DialogTitle>
            <DialogDescription>这里集中处理切换、生成、转发和收藏。</DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 gap-3 overflow-y-auto pr-1">
            <Select value={currentMailbox || undefined} onValueChange={selectMailbox}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder={mailboxesLoading ? "邮箱加载中..." : "选择邮箱"} />
              </SelectTrigger>
              <SelectContent>
                {mailboxes.map((mailbox) => (
                  <SelectItem key={mailbox.id} value={mailbox.address}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">{mailbox.address}</span>
                      {mailbox.isFavorite ? (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      ) : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder={domainsLoading ? "域名加载中..." : "选择域名"} />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-xl bg-muted px-3 py-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>名称长度</span>
                <span>{mailboxLength[0]}</span>
              </div>
              <Slider
                className="mt-4"
                value={mailboxLength}
                min={8}
                max={16}
                step={1}
                onValueChange={setMailboxLength}
              />
            </div>
            <Input
              value={customLocalPart}
              onChange={(event) => setCustomLocalPart(event.target.value)}
              placeholder="输入自定义邮箱前缀"
              className="h-10 rounded-xl"
            />
            <Input
              value={forwardAddress}
              onChange={(event) => setComposeForwardAddress(event.target.value)}
              placeholder="输入转发邮箱地址"
              className="h-10 rounded-xl"
            />
          </div>
          <DialogFooter className="block border-t border-border pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="rounded-xl"
                disabled={isMailboxActionBusy || domainsLoading}
                onClick={async () => {
                  try {
                    setMailboxAction("generate")
                    await generateMailbox()
                  } finally {
                    setMailboxAction(null)
                  }
                }}
              >
                <Sparkles className="h-4 w-4" />
                {mailboxAction === "generate" ? "生成中..." : "随机生成"}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={isMailboxActionBusy || domainsLoading}
                onClick={handleCreateCustomMailbox}
              >
                {mailboxAction === "create" ? "创建中..." : "创建邮箱"}
              </Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={isMailboxActionBusy || !currentMailbox}
                onClick={handleCopyMailbox}
              >
                <Copy className="h-4 w-4" />
                {mailboxAction === "copy" ? "复制中..." : "复制地址"}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={isMailboxActionBusy || !currentMailbox}
                onClick={handleToggleFavorite}
              >
                <Star className="h-4 w-4" />
                {mailboxAction === "favorite" ? "处理中..." : "收藏邮箱"}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={isMailboxActionBusy || !currentMailbox}
                onClick={handleSaveForward}
              >
                {mailboxAction === "forward" ? "保存中..." : "保存转发"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
        <SheetContent side="left" className="w-[320px] border-r bg-popover p-0 text-popover-foreground">
          <SheetHeader className="border-b border-border">
            <SheetTitle>收发件箱</SheetTitle>
            <SheetDescription>移动端通过抽屉查看收件箱与发件箱</SheetDescription>
          </SheetHeader>
          {listPane}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) =>
          setConfirmState((current) => ({
            ...current,
            open,
            action: open ? current.action : null,
          }))
        }
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        confirmVariant={confirmState.confirmVariant}
        loading={confirmBusy}
        onConfirm={handleConfirmAction}
      />
    </AppShell>
  )
}
