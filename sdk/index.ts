/** Languages the bot speaks. Slash commands stay English. */
export type Lang = 'en' | 'ro' | 'es'

export interface Button {
  /** Callback data. Kept short; Telegram allows 64 bytes. */
  data: string
  label: string
}

export interface UrlButton {
  url: string
  label: string
}

export type Reply =
  | {
      kind: 'text'
      text: string
      buttons?: Button[]
      links?: UrlButton[]
      /** Missed-call alerts set this so quiet hours do not hold them. */
      urgent?: boolean
    }
  | {
      kind: 'file'
      filename: string
      mime: string
      body: Uint8Array
      caption?: string
    }
  | {
      kind: 'confirm'
      /** The exact word the person must send next. Unlock uses UNLOCK. */
      phrase: string
      payload: string
      prompt: string
    }

export interface InboundFile {
  filename: string
  mime: string
  body: Uint8Array
}

export interface Inbound {
  chatId: string
  userId: string
  isGroup: boolean
  lang: Lang
  text: string
  command: string | null
  args: string
  callback: string | null
  file: InboundFile | null
  /** RobyRew @handle after Logto, otherwise null. */
  handle: string | null
  now: Date
}

/** Per-user storage scoped to one module by the host. */
export interface ModuleApi {
  now: Date
  get(key: string): string | null
  set(key: string, value: string): void
  del(key: string): void
  /** User ids that stored `key` in this module. */
  usersWith(key: string): string[]
  getFor(userId: string, key: string): string | null
  setFor(userId: string, key: string, value: string): void
  /** Last private chat for a user, used by digests. */
  privateChat(userId: string): string | null
}

export interface TickMessage {
  userId: string
  chatId: string
  reply: Reply
}

export interface BotModule {
  id: string
  commands: readonly string[]
  /** Lookup commands share the 30/minute bucket. File commands have their own. */
  bucket: 'lookup' | 'ppt' | 'convert' | 'none'
  signIn: 'no' | 'some' | 'yes'
  menu(lang: Lang): string
  help(lang: Lang): string
  handle(input: Inbound, api: ModuleApi): Promise<Reply | Reply[] | null>
  /** Called when the person sends the confirmation phrase. */
  confirm?(input: Inbound, api: ModuleApi, payload: string): Promise<Reply | Reply[] | null>
  /** Scheduler entry. Digests should only emit during the 08:00 Madrid hour. */
  tick?(api: ModuleApi, now: Date): Promise<TickMessage[]>
}

export function tr(lang: Lang, text: Record<Lang, string>): string {
  return text[lang]
}

export interface MadridClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** YYYY-MM-DD in Europe/Madrid. */
  date: string
}

/** Wall clock in Europe/Madrid. The formatter carries DST. */
export function madrid(now: Date): MadridClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  const hour = pick('hour')
  const minute = pick('minute')
  const date = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  return { year, month, day, hour, minute, date }
}

/** 22:00–08:00 Europe/Madrid. The 08:00 hour is outside quiet hours. */
export function isQuiet(now: Date): boolean {
  const { hour } = madrid(now)
  return hour >= 22 || hour < 8
}

/** True during the 08:00 hour, when held digests go out. */
export function isDigestHour(now: Date): boolean {
  return madrid(now).hour === 8
}
