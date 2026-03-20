import {
  fetchDomains as fetchMockDomains,
  fetchInbox as fetchMockInbox,
  fetchMailboxes as fetchMockMailboxes,
  fetchQuota as fetchMockQuota,
  fetchSent as fetchMockSent,
  fetchUsers as fetchMockUsers,
  type MailMessage,
  type MailboxRecord,
  type UserRecord,
} from "@/lib/mock-mail"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export type ApiSession = {
  authenticated: boolean
  role?: "admin" | "user" | "mailbox" | "guest"
  username?: string
  strictAdmin?: boolean
  can_send?: number
  mailbox_limit?: number
}

type ApiMailbox = {
  id: number | string
  address: string
  created_at?: string
  createdAt?: string
  is_favorite?: number | boolean
  isFavorite?: boolean
  is_pinned?: number | boolean
  isPinned?: boolean
  can_login?: number | boolean
  canLogin?: boolean
  forward_to?: string | null
  forwardTo?: string | null
  category?: "personal" | "team" | "campaign"
}

type ApiEmailListItem = {
  id: number
  sender: string
  to_addrs?: string
  recipients?: string
  subject: string
  preview?: string
  received_at?: string
  created_at?: string
  verification_code?: string
  is_read?: number
  content?: string
  html_content?: string
  text_content?: string
  status?: "delivered" | "queued" | "canceled"
  download?: string
}

type ApiUser = {
  id: number
  username: string
  role: "admin" | "user"
  mailbox_limit?: number
  mailbox_count?: number
  can_send?: number | boolean
  created_at?: string
}

type MailboxesQuery = {
  page?: number
  size?: number
  q?: string
  domain?: string
  favorite?: boolean
  forward?: boolean
}

type UsersQuery = {
  page?: number
  size?: number
  sort?: "asc" | "desc"
}

type MailboxesResponse = ApiMailbox[] | { list?: ApiMailbox[]; total?: number }
type UsersResponse = ApiUser[] | { list?: ApiUser[]; total?: number }

function withCacheHeaders(init?: RequestInit): RequestInit {
  return {
    credentials: "include",
    ...init,
    headers: {
      "Cache-Control": "no-cache",
      ...(init?.headers ?? {}),
    },
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, withCacheHeaders(init))
  if (!response.ok) {
    const text = await response.text()
    let message = text || `Request failed: ${response.status}`

    try {
      const data = JSON.parse(text) as { error?: string; message?: string }
      message = data.error || data.message || message
    } catch {
      // keep raw text
    }

    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function mapMailbox(item: ApiMailbox): MailboxRecord {
  const address = item.address
  return {
    id: String(item.id),
    address,
    createdAt: item.created_at ?? item.createdAt ?? "",
    isFavorite: Boolean(item.is_favorite ?? item.isFavorite),
    isPinned: Boolean(item.is_pinned ?? item.isPinned),
    canLogin: Boolean(item.can_login ?? item.canLogin),
    forwardTo: item.forward_to ?? item.forwardTo ?? null,
    category:
      item.category ??
      (address.includes("icloud")
        ? "personal"
        : address.includes("relay")
          ? "campaign"
          : "team"),
  }
}

function mapEmail(item: ApiEmailListItem, mailbox: string, mode: "inbox" | "sent"): MailMessage {
  return {
    id: item.id,
    sender: mode === "sent" ? mailbox : item.sender,
    recipients: mode === "sent" ? item.recipients ?? item.to_addrs ?? "" : item.to_addrs,
    subject: item.subject,
    preview: item.preview ?? "",
    receivedAt: item.received_at ?? item.created_at ?? "",
    content: item.content ?? item.text_content ?? item.html_content ?? item.preview ?? "",
    htmlContent: item.html_content ?? undefined,
    verificationCode: item.verification_code,
    status: item.status === "delivered" || item.status === "queued" ? item.status : undefined,
    downloadUrl: item.download || undefined,
  }
}

function mapUser(item: ApiUser): UserRecord {
  return {
    id: item.id,
    username: item.username,
    role: item.role,
    mailboxCount: item.mailbox_count ?? 0,
    canSend: Boolean(item.can_send),
    createdAt: item.created_at ?? "",
  }
}

function normalizeMailboxResponse(response: MailboxesResponse) {
  if (Array.isArray(response)) {
    return {
      list: response,
      total: response.length,
    }
  }

  return {
    list: Array.isArray(response.list) ? response.list : [],
    total: typeof response.total === "number" ? response.total : 0,
  }
}

function normalizeUsersResponse(response: UsersResponse) {
  if (Array.isArray(response)) {
    return {
      list: response,
      total: response.length,
    }
  }

  return {
    list: Array.isArray(response.list) ? response.list : [],
    total: typeof response.total === "number" ? response.total : 0,
  }
}

export async function fetchSession() {
  try {
    return await requestJson<ApiSession>("/api/session")
  } catch {
    return null
  }
}

export async function login(username: string, password: string) {
  return requestJson<ApiSession>("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  })
}

export async function logoutRequest() {
  try {
    await requestJson<{ success: boolean }>("/api/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
  } catch {
    // noop
  }
}

export async function fetchDomains() {
  try {
    return await requestJson<string[]>("/api/domains")
  } catch {
    return fetchMockDomains()
  }
}

export async function fetchQuota() {
  try {
    return await requestJson<{ limit: number; used: number; remaining: number }>("/api/user/quota")
  } catch {
    return fetchMockQuota()
  }
}

export async function fetchMailboxes() {
  try {
    const data = await requestJson<MailboxesResponse>("/api/mailboxes?limit=200&offset=0")
    return normalizeMailboxResponse(data).list.map(mapMailbox)
  } catch {
    return fetchMockMailboxes()
  }
}

export async function fetchMailboxesPage(query: MailboxesQuery = {}) {
  const params = new URLSearchParams()
  if (query.page) {
    params.set("page", String(query.page))
  }
  if (query.size) {
    params.set("size", String(query.size))
  }
  if (query.q) {
    params.set("q", query.q)
  }
  if (query.domain) {
    params.set("domain", query.domain)
  }
  if (typeof query.favorite === "boolean") {
    params.set("favorite", String(query.favorite))
  }
  if (typeof query.forward === "boolean") {
    params.set("forward", String(query.forward))
  }

  const path = `/api/mailboxes${params.size ? `?${params.toString()}` : ""}`

  try {
    const data = normalizeMailboxResponse(await requestJson<MailboxesResponse>(path))
    const currentPage = query.page ?? 1
    const pageSize = query.size ?? (data.list.length || 1)
    return {
      list: data.list.map(mapMailbox),
      total: data.total || data.list.length,
      page: currentPage,
      size: pageSize,
      hasMore: currentPage * pageSize < (data.total || data.list.length),
    }
  } catch {
    const all = await fetchMockMailboxes()
    const keyword = query.q?.trim().toLowerCase() ?? ""
    const filtered = keyword
      ? all.filter((mailbox) => mailbox.address.toLowerCase().includes(keyword))
      : all
    const pageSize = query.size ?? 12
    const currentPage = query.page ?? 1
    const start = (currentPage - 1) * pageSize
    return {
      list: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page: currentPage,
      size: pageSize,
      hasMore: start + pageSize < filtered.length,
    }
  }
}

export async function generateMailbox(length: number, domainIndex: number) {
  return requestJson<{ email: string; expires: number }>(
    `/api/generate?length=${length}&domainIndex=${domainIndex}`,
  )
}

export async function createMailbox(local: string, domainIndex: number) {
  return requestJson<{ email: string; expires: number }>("/api/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      local,
      domainIndex,
    }),
  })
}

export async function saveMailboxForward(mailboxId: string, forwardTo: string | null) {
  return requestJson<{ success: boolean }>("/api/mailbox/forward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mailbox_id: Number(mailboxId),
      forward_to: forwardTo,
    }),
  })
}

export async function toggleMailboxFavorite(mailboxId: string, isFavorite: boolean) {
  return requestJson<{ success: boolean }>("/api/mailbox/favorite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mailbox_id: Number(mailboxId),
      is_favorite: isFavorite,
    }),
  })
}

export async function fetchInbox(mailbox: string) {
  try {
    const list = await requestJson<ApiEmailListItem[]>(
      `/api/emails?mailbox=${encodeURIComponent(mailbox)}&limit=50`,
    )
    return list.map((item) => mapEmail(item, mailbox, "inbox"))
  } catch {
    return fetchMockInbox(mailbox)
  }
}

export async function fetchInboxDetail(id: number, mailbox: string): Promise<MailMessage | null> {
  try {
    const item = await requestJson<ApiEmailListItem>(`/api/email/${id}`)
    return mapEmail(item, mailbox, "inbox")
  } catch {
    const items = await fetchMockInbox(mailbox)
    return items.find((entry) => entry.id === id) ?? null
  }
}

export async function fetchSent(mailbox: string) {
  try {
    const list = await requestJson<ApiEmailListItem[]>(
      `/api/sent?from=${encodeURIComponent(mailbox)}&limit=50`,
    )
    return list.map((item) => mapEmail(item, mailbox, "sent"))
  } catch {
    return fetchMockSent(mailbox)
  }
}

export async function fetchSentDetail(id: number, mailbox: string): Promise<MailMessage | null> {
  try {
    const item = await requestJson<ApiEmailListItem>(`/api/sent/${id}`)
    return mapEmail(item, mailbox, "sent")
  } catch {
    const items = await fetchMockSent(mailbox)
    return items.find((entry) => entry.id === id) ?? null
  }
}

export async function sendEmail(payload: {
  from: string
  to: string
  subject: string
  text: string
  html?: string
}) {
  return requestJson<{ success: boolean; id?: string }>("/api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export async function seedSampleEmails(mailbox: string) {
  return requestJson<{
    success: boolean
    mailbox: string
    inboxCreated: number
    sentCreated: number
  }>("/api/emails/seed-samples", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mailbox }),
  })
}

export async function deleteInboxEmail(id: number) {
  try {
    return await requestJson<{ success: boolean; deleted?: boolean }>(`/api/email/${id}`, {
      method: "DELETE",
    })
  } catch {
    return { success: true, deleted: true }
  }
}

export async function clearInboxEmails(mailbox: string) {
  try {
    return await requestJson<{ success: boolean; deletedCount?: number }>(
      `/api/emails?mailbox=${encodeURIComponent(mailbox)}`,
      {
        method: "DELETE",
      },
    )
  } catch {
    return { success: true, deletedCount: 0 }
  }
}

export async function deleteSentEmail(id: number) {
  try {
    return await requestJson<{ success: boolean }>(`/api/sent/${id}`, {
      method: "DELETE",
    })
  } catch {
    return { success: true }
  }
}

export function getInboxEmailDownloadUrl(id: number) {
  return `/api/email/${id}/download`
}

export async function fetchUsers() {
  try {
    const data = await requestJson<UsersResponse>("/api/users?limit=100&offset=0")
    return normalizeUsersResponse(data).list.map(mapUser)
  } catch {
    return fetchMockUsers()
  }
}

export async function fetchUsersPage(query: UsersQuery = {}) {
  const params = new URLSearchParams()
  if (query.page) {
    params.set("page", String(query.page))
  }
  if (query.size) {
    params.set("size", String(query.size))
  }
  if (query.sort) {
    params.set("sort", query.sort)
  }

  const path = `/api/users${params.size ? `?${params.toString()}` : ""}`

  try {
    const data = normalizeUsersResponse(await requestJson<UsersResponse>(path))
    const currentPage = query.page ?? 1
    const pageSize = query.size ?? (data.list.length || 1)
    return {
      list: data.list.map(mapUser),
      total: data.total || data.list.length,
      page: currentPage,
      size: pageSize,
      hasMore: currentPage * pageSize < (data.total || data.list.length),
    }
  } catch {
    const all = await fetchMockUsers()
    const pageSize = query.size ?? 10
    const currentPage = query.page ?? 1
    const ordered = [...all].sort((a, b) =>
      query.sort === "asc"
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    )
    const start = (currentPage - 1) * pageSize
    return {
      list: ordered.slice(start, start + pageSize),
      total: ordered.length,
      page: currentPage,
      size: pageSize,
      hasMore: start + pageSize < ordered.length,
    }
  }
}

export async function fetchUserMailboxes(userId: number) {
  try {
    const data = await requestJson<ApiMailbox[]>(`/api/users/${userId}/mailboxes`)
    return data.map(mapMailbox)
  } catch {
    const all = await fetchMockMailboxes()
    return all.filter((_, index) => index % 2 === userId % 2)
  }
}

export async function createUser(payload: {
  username: string
  password: string
  role: "admin" | "user"
  mailboxLimit: number
}) {
  return requestJson<ApiUser>("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export async function updateUser(
  id: number,
  payload: {
    role?: "admin" | "user"
    can_send?: boolean
    mailboxLimit?: number
  },
) {
  return requestJson<{ success: boolean }>(`/api/users/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: payload.role,
      can_send: payload.can_send ? 1 : 0,
      mailboxLimit: payload.mailboxLimit,
    }),
  })
}

export async function deleteUser(id: number) {
  return requestJson<{ success: boolean }>(`/api/users/${id}`, {
    method: "DELETE",
  })
}

export async function assignUserMailbox(username: string, address: string) {
  return requestJson<{ success: boolean }>("/api/users/assign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, address }),
  })
}

export async function unassignUserMailbox(username: string, address: string) {
  return requestJson<{ success: boolean }>("/api/users/unassign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, address }),
  })
}

export async function deleteMailbox(address: string) {
  return requestJson<{ success: boolean; deleted?: boolean }>(
    `/api/mailboxes?address=${encodeURIComponent(address)}`,
    {
      method: "DELETE",
    },
  )
}

export async function toggleMailboxLogin(address: string, canLogin: boolean) {
  return requestJson<{ success: boolean; can_login?: boolean }>("/api/mailboxes/toggle-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      can_login: canLogin ? 1 : 0,
    }),
  })
}

export async function pinMailbox(address: string) {
  return requestJson<{ success: boolean; pinned?: boolean }>(
    `/api/mailboxes/pin?address=${encodeURIComponent(address)}`,
    {
      method: "POST",
    },
  )
}

export async function resetMailboxPassword(address: string) {
  return requestJson<{ success: boolean }>(
    `/api/mailboxes/reset-password?address=${encodeURIComponent(address)}`,
    {
      method: "POST",
    },
  )
}

export async function changeMailboxPassword(address: string, newPassword: string) {
  return requestJson<{ success: boolean }>("/api/mailboxes/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      new_password: newPassword,
    }),
  })
}

export async function batchToggleMailboxLogin(addresses: string[], canLogin: boolean) {
  return requestJson<{
    success: boolean
    success_count?: number
    fail_count?: number
    total?: number
  }>("/api/mailboxes/batch-toggle-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses,
      can_login: canLogin ? 1 : 0,
    }),
  })
}

export async function batchFavoriteMailboxesByAddress(addresses: string[], isFavorite: boolean) {
  return requestJson<{ success: boolean }>("/api/mailboxes/batch-favorite-by-address", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses,
      is_favorite: isFavorite ? 1 : 0,
    }),
  })
}

export async function batchForwardMailboxesByAddress(addresses: string[], forwardTo: string | null) {
  return requestJson<{ success: boolean }>("/api/mailboxes/batch-forward-by-address", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses,
      forward_to: forwardTo,
    }),
  })
}
