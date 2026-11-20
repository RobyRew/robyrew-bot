import type { BotModule, Inbound, Reply, TickMessage } from '@robyrew/bot-sdk'
import { helpReply, hostText, languageAsk, menuReply } from './i18n.ts'
import { isQuiet } from './quiet.ts'
import { Store } from './store.ts'

const LIMITS: Record<BotModule['bucket'], { limit: number; windowMs: number } | null> = {
  lookup: { limit: 30, windowMs: 60_000 },
  ppt: { limit: 5, windowMs: 60 * 60_000 },
  convert: { limit: 10, windowMs: 60 * 60_000 },
  none: null,
}

export interface App {
  store: Store
  modules: BotModule[]
  adminId: string | null
  /** Public origin for the Logto start link. Empty when sign-in is not configured. */
  publicBase: string
  log: (command: string, userId: string) => void
}

export function createApp(opts: Partial<App> & { store: Store; modules: BotModule[] }): App {
  return {
    store: opts.store,
    modules: opts.modules,
    adminId: opts.adminId ?? null,
    publicBase: opts.publicBase ?? '',
    log: opts.log ?? (() => {}),
  }
}

function asList(reply: Reply | Reply[] | null): Reply[] {
  if (!reply) return []
  return Array.isArray(reply) ? reply : [reply]
}

function commandOf(input: Inbound): { name: string; args: string } | null {
  if (input.callback?.startsWith('cmd:')) {
    const name = input.callback.slice(4)
    return { name, args: '' }
  }
  if (input.command) return { name: input.command, args: input.args }
  return null
}

function findModule(modules: readonly BotModule[], name: string): BotModule | undefined {
  return modules.find((m) => m.commands.includes(name))
}

export async function handleInbound(app: App, input: Inbound): Promise<Reply[]> {
  if (!input.isGroup) app.store.rememberPrivateChat(input.userId, input.chatId)
  if (app.store.banned(input.userId)) {
    app.log('banned', input.userId)
    return [{ kind: 'text', text: hostText(input.lang, 'banned') }]
  }

  if (input.callback?.startsWith('lang:')) {
    const picked = input.callback.slice(5)
    if (picked === 'en' || picked === 'ro' || picked === 'es') {
      app.store.setLang(input.userId, picked)
      app.log('lang', input.userId)
      return [menuReply(picked, app.modules)]
    }
  }

  const saved = app.store.lang(input.userId)
  if (!saved && !input.isGroup) {
    return [languageAsk()]
  }
  const lang = saved ?? 'en'
  const msg: Inbound = { ...input, lang, handle: app.store.handle(input.userId) }

  const pending = app.store.takeConfirm(input.userId)
  const requested = commandOf(msg)
  if (pending && !requested && msg.text.trim() === pending.phrase) {
    const mod = app.modules.find((m) => m.id === pending.module)
    app.store.clearConfirm(input.userId)
    if (!mod?.confirm) return []
    app.log(`confirm:${mod.id}`, input.userId)
    return asList(await mod.confirm(msg, app.store.api(mod.id, input.userId, msg.now), pending.payload))
  }
  if (pending && !requested) {
    return [{ kind: 'text', text: `${pending.phrase}\n${hostText(lang, 'confirmWait')}` }]
  }
  if (pending && requested) app.store.clearConfirm(input.userId)

  if (requested?.name === 'start' || requested?.name === 'help') {
    app.log(requested.name, input.userId)
    if (requested.name === 'start') return [menuReply(lang, app.modules)]
    return [helpReply(lang, app.modules)]
  }
  if (requested?.name === 'lang') return [languageAsk()]

  if (requested?.name === 'admin') {
    return adminReplies(app, msg, requested.args)
  }

  // A file with no command goes to PowerPoint or to convert when one is waiting.
  let mod = requested ? findModule(app.modules, requested.name) : undefined
  let args = requested?.args ?? ''
  if (!mod && msg.file && app.store.get('convert', msg.userId, 'expect') === 'file') {
    mod = findModule(app.modules, 'convert')
    args = ''
  }
  if (!mod && msg.file) {
    mod = findModule(app.modules, 'ppt')
    args = ''
  }
  if (!mod && msg.callback) {
    const id = msg.callback.split(':')[0]
    mod = app.modules.find((m) => m.id === id)
  }
  if (!mod) {
    const blob = `${msg.text}\n${args}`
    if (/https?:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(blob)) {
      mod = findModule(app.modules, 'linkedin')
      args = blob
    } else if (/https?:\/\/open\.spotify\.com\//i.test(blob)) {
      mod = findModule(app.modules, 'spotify')
      args = blob
    } else if (/https?:\/\/|geo:|\d+\.\d+\s*,\s*-?\d+/.test(blob)) {
      mod = findModule(app.modules, 'map')
      args = blob
    }
  }
  if (!mod) return [{ kind: 'text', text: hostText(lang, 'unknown') }]

  if (mod.signIn === 'yes' && !msg.handle) return [signInReply(app, lang)]

  const limit = LIMITS[mod.bucket]
  if (limit && !app.store.hit(msg.userId, mod.bucket, limit.limit, limit.windowMs, msg.now.getTime())) {
    app.log(`rate:${mod.id}`, msg.userId)
    return [{ kind: 'text', text: hostText(lang, 'rate') }]
  }

  app.log(mod.commands[0] ?? mod.id, msg.userId)
  const replies = asList(await mod.handle({ ...msg, command: requested?.name ?? mod.commands[0] ?? null, args }, app.store.api(mod.id, msg.userId, msg.now)))
  const out: Reply[] = []
  for (const reply of replies) {
    if (reply.kind === 'confirm') {
      app.store.setConfirm(msg.userId, mod.id, reply.phrase, reply.payload)
      out.push({ kind: 'text', text: reply.prompt })
    } else {
      out.push(reply)
    }
  }
  return out
}

function signInReply(app: App, lang: Inbound['lang']): Reply {
  if (!app.publicBase) return { kind: 'text', text: hostText(lang, 'signInMissing') }
  return {
    kind: 'text',
    text: hostText(lang, 'signIn'),
    links: [{ url: `${app.publicBase.replace(/\/$/, '')}/login`, label: 'Logto' }],
  }
}

function adminReplies(app: App, msg: Inbound, args: string): Reply[] {
  if (msg.isGroup) return [{ kind: 'text', text: hostText(msg.lang, 'adminOnly') }]
  if (!app.adminId || msg.userId !== app.adminId) return [{ kind: 'text', text: hostText(msg.lang, 'adminNo') }]
  const [sub, id] = args.trim().split(/\s+/)
  if (sub === 'ban' && id) {
    app.store.setBanned(id, true)
    app.log('admin:ban', msg.userId)
    return [{ kind: 'text', text: `banned ${id}` }]
  }
  if (sub === 'unban' && id) {
    app.store.setBanned(id, false)
    app.log('admin:unban', msg.userId)
    return [{ kind: 'text', text: `unbanned ${id}` }]
  }
  app.log('admin', msg.userId)
  return [{ kind: 'text', text: '/admin ban <telegram id>\n/admin unban <telegram id>' }]
}

/** Digests respect quiet hours. A reply with urgent set still leaves. */
export async function runTicks(app: App, now: Date): Promise<TickMessage[]> {
  const out: TickMessage[] = []
  for (const mod of app.modules) {
    if (!mod.tick) continue
    const batch = await mod.tick(app.store.apiAll(mod.id, now), now)
    for (const item of batch) {
      const urgent = item.reply.kind === 'text' && item.reply.urgent === true
      if (isQuiet(now) && !urgent) continue
      out.push(item)
    }
  }
  return out
}
