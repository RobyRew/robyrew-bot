import type { Inbound, Reply } from '@robyrew/bot-sdk'
import type { App } from './dispatch.ts'
import { handleInbound, runTicks } from './dispatch.ts'

const MAX_DOWNLOAD = 20 * 1024 * 1024

interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: { id: string; from: { id: number }; data?: string; message?: TgMessage }
}

interface TgMessage {
  message_id: number
  text?: string
  caption?: string
  chat: { id: number; type: string }
  from?: { id: number }
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number }
}

/** Long-polls Telegram and sends module replies. Logs stay in the dispatcher. */
export async function runTelegram(token: string, app: App): Promise<void> {
  let offset = 0
  for (;;) {
    try {
      const updates = await getUpdates(token, offset)
      for (const update of updates) {
        offset = update.update_id + 1
        const input = await toInbound(token, app, update)
        if (!input) continue
        const replies = await handleInbound(app, input)
        for (const reply of replies) await sendReply(token, input.chatId, reply)
      }
      const due = await runTicks(app, new Date())
      for (const message of due) {
        if (message.reply.kind === 'confirm') continue
        await sendReply(token, message.chatId, message.reply)
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }
}

async function getUpdates(token: string, offset: number): Promise<TgUpdate[]> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offset, timeout: 25 }),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { result?: TgUpdate[] }
  return data.result ?? []
}

async function toInbound(token: string, app: App, update: TgUpdate): Promise<Inbound | null> {
  if (update.callback_query) {
    const query = update.callback_query
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callback_query_id: query.id }),
    })
    const chat = query.message?.chat
    if (!chat) return null
    return base(app, chat, query.from.id, '', null, query.data ?? null, null)
  }
  const message = update.message
  if (!message) return null
  if (message.document) {
    if (message.document.file_size !== undefined && message.document.file_size > MAX_DOWNLOAD) {
      await sendReply(token, String(message.chat.id), { kind: 'text', text: 'That file is over 20 MB.' })
      return null
    }
    const file = await download(token, message.document.file_id)
    if (!file) return null
    return base(app, message.chat, message.from?.id ?? 0, message.caption ?? '', null, null, {
      filename: message.document.file_name ?? 'file.bin',
      mime: message.document.mime_type ?? 'application/octet-stream',
      body: file,
    })
  }
  const text = message.text ?? ''
  const command = text.startsWith('/') ? text.slice(1).split(/\s|@/)[0]?.toLowerCase() ?? null : null
  const args = command ? text.replace(/^\/\S+\s*/, '') : text
  return base(app, message.chat, message.from?.id ?? 0, text, command, null, null, args)
}

function base(
  app: App,
  chat: { id: number; type: string },
  userId: number,
  text: string,
  command: string | null,
  callback: string | null,
  file: Inbound['file'],
  args = '',
): Inbound {
  const id = String(userId)
  return {
    chatId: String(chat.id),
    userId: id,
    isGroup: chat.type !== 'private',
    lang: app.store.lang(id) ?? 'en',
    text,
    command,
    args: command ? args || text.replace(/^\/\S+\s*/, '') : text,
    callback,
    file,
    handle: null,
    now: new Date(),
  }
}

async function download(token: string, fileId: string): Promise<Uint8Array | null> {
  const meta = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  const data = (await meta.json()) as { result?: { file_path?: string } }
  const path = data.result?.file_path
  if (!path) return null
  const file = await fetch(`https://api.telegram.org/file/bot${token}/${path}`)
  if (!file.ok) return null
  return new Uint8Array(await file.arrayBuffer())
}

async function sendReply(token: string, chatId: string, reply: Reply): Promise<void> {
  if (reply.kind === 'confirm') return
  if (reply.kind === 'file') {
    const form = new FormData()
    form.set('chat_id', chatId)
    if (reply.caption) form.set('caption', reply.caption)
    form.set('document', new Blob([reply.body]), reply.filename)
    await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form })
    return
  }
  const keyboard = [
    ...(reply.buttons ?? []).map((button) => ({ text: button.label, callback_data: button.data })),
    ...(reply.links ?? []).map((link) => ({ text: link.label, url: link.url })),
  ]
  const body: Record<string, unknown> = { chat_id: chatId, text: reply.text }
  if (keyboard.length) body.reply_markup = { inline_keyboard: [keyboard] }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
