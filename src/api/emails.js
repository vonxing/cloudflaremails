/**
 * 邮件 API 模块
 * @module api/emails
 */

import { getJwtPayload, errorResponse, isStrictAdmin } from './helpers.js';
import { buildMockEmails, buildMockEmailDetail } from './mock.js';
import { extractEmail } from '../utils/common.js';
import { getMailboxIdByAddress, getOrCreateMailboxId, recordSentEmail } from '../db/index.js';
import { parseEmailBody } from '../email/parser.js';

function buildPreview(content = '', htmlContent = '') {
  const plain = String(content || '').trim() || String(htmlContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.slice(0, 120);
}

function buildSampleInboxEntries(mailbox) {
  const now = Date.now();
  const textContent = [
    "这是一个纯文本收件示例。",
    "",
    `Mailbox: ${mailbox}`,
    "Verification Code: 481205",
    "",
    "这封邮件用于检查纯文本正文、列表摘要和验证码提取的展示效果。",
  ].join("\n");

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;padding:24px;background:#f5f8ff;color:#10213a;">
      <h2 style="margin:0 0 12px;font-size:24px;">HTML Inbox Sample</h2>
      <p style="margin:0 0 12px;">当前邮箱 <strong>${mailbox}</strong> 已收到一封 HTML 示例邮件。</p>
      <p style="margin:0 0 12px;">本邮件用于验证 iframe 预览、正文铺满和摘要截断效果。</p>
      <div style="padding:12px 14px;border-radius:14px;background:white;border:1px solid #d8e5ff;">
        <div style="font-size:12px;color:#58709a;letter-spacing:.08em;text-transform:uppercase;">Status</div>
        <div style="margin-top:6px;font-size:16px;font-weight:700;">HTML Preview Ready</div>
      </div>
    </div>
  `.trim();

  return [
    {
      sender: "alerts@cloudflaremail.dev",
      subject: "Sample Inbox Text Message",
      verificationCode: "481205",
      content: textContent,
      htmlContent: "",
      preview: buildPreview(textContent, ""),
      receivedAt: new Date(now - 2 * 60 * 1000).toISOString(),
    },
    {
      sender: "design@apple-notify.example",
      subject: "Sample Inbox HTML Message",
      verificationCode: null,
      content: "This is the text fallback for the HTML inbox sample.",
      htmlContent,
      preview: buildPreview("This is the text fallback for the HTML inbox sample.", htmlContent),
      receivedAt: new Date(now - 1 * 60 * 1000).toISOString(),
    },
  ];
}

function buildSampleSentEntries(mailbox) {
  const now = Date.now();
  const sentText = [
    "Hello team,",
    "",
    "This is a plain text sample from the sent mailbox.",
    "It is used to verify the sent detail panel and text rendering.",
    "",
    `From: ${mailbox}`,
  ].join("\n");

  const sentHtml = `
    <div style="font-family:Arial,sans-serif;padding:24px;background:#f7fbff;color:#10213a;">
      <h2 style="margin:0 0 12px;font-size:24px;">HTML Sent Sample</h2>
      <p style="margin:0 0 12px;">This message demonstrates the sent mailbox HTML detail flow.</p>
      <p style="margin:0 0 16px;">From mailbox: <strong>${mailbox}</strong></p>
      <a href="https://example.com" style="display:inline-block;padding:10px 14px;border-radius:12px;background:#295bff;color:#fff;text-decoration:none;">Open Example</a>
    </div>
  `.trim();

  return [
    {
      to: "product@example.com",
      subject: "Sample Sent Text Message",
      text: sentText,
      html: "",
      status: "delivered",
      createdAt: new Date(now - 3 * 60 * 1000).toISOString(),
    },
    {
      to: "design@example.com",
      subject: "Sample Sent HTML Message",
      text: "This is the text fallback for the HTML sent sample.",
      html: sentHtml,
      status: "delivered",
      createdAt: new Date(now - 90 * 1000).toISOString(),
    },
  ];
}

/**
 * 处理邮件相关 API
 * @param {Request} request - HTTP 请求
 * @param {object} db - 数据库连接
 * @param {URL} url - 请求 URL
 * @param {string} path - 请求路径
 * @param {object} options - 选项
 * @returns {Promise<Response|null>} 响应或 null（未匹配）
 */
export async function handleEmailsApi(request, db, url, path, options) {
  const isMock = !!options.mockOnly;
  const isMailboxOnly = !!options.mailboxOnly;
  const r2 = options.r2;

  if (path === '/api/emails/seed-samples' && request.method === 'POST') {
    if (isMock) return errorResponse('演示模式不可注入示例邮件', 403);
    if (!isStrictAdmin(request, options)) return errorResponse('仅管理员可生成示例邮件', 403);

    try {
      const body = await request.json().catch(() => ({}));
      const mailbox = extractEmail(body?.mailbox || '').trim().toLowerCase();
      if (!mailbox) {
        return errorResponse('缺少 mailbox 参数', 400);
      }

      const mailboxId = await getOrCreateMailboxId(db, mailbox);
      const inboxEntries = buildSampleInboxEntries(mailbox);
      const sentEntries = buildSampleSentEntries(mailbox);

      for (const item of inboxEntries) {
        await db.prepare(`
          INSERT INTO messages (
            mailbox_id, sender, to_addrs, subject, verification_code, preview, content, html_content, r2_bucket, r2_object_key, received_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          mailboxId,
          item.sender,
          mailbox,
          item.subject,
          item.verificationCode,
          item.preview,
          item.content,
          item.htmlContent || null,
          'mail-eml',
          '',
          item.receivedAt,
        ).run();
      }

      for (const item of sentEntries) {
        await recordSentEmail(db, {
          resendId: null,
          fromName: 'Sample Mailer',
          from: mailbox,
          to: item.to,
          subject: item.subject,
          html: item.html || null,
          text: item.text || null,
          status: item.status,
          scheduledAt: null,
        });

        await db.prepare(`
          UPDATE sent_emails
          SET created_at = ?, updated_at = ?
          WHERE id = (SELECT MAX(id) FROM sent_emails WHERE from_addr = ?)
        `).bind(item.createdAt, item.createdAt, mailbox).run();
      }

      return Response.json({
        success: true,
        mailbox,
        inboxCreated: inboxEntries.length,
        sentCreated: sentEntries.length,
      });
    } catch (e) {
      console.error('生成示例邮件失败:', e);
      return errorResponse('生成示例邮件失败', 500);
    }
  }

  // 获取邮件列表
  if (path === '/api/emails' && request.method === 'GET') {
    const mailbox = url.searchParams.get('mailbox');
    if (!mailbox) {
      return errorResponse('缺少 mailbox 参数', 400);
    }
    try {
      if (isMock) {
        return Response.json(buildMockEmails(6));
      }
      const normalized = extractEmail(mailbox).trim().toLowerCase();
      const mailboxId = await getMailboxIdByAddress(db, normalized);
      if (!mailboxId) return Response.json([]);
      
      let timeFilter = '';
      let timeParam = [];
      if (isMailboxOnly) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        timeFilter = ' AND received_at >= ?';
        timeParam = [twentyFourHoursAgo];
      }
      
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
      
      try {
        const { results } = await db.prepare(`
          SELECT id, sender, subject, received_at, is_read, preview, verification_code
          FROM messages 
          WHERE mailbox_id = ?${timeFilter}
          ORDER BY received_at DESC 
          LIMIT ?
        `).bind(mailboxId, ...timeParam, limit).all();
        return Response.json(results);
      } catch (e) {
        const { results } = await db.prepare(`
          SELECT id, sender, subject, received_at, is_read,
                 CASE WHEN content IS NOT NULL AND content <> ''
                      THEN SUBSTR(content, 1, 120)
                      ELSE SUBSTR(COALESCE(html_content, ''), 1, 120)
                 END AS preview
          FROM messages 
          WHERE mailbox_id = ?${timeFilter}
          ORDER BY received_at DESC 
          LIMIT ?
        `).bind(mailboxId, ...timeParam, limit).all();
        return Response.json(results);
      }
    } catch (e) {
      console.error('查询邮件失败:', e);
      return errorResponse('查询邮件失败', 500);
    }
  }

  // 批量查询邮件详情
  if (path === '/api/emails/batch' && request.method === 'GET') {
    try {
      const idsParam = String(url.searchParams.get('ids') || '').trim();
      if (!idsParam) return Response.json([]);
      const ids = idsParam.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
      if (!ids.length) return Response.json([]);
      
      if (ids.length > 50) {
        return errorResponse('单次最多查询50封邮件', 400);
      }
      
      if (isMock) {
        const arr = ids.map(id => buildMockEmailDetail(id));
        return Response.json(arr);
      }
      
      let timeFilter = '';
      let timeParam = [];
      if (isMailboxOnly) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        timeFilter = ' AND received_at >= ?';
        timeParam = [twentyFourHoursAgo];
      }
      
      const placeholders = ids.map(() => '?').join(',');
      try {
        const { results } = await db.prepare(`
          SELECT id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key, received_at, is_read
          FROM messages WHERE id IN (${placeholders})${timeFilter}
        `).bind(...ids, ...timeParam).all();
        return Response.json(results || []);
      } catch (e) {
        const { results } = await db.prepare(`
          SELECT id, sender, subject, content, html_content, received_at, is_read
          FROM messages WHERE id IN (${placeholders})${timeFilter}
        `).bind(...ids, ...timeParam).all();
        return Response.json(results || []);
      }
    } catch (e) {
      return errorResponse('批量查询失败', 500);
    }
  }

  // 清空邮箱邮件
  if (request.method === 'DELETE' && path === '/api/emails') {
    if (isMock) return errorResponse('演示模式不可清空', 403);
    const mailbox = url.searchParams.get('mailbox');
    if (!mailbox) {
      return errorResponse('缺少 mailbox 参数', 400);
    }
    try {
      const normalized = extractEmail(mailbox).trim().toLowerCase();
      const mailboxId = await getMailboxIdByAddress(db, normalized);
      if (!mailboxId) {
        return Response.json({ success: true, deletedCount: 0 });
      }
      
      const result = await db.prepare(`DELETE FROM messages WHERE mailbox_id = ?`).bind(mailboxId).run();
      const deletedCount = result?.meta?.changes || 0;
      
      return Response.json({
        success: true,
        deletedCount
      });
    } catch (e) {
      console.error('清空邮件失败:', e);
      return errorResponse('清空邮件失败', 500);
    }
  }

  // 下载 EML（从 R2 获取）- 必须在通用邮件详情处理器之前
  if (request.method === 'GET' && path.startsWith('/api/email/') && path.endsWith('/download')) {
    if (options.mockOnly) return errorResponse('演示模式不可下载', 403);
    const id = path.split('/')[3];
    const { results } = await db.prepare('SELECT r2_bucket, r2_object_key FROM messages WHERE id = ?').bind(id).all();
    const row = (results || [])[0];
    if (!row || !row.r2_object_key) return errorResponse('未找到对象', 404);
    try {
      if (!r2) return errorResponse('R2 未绑定', 500);
      const obj = await r2.get(row.r2_object_key);
      if (!obj) return errorResponse('对象不存在', 404);
      const headers = new Headers({ 'Content-Type': 'message/rfc822' });
      headers.set('Content-Disposition', `attachment; filename="${String(row.r2_object_key).split('/').pop()}"`);
      return new Response(obj.body, { headers });
    } catch (e) {
      return errorResponse('下载失败', 500);
    }
  }

  // 获取单封邮件详情
  if (request.method === 'GET' && path.startsWith('/api/email/')) {
    const emailId = path.split('/')[3];
    if (isMock) {
      return Response.json(buildMockEmailDetail(emailId));
    }
    try {
      let timeFilter = '';
      let timeParam = [];
      if (isMailboxOnly) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        timeFilter = ' AND received_at >= ?';
        timeParam = [twentyFourHoursAgo];
      }
      
      const { results } = await db.prepare(`
        SELECT id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key, received_at, is_read
        FROM messages WHERE id = ?${timeFilter}
      `).bind(emailId, ...timeParam).all();
      if (results.length === 0) {
        if (isMailboxOnly) {
          return errorResponse('邮件不存在或已超过24小时访问期限', 404);
        }
        return errorResponse('未找到邮件', 404);
      }
      await db.prepare(`UPDATE messages SET is_read = 1 WHERE id = ?`).bind(emailId).run();
      const row = results[0];
      let content = '';
      let html_content = '';
      
      try {
        if (row.r2_object_key && r2) {
          const obj = await r2.get(row.r2_object_key);
          if (obj) {
            let raw = '';
            if (typeof obj.text === 'function') raw = await obj.text();
            else if (typeof obj.arrayBuffer === 'function') raw = await new Response(await obj.arrayBuffer()).text();
            else raw = await new Response(obj.body).text();
            const parsed = parseEmailBody(raw || '');
            content = parsed.text || '';
            html_content = parsed.html || '';
          }
        }
      } catch (_) { }

      if ((!content && !html_content)) {
        try {
          const fallback = await db.prepare('SELECT content, html_content FROM messages WHERE id = ?').bind(emailId).all();
          const fr = (fallback?.results || [])[0] || {};
          content = content || fr.content || '';
          html_content = html_content || fr.html_content || '';
        } catch (_) { }
      }

      return Response.json({ ...row, content, html_content, download: row.r2_object_key ? `/api/email/${emailId}/download` : '' });
    } catch (e) {
      const { results } = await db.prepare(`
        SELECT id, sender, subject, content, html_content, received_at, is_read
        FROM messages WHERE id = ?
      `).bind(emailId).all();
      if (!results || !results.length) return errorResponse('未找到邮件', 404);
      await db.prepare(`UPDATE messages SET is_read = 1 WHERE id = ?`).bind(emailId).run();
      return Response.json(results[0]);
    }
  }

  // 删除单封邮件
  if (request.method === 'DELETE' && path.startsWith('/api/email/')) {
    if (isMock) return errorResponse('演示模式不可删除', 403);
    const emailId = path.split('/')[3];
    
    if (!emailId || !Number.isInteger(parseInt(emailId))) {
      return errorResponse('无效的邮件ID', 400);
    }
    
    try {
      const result = await db.prepare(`DELETE FROM messages WHERE id = ?`).bind(emailId).run();
      const deleted = (result?.meta?.changes || 0) > 0;
      
      return Response.json({
        success: true,
        deleted,
        message: deleted ? '邮件已删除' : '邮件不存在或已被删除'
      });
    } catch (e) {
      console.error('删除邮件失败:', e);
      return errorResponse('删除邮件时发生错误: ' + e.message, 500);
    }
  }

  return null;
}
