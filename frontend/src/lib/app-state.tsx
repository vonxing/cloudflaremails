/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useState } from "react"

import {
  fetchDomains,
  fetchMailboxes,
  fetchQuota,
  fetchSession,
  fetchUsers,
  createMailbox as createMailboxRequest,
  generateMailbox as generateMailboxRequest,
  logoutRequest,
  saveMailboxForward,
  toggleMailboxFavorite,
  type ApiSession,
} from "@/lib/api"
import { type MailboxRecord, type UserRecord } from "@/lib/mock-mail"

export type SessionUser = {
  username: string
  role: "admin" | "guest" | "user" | "mailbox"
  canSend?: boolean
  mailboxLimit?: number
}

type AppStateValue = {
  session: SessionUser | null
  sessionReady: boolean
  setSession: (session: SessionUser | null) => void
  refreshSession: () => Promise<void>
  domains: string[]
  domainsLoading: boolean
  quota:
    | {
        limit: number
        used: number
        remaining: number
      }
    | undefined
  quotaLoading: boolean
  users: UserRecord[]
  mailboxes: MailboxRecord[]
  mailboxesLoading: boolean
  currentMailbox: string
  selectedDomain: string
  mailboxLength: number[]
  forwardAddress: string
  search: string
  setSearch: (value: string) => void
  setSelectedDomain: (value: string) => void
  setMailboxLength: (value: number[]) => void
  setComposeForwardAddress: (value: string) => void
  selectMailbox: (address: string) => void
  generateMailbox: () => Promise<void>
  createMailbox: (local: string) => Promise<void>
  toggleFavorite: () => Promise<void>
  saveForward: () => Promise<void>
  copyMailbox: () => Promise<void>
  logout: () => Promise<void>
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined)

function mapSession(session: ApiSession | null): SessionUser | null {
  if (!session?.authenticated || !session.username || !session.role) {
    return null
  }

  const role =
    session.role === "guest" || session.role === "admin" || session.role === "mailbox"
      ? session.role
      : "user"

  return {
    username: session.username,
    role,
    canSend: Boolean(session.can_send),
    mailboxLimit: session.mailbox_limit,
  }
}

function findDomainIndex(domains: string[], selectedDomain: string) {
  const index = domains.findIndex((domain) => domain === selectedDomain)
  return index >= 0 ? index : 0
}

function createLocalMailboxRecord(email: string): MailboxRecord {
  return {
    id: email,
    address: email,
    createdAt: new Date().toISOString(),
    isFavorite: false,
    isPinned: false,
    canLogin: false,
    forwardTo: null,
    category: "personal",
  }
}

export function AppStateProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const [session, setSessionState] = useState<SessionUser | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [mailboxes, setMailboxes] = useState<MailboxRecord[]>([])
  const [currentMailbox, setCurrentMailbox] = useState("")
  const [selectedDomain, setSelectedDomain] = useState("")
  const [mailboxLength, setMailboxLength] = useState([10])
  const [forwardAddress, setForwardAddress] = useState("ops@studio.dev")
  const [search, setSearch] = useState("")

  const domainsQuery = useQuery({
    queryKey: ["domains"],
    queryFn: fetchDomains,
    enabled: session !== null,
  })
  const quotaQuery = useQuery({
    queryKey: ["quota"],
    queryFn: fetchQuota,
    enabled: session !== null,
  })
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: session !== null && session.role === "admin",
  })
  const mailboxesQuery = useQuery({
    queryKey: ["mailboxes"],
    queryFn: fetchMailboxes,
    enabled: session !== null,
  })

  const refreshSession = async () => {
    const next = mapSession(await fetchSession())
    setSessionState(next)
    setSessionReady(true)
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  useEffect(() => {
    if (!selectedDomain && domainsQuery.data?.length) {
      setSelectedDomain(domainsQuery.data[0])
    }
  }, [domainsQuery.data, selectedDomain])

  useEffect(() => {
    if (mailboxesQuery.data?.length) {
      setMailboxes(mailboxesQuery.data)
      const preferredAddress = currentMailbox || mailboxesQuery.data[0].address
      const current =
        mailboxesQuery.data.find((item) => item.address === preferredAddress) ??
        mailboxesQuery.data[0]
      setCurrentMailbox(current.address)
      setForwardAddress(current.forwardTo ?? "")
      return
    }

    if (session) {
      setMailboxes([])
      setCurrentMailbox("")
      setForwardAddress("")
    }
  }, [currentMailbox, mailboxesQuery.data, session])

  const setSession = (next: SessionUser | null) => {
    setSessionState(next)
    setSessionReady(true)
    if (!next) {
      setMailboxes([])
      setCurrentMailbox("")
      setForwardAddress("ops@studio.dev")
      setSearch("")
      queryClient.clear()
    }
  }

  const selectMailbox = (address: string) => {
    setCurrentMailbox(address)
    const mailbox = mailboxes.find((item) => item.address === address)
    setForwardAddress(mailbox?.forwardTo ?? "")
  }

  const generateMailbox = async () => {
    if (!selectedDomain || !domainsQuery.data?.length) {
      return
    }

    try {
      const created = await generateMailboxRequest(
        mailboxLength[0],
        findDomainIndex(domainsQuery.data, selectedDomain),
      )
      setMailboxes((current) => {
        const exists = current.some((item) => item.address === created.email)
        if (exists) {
          return current
        }

        return [createLocalMailboxRecord(created.email), ...current]
      })
      setCurrentMailbox(created.email)
      setForwardAddress("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mailboxes"] }),
        queryClient.invalidateQueries({ queryKey: ["mailboxes-page"] }),
        queryClient.invalidateQueries({ queryKey: ["quota"] }),
      ])
    } catch {
      // keep silent for now, mock query will still render if backend unavailable
    }
  }

  const createMailbox = async (local: string) => {
    const nextLocal = local.trim().toLowerCase()
    if (!nextLocal || !selectedDomain || !domainsQuery.data?.length) {
      return
    }

    const created = await createMailboxRequest(
      nextLocal,
      findDomainIndex(domainsQuery.data, selectedDomain),
    )
    setMailboxes((current) => {
      const exists = current.some((item) => item.address === created.email)
      if (exists) {
        return current
      }

      return [createLocalMailboxRecord(created.email), ...current]
    })
    setCurrentMailbox(created.email)
    setForwardAddress("")
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] }),
      queryClient.invalidateQueries({ queryKey: ["mailboxes-page"] }),
      queryClient.invalidateQueries({ queryKey: ["quota"] }),
    ])
  }

  const toggleFavorite = async () => {
    const mailbox = mailboxes.find((item) => item.address === currentMailbox)
    if (!mailbox) {
      return
    }

    try {
      await toggleMailboxFavorite(mailbox.id, !mailbox.isFavorite)
      setMailboxes((current) =>
        current.map((item) =>
          item.address === mailbox.address ? { ...item, isFavorite: !item.isFavorite } : item,
        ),
      )
    } catch {
      setMailboxes((current) =>
        current.map((item) =>
          item.address === mailbox.address ? { ...item, isFavorite: !item.isFavorite } : item,
        ),
      )
    }
  }

  const saveForward = async () => {
    const mailbox = mailboxes.find((item) => item.address === currentMailbox)
    if (!mailbox) {
      return
    }

    const nextValue = forwardAddress.trim() || null
    try {
      await saveMailboxForward(mailbox.id, nextValue)
    } catch {
      // allow optimistic fallback
    }

    setMailboxes((current) =>
      current.map((item) =>
        item.address === mailbox.address ? { ...item, forwardTo: nextValue } : item,
      ),
    )
  }

  const copyMailbox = async () => {
    if (!currentMailbox) {
      return
    }

    await navigator.clipboard.writeText(currentMailbox)
  }

  const logout = async () => {
    await logoutRequest()
    setSession(null)
  }

  const value: AppStateValue = {
    session,
    sessionReady,
    setSession,
    refreshSession,
    domains: domainsQuery.data ?? [],
    domainsLoading: domainsQuery.isLoading,
    quota: quotaQuery.data,
    quotaLoading: quotaQuery.isLoading,
    users: usersQuery.data ?? [],
    mailboxes,
    mailboxesLoading: mailboxesQuery.isLoading,
    currentMailbox,
    selectedDomain,
    mailboxLength,
    forwardAddress,
    search,
    setSearch,
    setSelectedDomain,
    setMailboxLength,
    setComposeForwardAddress: setForwardAddress,
    selectMailbox,
    generateMailbox,
    createMailbox,
    toggleFavorite,
    saveForward,
    copyMailbox,
    logout,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider")
  }

  return context
}
