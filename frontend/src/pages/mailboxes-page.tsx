import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Pin,
  Search,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  batchFavoriteMailboxesByAddress,
  batchForwardMailboxesByAddress,
  batchToggleMailboxLogin,
  changeMailboxPassword,
  deleteMailbox,
  fetchMailboxesPage,
  getErrorMessage,
  pinMailbox,
  resetMailboxPassword,
  toggleMailboxLogin,
} from "@/lib/api"
import { useAppState } from "@/lib/app-state"
import { navigate } from "@/lib/navigation"
import { type MailboxRecord } from "@/lib/mock-mail"

const PAGE_SIZE = 12

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

const columns = (
  canManage: boolean,
  selectedAddresses: string[],
  onToggleSelectAll: () => void,
  onToggleSelectOne: (address: string) => void,
  onToggleLogin: (mailbox: MailboxRecord) => void,
  onPinMailbox: (mailbox: MailboxRecord) => void,
  onFavoriteMailbox: (mailbox: MailboxRecord) => void,
  onResetPassword: (mailbox: MailboxRecord) => void,
  onOpenPasswordDialog: (mailbox: MailboxRecord) => void,
  onDeleteMailbox: (mailbox: MailboxRecord) => void,
): ColumnDef<MailboxRecord>[] => [
  ...(canManage
    ? [
        {
          id: "select",
          header: () => (
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={selectedAddresses.length > 0}
              onChange={onToggleSelectAll}
              aria-label="选择当前页全部邮箱"
            />
          ),
          cell: ({ row }: { row: { original: MailboxRecord } }) => (
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={selectedAddresses.includes(row.original.address)}
              onChange={(event) => {
                event.stopPropagation()
                onToggleSelectOne(row.original.address)
              }}
              aria-label={`选择邮箱 ${row.original.address}`}
            />
          ),
        } satisfies ColumnDef<MailboxRecord>,
      ]
    : []),
  {
    accessorKey: "address",
    header: "邮箱地址",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate font-medium text-foreground">
            {row.original.address}
          </div>
          {row.original.isPinned ? (
            <Badge variant="secondary" className="rounded-full">
              <Pin className="h-3.5 w-3.5" />
              置顶
            </Badge>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {row.original.createdAt}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "类型",
    cell: ({ row }) => (
      <Badge variant="secondary" className="rounded-full border-0 capitalize">
        {row.original.category}
      </Badge>
    ),
  },
  {
    accessorKey: "forwardTo",
    header: "转发",
    cell: ({ row }) => (
      <div className="max-w-[220px] truncate text-sm text-muted-foreground">
        {row.original.forwardTo ?? "未设置"}
      </div>
    ),
  },
  {
    accessorKey: "isFavorite",
    header: "收藏",
    cell: ({ row }) => (
      <Button
        variant={row.original.isFavorite ? "default" : "outline"}
        size="sm"
        className="h-8 rounded-xl"
        disabled={!canManage}
        onClick={(event) => {
          event.stopPropagation()
          onFavoriteMailbox(row.original)
        }}
      >
        <Star className="h-4 w-4" />
        {row.original.isFavorite ? "已收藏" : "收藏"}
      </Button>
    ),
  },
  {
    accessorKey: "canLogin",
    header: "登录",
    cell: ({ row }) => (
      <Button
        variant={row.original.canLogin ? "default" : "outline"}
        size="sm"
        className="h-8 rounded-xl"
        disabled={!canManage}
        onClick={(event) => {
          event.stopPropagation()
          onToggleLogin(row.original)
        }}
      >
        {row.original.canLogin ? "允许" : "禁用"}
      </Button>
    ),
  },
  ...(canManage
    ? [
        {
          id: "actions",
          header: "操作",
          cell: ({ row }: { row: { original: MailboxRecord } }) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl"
                onClick={(event) => {
                  event.stopPropagation()
                  onResetPassword(row.original)
                }}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenPasswordDialog(row.original)
                }}
              >
                改密
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl"
                onClick={(event) => {
                  event.stopPropagation()
                  onPinMailbox(row.original)
                }}
              >
                <ShieldCheck className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-destructive hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteMailbox(row.original)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
        } satisfies ColumnDef<MailboxRecord>,
      ]
    : []),
]

export function MailboxesPage() {
  const queryClient = useQueryClient()
  const { search, setSearch, selectMailbox, session } = useAppState()
  const [page, setPage] = useState(1)
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([])
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<MailboxRecord | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false)
  const [batchForwardAddress, setBatchForwardAddress] = useState("")
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "确认",
    confirmVariant: "default",
    action: null,
  })

  const mailboxesQuery = useQuery({
    queryKey: ["mailboxes-page", page, search],
    queryFn: () =>
      fetchMailboxesPage({
        page,
        size: PAGE_SIZE,
        q: search.trim() || undefined,
      }),
  })

  const rows = mailboxesQuery.data?.list ?? []
  const total = mailboxesQuery.data?.total ?? 0
  const hasMore = mailboxesQuery.data?.hasMore ?? false
  const totalPages = Math.max(1, hasMore ? page + 1 : Math.ceil(Math.max(total, 1) / PAGE_SIZE))
  const allPageSelected =
    rows.length > 0 && rows.every((mailbox) => selectedAddresses.includes(mailbox.address))
  const canManageMailboxes = session?.role === "admin"

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

  const handleToggleLogin = async (mailbox: MailboxRecord) => {
    try {
      await toggleMailboxLogin(mailbox.address, !mailbox.canLogin)
      await refreshMailboxQueries()
      toast.success(mailbox.canLogin ? "已关闭邮箱登录" : "已开启邮箱登录")
    } catch (error) {
      toast.error(getErrorMessage(error, "切换登录状态失败"))
    }
  }

  const handlePinMailbox = async (mailbox: MailboxRecord) => {
    try {
      await pinMailbox(mailbox.address)
      await refreshMailboxQueries()
      toast.success(mailbox.isPinned ? "已取消置顶" : "已置顶邮箱")
    } catch (error) {
      toast.error(getErrorMessage(error, "置顶邮箱失败"))
    }
  }

  const handleDeleteMailbox = async (mailbox: MailboxRecord) => {
    openConfirmDialog({
      title: "删除邮箱",
      description: `确认后将删除 ${mailbox.address}。`,
      confirmLabel: "确认删除",
      confirmVariant: "destructive",
      action: async () => {
        try {
          await deleteMailbox(mailbox.address)
          await refreshMailboxQueries()
          setSelectedAddresses((current) => current.filter((address) => address !== mailbox.address))
          toast.success("邮箱已删除")
        } catch (error) {
          toast.error(getErrorMessage(error, "删除邮箱失败"))
        }
      },
    })
  }

  const refreshMailboxQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mailboxes-page"] }),
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] }),
      queryClient.invalidateQueries({ queryKey: ["quota"] }),
    ])
  }

  const toggleSelectOne = (address: string) => {
    setSelectedAddresses((current) =>
      current.includes(address)
        ? current.filter((item) => item !== address)
        : [...current, address],
    )
  }

  const toggleSelectAll = () => {
    setSelectedAddresses((current) =>
      allPageSelected
        ? current.filter((address) => !rows.some((mailbox) => mailbox.address === address))
        : Array.from(new Set([...current, ...rows.map((mailbox) => mailbox.address)])),
    )
  }

  const handleFavoriteMailbox = async (mailbox: MailboxRecord) => {
    try {
      await batchFavoriteMailboxesByAddress([mailbox.address], !mailbox.isFavorite)
      await refreshMailboxQueries()
      toast.success(mailbox.isFavorite ? "已取消收藏" : "已加入收藏")
    } catch (error) {
      toast.error(getErrorMessage(error, "更新收藏状态失败"))
    }
  }

  const handleResetPassword = async (mailbox: MailboxRecord) => {
    openConfirmDialog({
      title: "重置邮箱密码",
      description: `确认后将重置 ${mailbox.address} 的密码。`,
      confirmLabel: "确认重置",
      action: async () => {
        try {
          await resetMailboxPassword(mailbox.address)
          toast.success("密码已重置")
        } catch (error) {
          toast.error(getErrorMessage(error, "重置密码失败"))
        }
      },
    })
  }

  const handleOpenPasswordDialog = (mailbox: MailboxRecord) => {
    setPasswordTarget(mailbox)
    setNewPassword("")
    setPasswordDialogOpen(true)
  }

  const handleChangePassword = async () => {
    if (!passwordTarget || !newPassword.trim()) {
      return
    }

    try {
      await changeMailboxPassword(passwordTarget.address, newPassword.trim())
      setPasswordDialogOpen(false)
      setPasswordTarget(null)
      setNewPassword("")
      toast.success("密码已更新")
    } catch (error) {
      toast.error(getErrorMessage(error, "修改密码失败"))
    }
  }

  const handleBatchToggleLogin = async (canLogin: boolean) => {
    if (selectedAddresses.length === 0) {
      toast.error("请先选择邮箱")
      return
    }

    try {
      await batchToggleMailboxLogin(selectedAddresses, canLogin)
      await refreshMailboxQueries()
      toast.success(canLogin ? "已批量开启登录" : "已批量关闭登录")
    } catch (error) {
      toast.error(getErrorMessage(error, "批量切换登录失败"))
    }
  }

  const handleBatchFavorite = async (isFavorite: boolean) => {
    if (selectedAddresses.length === 0) {
      toast.error("请先选择邮箱")
      return
    }

    try {
      await batchFavoriteMailboxesByAddress(selectedAddresses, isFavorite)
      await refreshMailboxQueries()
      toast.success(isFavorite ? "已批量收藏邮箱" : "已批量取消收藏")
    } catch (error) {
      toast.error(getErrorMessage(error, "批量收藏失败"))
    }
  }

  const handleBatchForward = async () => {
    if (selectedAddresses.length === 0) {
      toast.error("请先选择邮箱")
      return
    }

    try {
      await batchForwardMailboxesByAddress(selectedAddresses, batchForwardAddress.trim() || null)
      setForwardDialogOpen(false)
      setBatchForwardAddress("")
      await refreshMailboxQueries()
      toast.success(batchForwardAddress.trim() ? "已批量保存转发" : "已批量清除转发")
    } catch (error) {
      toast.error(getErrorMessage(error, "批量转发失败"))
    }
  }

  const table = useReactTable({
    data: rows,
    columns: columns(
      canManageMailboxes,
      selectedAddresses,
      toggleSelectAll,
      toggleSelectOne,
      handleToggleLogin,
      handlePinMailbox,
      handleFavoriteMailbox,
      handleResetPassword,
      handleOpenPasswordDialog,
      handleDeleteMailbox,
    ),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <AppShell
      currentRoute="/mailboxes"
      headerContent={
        <div className="flex w-full items-center justify-end">
          <div className="relative w-full md:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="workspace-search h-10 rounded-2xl border-border pl-9 shadow-[0_10px_30px_color-mix(in_oklab,var(--color-foreground)_6%,transparent)]"
              placeholder="搜索邮箱"
            />
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 gap-3 p-3">
          <section className="workspace-panel rounded-2xl border border-border shadow-[0_8px_30px_color-mix(in_oklab,var(--color-foreground)_6%,transparent)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="text-sm text-muted-foreground">
                已选择 <span className="font-semibold text-foreground">{selectedAddresses.length}</span> 项
              </div>
              {canManageMailboxes ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => void handleBatchToggleLogin(true)}>
                    批量启用登录
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => void handleBatchToggleLogin(false)}>
                    批量禁用登录
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => void handleBatchFavorite(true)}>
                    批量收藏
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => setForwardDialogOpen(true)}>
                    批量转发
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">访客模式为只读示例，管理操作已禁用</div>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canManageMailboxes ? 8 : 5} className="h-32 text-center text-sm text-muted-foreground">
                        {mailboxesQuery.isLoading ? "邮箱加载中..." : "暂无邮箱数据"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => {
                        selectMailbox(row.original.address)
                        navigate("/app")
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                显示 {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, total || rows.length)} / {Math.max(total, rows.length)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl"
                  disabled={!hasMore && page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>修改邮箱密码</DialogTitle>
              <DialogDescription>
                {passwordTarget?.address ?? "请选择邮箱"}
              </DialogDescription>
            </DialogHeader>
            <Input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="输入新密码"
              type="password"
              className="h-10 rounded-xl"
            />
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setPasswordDialogOpen(false)}>
                取消
              </Button>
              <Button className="rounded-xl" onClick={() => void handleChangePassword()}>
                保存密码
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>批量转发</DialogTitle>
              <DialogDescription>留空即可批量清除转发地址。</DialogDescription>
            </DialogHeader>
            <Input
              value={batchForwardAddress}
              onChange={(event) => setBatchForwardAddress(event.target.value)}
              placeholder="Forward address"
              className="h-10 rounded-xl"
            />
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setForwardDialogOpen(false)}>
                取消
              </Button>
              <Button className="rounded-xl" onClick={() => void handleBatchForward()}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </div>
    </AppShell>
  )
}
