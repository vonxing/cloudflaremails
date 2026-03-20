/**
 * 演示模式数据模块
 * @module api/mock
 */

// 演示模式邮箱域名
export const MOCK_DOMAINS = ['exa.cc', 'exr.yp', 'duio.ty'];

/**
 * 初始化演示模式用户数据
 */
export function initMockUsers() {
  if (!globalThis.__MOCK_USERS__) {
    const now = new Date();
    globalThis.__MOCK_USERS__ = [
      { id: 1, username: 'demo1', role: 'user', can_send: 0, mailbox_limit: 5, created_at: now.toISOString().replace('T', ' ').slice(0, 19) },
      { id: 2, username: 'demo2', role: 'user', can_send: 0, mailbox_limit: 8, created_at: now.toISOString().replace('T', ' ').slice(0, 19) },
      { id: 3, username: 'operator', role: 'admin', can_send: 0, mailbox_limit: 20, created_at: now.toISOString().replace('T', ' ').slice(0, 19) },
    ];
    globalThis.__MOCK_USER_MAILBOXES__ = new Map();
    
    // 为每个演示用户预生成若干邮箱
    try {
      for (const u of globalThis.__MOCK_USERS__) {
        const maxCount = Math.min(u.mailbox_limit || 10, 8);
        const minCount = Math.min(3, maxCount);
        const count = Math.max(minCount, Math.min(maxCount, Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount));
        const boxes = buildMockMailboxes(count, 0, MOCK_DOMAINS);
        globalThis.__MOCK_USER_MAILBOXES__.set(u.id, boxes);
      }
    } catch (_) {
      // 忽略演示数据预生成失败
    }
    globalThis.__MOCK_USER_LAST_ID__ = 3;
  }
}

/**
 * 生成模拟邮件列表
 * @param {number} count - 邮件数量
 * @returns {Array<object>} 模拟邮件列表
 */
export function buildMockEmails(count = 5) {
  const samples = [
    {
      id: 1000,
      sender: 'support@example.com',
      subject: '[演示数据] 收件 Text 示例',
      received_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      is_read: 0,
      preview: '这是一封纯文本收件示例邮件，用于展示正文和验证码。',
      verification_code: '123456'
    },
    {
      id: 1001,
      sender: 'noreply@service.com',
      subject: '[演示数据] 收件 HTML 示例',
      received_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      is_read: 0,
      preview: '这是一封 HTML 收件示例邮件，用于展示 iframe 预览。',
      verification_code: null
    },
    {
      id: 1002,
      sender: 'admin@mock.test',
      subject: '[演示数据] 密码重置请求',
      received_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      is_read: 1,
      preview: '您请求重置密码，请点击链接继续操作。',
      verification_code: null
    },
    {
      id: 1003,
      sender: 'alerts@mock.test',
      subject: '[演示数据] 账户安全提醒',
      received_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      is_read: 1,
      preview: '检测到您的账户有异常登录，请及时确认。',
      verification_code: null
    }
  ];

  return samples.slice(0, count);
}

/**
 * 生成模拟邮箱列表
 * @param {number} count - 邮箱数量
 * @param {number} offset - 偏移量
 * @param {Array<string>} domains - 域名列表
 * @returns {Array<object>} 模拟邮箱列表
 */
export function buildMockMailboxes(count = 5, offset = 0, domains = MOCK_DOMAINS) {
  const mailboxes = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const idx = offset + i;
    const domain = domains[idx % domains.length];
    const local = `demo${String(idx + 1).padStart(3, '0')}`;
    
    mailboxes.push({
      id: 2000 + idx,
      address: `${local}@${domain}`,
      created_at: new Date(now - idx * 86400000).toISOString().replace('T', ' ').slice(0, 19),
      is_pinned: idx < 2 ? 1 : 0,
      password_is_default: 1,
      can_login: 0,
      forward_to: null,
      is_favorite: idx < 1 ? 1 : 0
    });
  }
  
  return mailboxes;
}

/**
 * 生成模拟邮件详情
 * @param {number|string} emailId - 邮件ID
 * @returns {object} 模拟邮件详情
 */
export function buildMockEmailDetail(emailId) {
  const id = Number(emailId);
  if (id === 1001) {
    return {
      id,
      sender: 'noreply@service.com',
      to_addrs: 'demo@exa.cc',
      subject: '[演示数据] 收件 HTML 示例',
      verification_code: null,
      preview: '这是演示邮件的 HTML 预览内容...',
      content: '这是 HTML 收件示例的文本回退内容。',
      html_content: '<div style="padding:20px;background:#f7fbff"><h2>收件 HTML 示例</h2><p>这是一封用于展示 HTML 邮件预览的演示数据。</p></div>',
      received_at: new Date().toISOString(),
      is_read: 1,
      r2_bucket: null,
      r2_object_key: null
    };
  }

  return {
    id,
    sender: 'support@example.com',
    to_addrs: 'demo@exa.cc',
    subject: '[演示数据] 收件 Text 示例',
    verification_code: '123456',
    preview: '这是演示邮件的内容预览...',
    content: '这是演示邮件的纯文本内容。\n\n您的验证码是：123456\n\n请在5分钟内使用。',
    html_content: '<div style="padding:20px;"><h2>演示邮件</h2><p>您的验证码是：<strong>123456</strong></p><p>请在5分钟内使用。</p></div>',
    received_at: new Date().toISOString(),
    is_read: 1,
    r2_bucket: null,
    r2_object_key: null
  };
}

export function buildMockSentEmails() {
  const now = Date.now();
  return [
    {
      id: 2000,
      recipients: 'team@example.com',
      subject: '[演示数据] 发件 Text 示例',
      created_at: new Date(now - 2 * 3600000).toISOString(),
      status: 'delivered'
    },
    {
      id: 2001,
      recipients: 'design@example.com',
      subject: '[演示数据] 发件 HTML 示例',
      created_at: new Date(now - 1 * 3600000).toISOString(),
      status: 'delivered'
    }
  ];
}

export function buildMockSentEmailDetail(id) {
  const mailId = Number(id);
  if (mailId === 2001) {
    return {
      id: mailId,
      resend_id: null,
      from_addr: 'demo@exa.cc',
      recipients: 'design@example.com',
      subject: '[演示数据] 发件 HTML 示例',
      html_content: '<div style="padding:20px;background:#f7fbff"><h2>发件 HTML 示例</h2><p>这是一封已发送 HTML 示例邮件。</p></div>',
      text_content: '这是已发送 HTML 示例邮件的文本回退内容。',
      status: 'delivered',
      scheduled_at: null,
      created_at: new Date().toISOString()
    };
  }

  return {
    id: mailId,
    resend_id: null,
    from_addr: 'demo@exa.cc',
    recipients: 'team@example.com',
    subject: '[演示数据] 发件 Text 示例',
    html_content: null,
    text_content: '这是已发送纯文本示例邮件，用于展示发件箱详情。',
    status: 'delivered',
    scheduled_at: null,
    created_at: new Date().toISOString()
  };
}
