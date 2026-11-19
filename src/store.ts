import { DatabaseSync } from 'node:sqlite'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Lang, ModuleApi } from '@robyrew/bot-sdk'

export class Store {
  readonly db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        lang TEXT,
        handle TEXT,
        banned INTEGER NOT NULL DEFAULT 0,
        private_chat TEXT
      );
      CREATE TABLE IF NOT EXISTS kv (
        user_id TEXT NOT NULL,
        module TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (user_id, module, key)
      );
      CREATE TABLE IF NOT EXISTS rate (
        user_id TEXT NOT NULL,
        bucket TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (user_id, bucket)
      );
      CREATE TABLE IF NOT EXISTS confirm (
        user_id TEXT PRIMARY KEY,
        module TEXT NOT NULL,
        phrase TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `)
  }

  close(): void {
    this.db.close()
  }

  private ensure(id: string): void {
    this.db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(id)
  }

  lang(id: string): Lang | null {
    const row = this.db.prepare('SELECT lang FROM users WHERE id = ?').get(id) as { lang: string | null } | undefined
    if (row?.lang === 'en' || row?.lang === 'ro' || row?.lang === 'es') return row.lang
    return null
  }

  setLang(id: string, lang: Lang): void {
    this.ensure(id)
    this.db.prepare('UPDATE users SET lang = ? WHERE id = ?').run(lang, id)
  }

  handle(id: string): string | null {
    const row = this.db.prepare('SELECT handle FROM users WHERE id = ?').get(id) as { handle: string | null } | undefined
    return row?.handle ?? null
  }

  setHandle(id: string, handle: string): void {
    this.ensure(id)
    this.db.prepare('UPDATE users SET handle = ? WHERE id = ?').run(handle, id)
  }

  banned(id: string): boolean {
    const row = this.db.prepare('SELECT banned FROM users WHERE id = ?').get(id) as { banned: number } | undefined
    return row?.banned === 1
  }

  setBanned(id: string, banned: boolean): void {
    this.ensure(id)
    this.db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, id)
  }

  rememberPrivateChat(id: string, chatId: string): void {
    this.ensure(id)
    this.db.prepare('UPDATE users SET private_chat = ? WHERE id = ?').run(chatId, id)
  }

  privateChat(id: string): string | null {
    const row = this.db.prepare('SELECT private_chat FROM users WHERE id = ?').get(id) as { private_chat: string | null } | undefined
    return row?.private_chat ?? null
  }

  /** Returns false when the bucket is already full for this window. */
  hit(id: string, bucket: string, limit: number, windowMs: number, now: number): boolean {
    const row = this.db.prepare('SELECT window_start, count FROM rate WHERE user_id = ? AND bucket = ?').get(id, bucket) as
      | { window_start: number; count: number }
      | undefined
    if (!row || now - row.window_start >= windowMs) {
      this.db.prepare(
        'INSERT INTO rate (user_id, bucket, window_start, count) VALUES (?, ?, ?, 1) ON CONFLICT (user_id, bucket) DO UPDATE SET window_start = ?, count = 1',
      ).run(id, bucket, now, now)
      return true
    }
    if (row.count >= limit) return false
    this.db.prepare('UPDATE rate SET count = count + 1 WHERE user_id = ? AND bucket = ?').run(id, bucket)
    return true
  }

  get(module: string, userId: string, key: string): string | null {
    const row = this.db.prepare('SELECT value FROM kv WHERE module = ? AND user_id = ? AND key = ?').get(module, userId, key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  set(module: string, userId: string, key: string, value: string): void {
    this.db.prepare(
      'INSERT INTO kv (user_id, module, key, value) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, module, key) DO UPDATE SET value = ?',
    ).run(userId, module, key, value, value)
  }

  del(module: string, userId: string, key: string): void {
    this.db.prepare('DELETE FROM kv WHERE module = ? AND user_id = ? AND key = ?').run(module, userId, key)
  }

  usersWith(module: string, key: string): string[] {
    const rows = this.db.prepare('SELECT user_id FROM kv WHERE module = ? AND key = ?').all(module, key) as { user_id: string }[]
    return rows.map((r) => r.user_id)
  }

  api(module: string, userId: string, now: Date): ModuleApi {
    return {
      now,
      get: (key) => this.get(module, userId, key),
      set: (key, value) => this.set(module, userId, key, value),
      del: (key) => this.del(module, userId, key),
      usersWith: (key) => this.usersWith(module, key),
      getFor: (id, key) => this.get(module, id, key),
      setFor: (id, key, value) => this.set(module, id, key, value),
      privateChat: (id) => this.privateChat(id),
    }
  }

  /** Api that can read every user. Ticks use this with user id "*". */
  apiAll(module: string, now: Date): ModuleApi {
    return this.api(module, '*', now)
  }

  setConfirm(userId: string, module: string, phrase: string, payload: string): void {
    this.db.prepare(
      'INSERT INTO confirm (user_id, module, phrase, payload) VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET module = ?, phrase = ?, payload = ?',
    ).run(userId, module, phrase, payload, module, phrase, payload)
  }

  takeConfirm(userId: string): { module: string; phrase: string; payload: string } | null {
    const row = this.db.prepare('SELECT module, phrase, payload FROM confirm WHERE user_id = ?').get(userId) as
      | { module: string; phrase: string; payload: string }
      | undefined
    return row ?? null
  }

  clearConfirm(userId: string): void {
    this.db.prepare('DELETE FROM confirm WHERE user_id = ?').run(userId)
  }
}

/** AES-256-GCM. The password never enters this function; only the portal token does. */
export function seal(key: Buffer, plain: string): string {
  if (key.length !== 32) throw new Error('SESSION_ENCRYPTION_KEY must be 32 bytes')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function open(key: Buffer, packed: string): string {
  if (key.length !== 32) throw new Error('SESSION_ENCRYPTION_KEY must be 32 bytes')
  const buf = Buffer.from(packed, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

export function keyFromHex(hex: string): Buffer {
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error('SESSION_ENCRYPTION_KEY must be 64 hex characters')
  return key
}
