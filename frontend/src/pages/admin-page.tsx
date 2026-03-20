import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  Mailbox,
  Plus,
  Shield,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { toast } from "sonner"
import {
  assignUserMailbox,
  createUser,
  deleteUser,
  fetchUserMailboxes,
  fetchUsersPage,
  getErrorMessage,
  unassignUserMailbox,
  updateUser,
} from "@/lib/api"
import { useAppState } from "@/lib/app-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function panelClassName() {
  return "workspace-panel rounded-xl border border-border text-card-foreground shadow-[0_8px_30px_color-mix(in_oklab,var(--color-foreground)_6%,transparent)]"
}

const PAGE_SIZE = 10

export function AdminPage() {
  const queryClient = useQueryClient()
  const { session, users, mailboxes } = useAppState()
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<"admin" | "user">("user")
  const [newMailboxLimit, setNewMailboxLimit] = useState("10")
  const [selectedAvailableAddresses, setSelectedAvailableAddresses] = useState<string[]>([])
  const [selectedAssignedAddresses, setSelectedAssignedAddresses] = useState<string[]>([])
  const activeSenders = users.filter((user) => user.canSend).length

  const usersQuery = useQuery({
    queryKey: ["users-page", page],
    queryFn: () => fetchUsersPage({ page, size: PAGE_SIZE, sort: "desc" }),
  })
  const selectedUser = usersQuery.data?.list.find((user) => user.id === selectedUserId) ?? null
  const userMailboxesQuery = useQuery({
    queryKey: ["user-mailboxes", selectedUserId],
    queryFn: () => fetchUserMailboxes(selectedUserId as number),
    enabled: selectedUserId !== null,
  })

  const userRows = usersQuery.data?.list ?? []
  const total = usersQuery.data?.total ?? 0
  const hasMore = usersQuery.data?.hasMore ?? false
  const totalPages = Math.max(1, hasMore ? page + 1 : Math.ceil(Math.max(total, 1) / PAGE_SIZE))
  const assignedAddresses = new Set((userMailboxesQuery.data ?? []).map((item) => item.address))
  const assignableMailboxes = mailboxes.filter((mailbox) => !assignedAddresses.has(mailbox.address))

  const handleToggleSend = async (id: number, current: boolean) => {
    setPendingId(id)
    try {
      await updateUser(id, { can_send: !current })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["users-page"] }),
      ])
      toast.success(current ? "已关闭发件权限" : "已开启发件权限")
    } catch (error) {
      toast.error(getErrorMessage(error, "更新发件权限失败"))
    } finally {
      setPendingId(null)
    }
  }

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["users"] }),
      queryClient.invalidateQueries({ queryKey: ["users-page"] }),
      queryClient.invalidateQueries({ queryKey: ["user-mailboxes"] }),
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] }),
      queryClient.invalidateQueries({ queryKey: ["mailboxes-page"] }),
      queryClient.invalidateQueries({ queryKey: ["quota"] }),
    ])
  }

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      return
    }

    try {
      await createUser({
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: newRole,
        mailboxLimit: Number(newMailboxLimit) || 0,
      })
      setCreateOpen(false)
      setNewUsername("")
      setNewPassword("")
      setNewRole("user")
      setNewMailboxLimit("10")
      await refreshAdminData()
      toast.success("用户已创建")
    } catch (error) {
      toast.error(getErrorMessage(error, "创建用户失败"))
    }
  }

  const handleDeleteUser = async (id: number) => {
    try {
      await deleteUser(id)
      if (selectedUserId === id) {
        setSelectedUserId(null)
      }
      await refreshAdminData()
      toast.success("用户已删除")
    } catch (error) {
      toast.error(getErrorMessage(error, "删除用户失败"))
    }
  }

  const resetAssignSelections = () => {
    setSelectedAvailableAddresses([])
    setSelectedAssignedAddresses([])
  }

  const toggleAddressSelection = (
    address: string,
    setSelected: (value: string[] | ((current: string[]) => string[])) => void,
  ) => {
    setSelected((current) =>
      current.includes(address)
        ? current.filter((item) => item !== address)
        : [...current, address],
    )
  }

  const handleOpenAssignDialog = (userId?: number) => {
    if (typeof userId === "number") {
      setSelectedUserId(userId)
    }
    resetAssignSelections()
    setAssignDialogOpen(true)
  }

  const handleAssignMailbox = async () => {
    if (!selectedUser || selectedAvailableAddresses.length === 0) {
      return
    }

    try {
      await Promise.all(
        selectedAvailableAddresses.map((address) =>
          assignUserMailbox(selectedUser.username, address),
        ),
      )
      setSelectedAvailableAddresses([])
      await refreshAdminData()
      toast.success("邮箱已分配")
    } catch (error) {
      toast.error(getErrorMessage(error, "分配邮箱失败"))
    }
  }

  const handleUnassignMailbox = async () => {
    if (!selectedUser || selectedAssignedAddresses.length === 0) {
      return
    }

    try {
      await Promise.all(
        selectedAssignedAddresses.map((address) =>
          unassignUserMailbox(selectedUser.username, address),
        ),
      )
      setSelectedAssignedAddresses([])
      await refreshAdminData()
      toast.success("邮箱已取消分配")
    } catch (error) {
      toast.error(getErrorMessage(error, "取消分配失败"))
    }
  }

  return (
    <AppShell
      currentRoute="/admin"
      headerContent={
        <div className="flex w-full items-center justify-end">
          <Button className="rounded-2xl" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            新建用户
          </Button>
        </div>
      }
    >
      <div className="flex min-h-svh flex-col">
        <div className="grid gap-3 p-3">
          <section className="grid gap-3 md:grid-cols-4">
            <div className={`${panelClassName()} p-3`}>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">当前身份</div>
                  <div className="text-sm font-semibold text-foreground">
                    {session?.role === "admin" ? "管理员" : "访客"}
                  </div>
                </div>
              </div>
            </div>
            <div className={`${panelClassName()} p-3`}>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">用户总数</div>
                  <div className="text-sm font-semibold text-foreground">
                    {users.length}
                  </div>
                </div>
              </div>
            </div>
            <div className={`${panelClassName()} p-3`}>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">可发件</div>
                  <div className="text-sm font-semibold text-foreground">
                    {activeSenders}
                  </div>
                </div>
              </div>
            </div>
            <div className={`${panelClassName()} p-3`}>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Mailbox className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">邮箱库存</div>
                  <div className="text-sm font-semibold text-foreground">
                    {mailboxes.length}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3">
            <section className={`${panelClassName()} overflow-hidden`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>邮箱数</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>发件权限</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                        {usersQuery.isLoading ? "用户加载中..." : "暂无用户数据"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {userRows.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer"
                      onClick={() => handleOpenAssignDialog(user.id)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {user.username}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.mailboxCount}</TableCell>
                      <TableCell>
                        <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                          {user.createdAt}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={user.canSend ? "default" : "outline"}
                            size="sm"
                            className="h-8 rounded-xl"
                            disabled={pendingId === user.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleToggleSend(user.id, user.canSend)
                            }}
                          >
                            {user.canSend ? "可发件" : "只收件"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl text-destructive hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDeleteUser(user.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span>
                  显示 {userRows.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, total || userRows.length)} / {Math.max(total, userRows.length)}
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
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新建用户</DialogTitle>
              <DialogDescription>直接接入原项目的 `/api/users` 创建接口。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Input
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                placeholder="用户名"
                className="h-10 rounded-xl"
              />
              <Input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="密码"
                type="password"
                className="h-10 rounded-xl"
              />
              <Select value={newRole} onValueChange={(value) => setNewRole(value as "admin" | "user")}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={newMailboxLimit}
                onChange={(event) => setNewMailboxLimit(event.target.value)}
                placeholder="邮箱上限"
                type="number"
                className="h-10 rounded-xl"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button className="rounded-xl" onClick={() => void handleCreateUser()}>
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={assignDialogOpen}
          onOpenChange={(open) => {
            setAssignDialogOpen(open)
            if (!open) {
              resetAssignSelections()
            }
          }}
        >
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>管理邮箱分配</DialogTitle>
              <DialogDescription>
                {selectedUser ? `为 ${selectedUser.username} 分配或移除邮箱。` : "请先选择用户。"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="rounded-xl border border-border bg-muted/35">
                <div className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
                  未分配邮箱 ({assignableMailboxes.length})
                </div>
                <div className="max-h-[320px] space-y-1 overflow-y-auto p-2">
                  {assignableMailboxes.length === 0 ? (
                    <div className="rounded-lg px-3 py-8 text-center text-sm text-muted-foreground">
                      当前没有可分配邮箱。
                    </div>
                  ) : (
                    assignableMailboxes.map((mailbox) => {
                      const active = selectedAvailableAddresses.includes(mailbox.address)
                      return (
                        <button
                          key={mailbox.id}
                          type="button"
                          onClick={() =>
                            toggleAddressSelection(
                              mailbox.address,
                              setSelectedAvailableAddresses,
                            )
                          }
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <span className="truncate">{mailbox.address}</span>
                          {mailbox.isFavorite ? (
                            <Badge variant="secondary" className="rounded-full">
                              收藏
                            </Badge>
                          ) : null}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex flex-row items-center justify-center gap-2 md:flex-col">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  disabled={!selectedUser || selectedAvailableAddresses.length === 0}
                  onClick={() => void handleAssignMailbox()}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  disabled={!selectedUser || selectedAssignedAddresses.length === 0}
                  onClick={() => void handleUnassignMailbox()}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-muted/35">
                <div className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
                  已分配邮箱 ({userMailboxesQuery.data?.length ?? 0})
                </div>
                <div className="max-h-[320px] space-y-1 overflow-y-auto p-2">
                  {(userMailboxesQuery.data?.length ?? 0) === 0 ? (
                    <div className="rounded-lg px-3 py-8 text-center text-sm text-muted-foreground">
                      当前用户还没有分配邮箱。
                    </div>
                  ) : (
                    userMailboxesQuery.data?.map((mailbox) => {
                      const active = selectedAssignedAddresses.includes(mailbox.address)
                      return (
                        <button
                          key={mailbox.id}
                          type="button"
                          onClick={() =>
                            toggleAddressSelection(
                              mailbox.address,
                              setSelectedAssignedAddresses,
                            )
                          }
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <span className="truncate">{mailbox.address}</span>
                          <div className="flex items-center gap-2">
                            {mailbox.isPinned ? (
                              <Badge variant="secondary" className="rounded-full">
                                置顶
                              </Badge>
                            ) : null}
                            {mailbox.isFavorite ? (
                              <Badge variant="secondary" className="rounded-full">
                                收藏
                              </Badge>
                            ) : null}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setAssignDialogOpen(false)}
              >
                完成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
