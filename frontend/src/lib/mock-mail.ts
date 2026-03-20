export type MailboxRecord = {
  id: string
  address: string
  createdAt: string
  isFavorite: boolean
  isPinned: boolean
  canLogin: boolean
  forwardTo: string | null
  category: "personal" | "team" | "campaign"
}

export type MailMessage = {
  id: number
  sender: string
  recipients?: string
  subject: string
  preview: string
  receivedAt: string
  content: string
  htmlContent?: string
  verificationCode?: string
  status?: "delivered" | "queued"
  downloadUrl?: string
}

export type UserRecord = {
  id: number
  username: string
  role: "admin" | "user"
  mailboxCount: number
  canSend: boolean
  createdAt: string
}

const delay = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

const domains = ["idmail.live", "relaybox.cc", "icloud-temp.dev"]

const mailboxRecords: MailboxRecord[] = [
  {
    id: "mbx-1",
    address: "zenflow@idmail.live",
    createdAt: "2026-03-18 08:30",
    isFavorite: true,
    isPinned: true,
    canLogin: true,
    forwardTo: "ops@studio.dev",
    category: "team",
  },
  {
    id: "mbx-2",
    address: "summit-lab@relaybox.cc",
    createdAt: "2026-03-17 20:14",
    isFavorite: false,
    isPinned: true,
    canLogin: false,
    forwardTo: null,
    category: "campaign",
  },
  {
    id: "mbx-3",
    address: "aurora-note@icloud-temp.dev",
    createdAt: "2026-03-16 14:22",
    isFavorite: true,
    isPinned: false,
    canLogin: true,
    forwardTo: "review@product.cn",
    category: "personal",
  },
  {
    id: "mbx-4",
    address: "signal-park@idmail.live",
    createdAt: "2026-03-15 18:40",
    isFavorite: false,
    isPinned: false,
    canLogin: true,
    forwardTo: null,
    category: "team",
  },
  {
    id: "mbx-5",
    address: "paperplane@relaybox.cc",
    createdAt: "2026-03-15 09:08",
    isFavorite: false,
    isPinned: false,
    canLogin: false,
    forwardTo: null,
    category: "campaign",
  },
]

const users: UserRecord[] = [
  {
    id: 1,
    username: "admin",
    role: "admin",
    mailboxCount: 12,
    canSend: true,
    createdAt: "2026-02-01 09:00",
  },
  {
    id: 2,
    username: "guest",
    role: "user",
    mailboxCount: 3,
    canSend: false,
    createdAt: "2026-02-18 12:40",
  },
  {
    id: 3,
    username: "product-cn",
    role: "user",
    mailboxCount: 7,
    canSend: true,
    createdAt: "2026-03-02 18:15",
  },
]

const inboxTemplates = [
  {
    sender: "noreply@appleid.apple.com",
    subject: "Sample Inbox Text Message",
    preview: "这是收件箱的纯文本示例邮件，用于检查文本正文和验证码展示。",
    content:
      "这是收件箱的纯文本示例邮件。\n\nVerification Code: 642195\n\n请确认列表摘要、验证码提取和正文排版是否正常。",
    verificationCode: "642195",
  },
  {
    sender: "updates@notion.so",
    subject: "Sample Inbox HTML Message",
    preview: "这是收件箱的 HTML 示例邮件，用于检查 iframe 预览和 HTML 切换。",
    content:
      "这是一封带有 HTML 内容的收件示例邮件，同时保留文本回退内容。",
  },
]

const sentTemplates = [
  {
    recipients: "team@studio.dev",
    subject: "Sample Sent Text Message",
    preview: "这是发件箱的纯文本示例邮件，用于检查发件详情的文本展示。",
    content:
      "这是发件箱的纯文本示例邮件。\n\n用于验证发件列表、正文面板和时间信息的展示。",
    status: "delivered" as const,
  },
  {
    recipients: "qa@product.cn",
    subject: "Sample Sent HTML Message",
    preview: "这是发件箱的 HTML 示例邮件，用于检查已发送 HTML 内容预览。",
    content:
      "这是发件箱的 HTML 示例邮件，同时包含文本回退内容。",
    status: "queued" as const,
  },
]

function hashMailbox(mailbox: string) {
  return mailbox.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function createTimestamp(baseOffset: number) {
  const date = new Date(Date.UTC(2026, 2, 18, 8, 0 + baseOffset))
  return date.toISOString().replace("T", " ").slice(0, 16)
}

function buildInbox(mailbox: string) {
  const seed = hashMailbox(mailbox)

  return inboxTemplates.map((template, index) => {
    const content = `${template.content}\n\nMailbox: ${mailbox}`
    return {
      id: seed + index + 100,
      sender: template.sender,
      subject: template.subject,
      preview: template.preview,
      receivedAt: createTimestamp(index * 11),
      content,
      htmlContent:
        index === 1
          ? `<div style="font-family:Arial,sans-serif;padding:20px;background:#f5f8ff"><h2 style="margin:0 0 12px">${template.subject}</h2><p style="margin:0 0 10px">${content}</p><div style="padding:12px;border-radius:12px;background:#fff;border:1px solid #dbe6ff">HTML inbox sample for ${mailbox}</div></div>`
          : undefined,
      verificationCode: template.verificationCode,
    }
  })
}

function buildSent(mailbox: string) {
  const seed = hashMailbox(mailbox)

  return sentTemplates.map((template, index) => {
    const content = `${template.content}\n\nFrom mailbox: ${mailbox}`
    return {
      id: seed + index + 200,
      sender: mailbox,
      recipients: template.recipients,
      subject: template.subject,
      preview: template.preview,
      receivedAt: createTimestamp(index * 17 + 4),
      content,
      htmlContent:
        index === 1
          ? `<div style="font-family:Arial,sans-serif;padding:20px;background:#f7fbff"><h2 style="margin:0 0 12px">${template.subject}</h2><p style="margin:0">${content}</p></div>`
          : undefined,
      status: template.status,
    }
  })
}

export async function fetchDomains() {
  await delay(180)
  return domains
}

export async function fetchQuota() {
  await delay(260)
  return {
    limit: 20,
    used: mailboxRecords.length,
    remaining: 20 - mailboxRecords.length,
  }
}

export async function fetchMailboxes() {
  await delay(240)
  return mailboxRecords
}

export async function fetchInbox(mailbox: string) {
  await delay(320)
  return buildInbox(mailbox)
}

export async function fetchSent(mailbox: string) {
  await delay(280)
  return buildSent(mailbox)
}

export async function fetchUsers() {
  await delay(220)
  return users
}
