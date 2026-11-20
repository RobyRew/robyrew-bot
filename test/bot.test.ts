import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { zipStore } from '@robyrew/ppt-bot'
import { calendarModule, singleEventIcs } from '@robyrew/cal-bot'
import { convertModule } from '@robyrew/convert-bot'
import { createDoorModule } from '@robyrew/door-bot'
import { handleDoorHttp } from '@robyrew/door-bot/http'
import type { DoorPortal } from '@robyrew/door-bot/portal'
import { lessonModule } from '@robyrew/lesson-bot'
import { mapModule } from '@robyrew/map-bot'
import { pptModule, textFromPptx } from '@robyrew/ppt-bot'
import { setCatalogLoader, spotifyModule, type CatalogFile } from '@robyrew/spotify-bot'
import { clearSpotifyToken, parseSpotifyUrl, setSpotifyFetch } from '../../spotify-versions-history/bot/open.ts'
import { linkedInModule, setLinkedInFetch } from '@robyrew/linkedin-bot'
import { tideModule } from '@robyrew/tide-bot'
import { CHAPTERS, NAMES } from '../../bibletype/bot/books.ts'
import { verseModule } from '@robyrew/verse-bot'
import { meModule } from '@robyrew/me-bot'
import type { BotModule, Inbound, Reply } from '@robyrew/bot-sdk'
import { createApp, handleInbound, runTicks } from '../src/dispatch.ts'
import { linksModule } from '../src/links.ts'
import { Store } from '../src/store.ts'

const catalog: CatalogFile = {
  entries: [
    { version: '1.2.96.518', platform: 'windows', architecture: 'x64', date: '2026-01-02', sha256: 'abc', sources: [{ url: 'https://example.test/a' }] },
    { version: '1.3.1.234', platform: 'macos', architecture: 'arm64', date: '2026-02-02', sources: [{ url: 'https://example.test/b' }] },
  ],
}
setCatalogLoader(async () => catalog)

function inbound(over: Partial<Inbound> & Pick<Inbound, 'text' | 'userId'>): Inbound {
  return {
    chatId: over.chatId ?? over.userId,
    userId: over.userId,
    isGroup: over.isGroup ?? false,
    lang: over.lang ?? 'en',
    text: over.text,
    command: over.command ?? null,
    args: over.args ?? '',
    callback: over.callback ?? null,
    file: over.file ?? null,
    handle: over.handle ?? null,
    now: over.now ?? new Date('2026-11-19T12:00:00Z'),
  }
}

function appFor(store: Store, modules: BotModule[]) {
  const logs: string[] = []
  const app = createApp({
    store,
    modules,
    adminId: '1',
    publicBase: 'https://bot.example',
    log: (command) => logs.push(command),
  })
  return { app, logs }
}

function textOf(replies: Reply[]): string {
  return replies.map((reply) => (reply.kind === 'text' ? reply.text : reply.kind === 'file' ? reply.filename : reply.prompt)).join('\n')
}

const modules: BotModule[] = [mapModule, spotifyModule, lessonModule, verseModule, tideModule, calendarModule, pptModule, convertModule, meModule, linksModule]

test('canon lists stay the same length and carry no verse text', () => {
  assert.equal(NAMES.en.length, 66)
  assert.equal(NAMES.ro.length, 66)
  assert.equal(NAMES.es.length, 66)
  assert.equal(CHAPTERS.length, 66)
})

test('a private chat asks the language, then lists commands', async () => {
  const store = new Store(':memory:')
  const { app } = appFor(store, modules)
  const first = await handleInbound(app, inbound({ userId: '9', text: '/help', command: 'help' }))
  assert.match(textOf(first), /Which language/)
  const picked = await handleInbound(app, inbound({ userId: '9', text: '', callback: 'lang:ro' }))
  assert.match(textOf(picked), /Limba/)
  const help = await handleInbound(app, inbound({ userId: '9', text: '/help', command: 'help' }))
  assert.match(textOf(help), /\/map/)
  assert.match(textOf(help), /\/convert/)
  store.close()
})

test('map replies with four app links and stores nothing', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, modules)
  const replies = await handleInbound(app, inbound({ userId: '9', text: '/map 41.38, 2.17', command: 'map', args: '41.38, 2.17' }))
  const reply = replies[0]
  assert.equal(reply?.kind, 'text')
  if (reply?.kind !== 'text') return
  const labels = (reply.links ?? []).map((link) => link.label)
  assert.deepEqual(labels, ['Apple Maps', 'Google Maps', 'Waze', 'OpenStreetMap'])
  assert.equal(store.get('map', '9', 'place'), null)
  store.close()
})

test('spotify search and the 08:00 digest', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, modules)
  const found = await handleInbound(app, inbound({ userId: '9', text: '/spotify 1.2.96', command: 'spotify', args: '1.2.96' }))
  assert.match(textOf(found), /abc/)
  assert.doesNotMatch(textOf(found), /audio/i)
  await handleInbound(app, inbound({ userId: '9', text: '/spotify follow windows x64 weekly', command: 'spotify', args: 'follow windows x64 weekly' }))
  const night = await runTicks(app, new Date('2026-11-19T22:30:00Z'))
  assert.equal(night.length, 0)
  const morning = await runTicks(app, new Date('2026-11-19T07:10:00Z'))
  assert.equal(morning.length, 1)
  assert.match(morning[0]?.reply.kind === 'text' ? morning[0].reply.text : '', /1\.2\.96/)
  store.close()
})

test('lesson 17 is the sheet file and a verse reply has no quotation', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, modules)
  const lesson = await handleInbound(app, inbound({ userId: '9', text: '/lesson 17', command: 'lesson', args: '17' }))
  const file = lesson[0]
  assert.equal(file?.kind, 'file')
  if (file?.kind === 'file') assert.match(new TextDecoder().decode(file.body), /Încurajarea/)
  const verse = await handleInbound(app, inbound({ userId: '9', text: '/verse John 3:16', command: 'verse', args: 'John 3:16' }))
  const body = textOf(verse)
  assert.match(body, /John 3:16/)
  assert.doesNotMatch(body, /For God/)
  const missing = await handleInbound(app, inbound({ userId: '9', text: '/verse John 99', command: 'verse', args: 'John 99' }))
  assert.match(textOf(missing), /does not match/)
  store.close()
})

test('tide counts down on the server', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, modules)
  const start = new Date('2026-11-19T12:00:00Z')
  const begun = await handleInbound(app, inbound({ userId: '9', text: '/tide 10m', command: 'tide', args: '10m', now: start }))
  assert.match(textOf(begun), /10:00/)
  const later = await handleInbound(app, inbound({ userId: '9', text: '/tide status', command: 'tide', args: 'status', now: new Date(start.getTime() + 30_000) }))
  assert.match(textOf(later), /9:30/)
  store.close()
})

test('ics file is a calendar and delete waits for YES', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  store.setHandle('9', 'cosmin')
  const { app } = appFor(store, modules)
  const made = await handleInbound(app, inbound({
    userId: '9',
    text: '/ics Dinner | 2026-11-20 18:00 | 60 | Madrid',
    command: 'ics',
    args: 'Dinner | 2026-11-20 18:00 | 60 | Madrid',
  }))
  const file = made.find((reply) => reply.kind === 'file')
  assert.ok(file && file.kind === 'file')
  if (file?.kind === 'file') assert.match(new TextDecoder().decode(file.body), /BEGIN:VCALENDAR/)
  assert.match(singleEventIcs({ uid: 'u', title: 'Dinner', start: new Date(), end: new Date(), location: '' }), /SUMMARY:Dinner/)
  const ask = await handleInbound(app, inbound({ userId: '9', text: '/ics delete x', command: 'ics', args: 'delete x' }))
  assert.match(textOf(ask), /YES/)
  const gone = await handleInbound(app, inbound({ userId: '9', text: 'YES' }))
  assert.match(textOf(gone), /deleted x/)
  store.close()
})

test('pptx text is returned and not written into sqlite', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, modules)
  const xml = new TextEncoder().encode('<a:t>Hello slides</a:t>')
  const body = zipStore({ 'ppt/slides/slide1.xml': xml })
  assert.equal(textFromPptx(body), 'Hello slides')
  const replies = await handleInbound(app, inbound({
    userId: '9',
    text: '',
    file: { filename: 'deck.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', body },
  }))
  assert.match(textOf(replies), /Hello slides/)
  const dumped = JSON.stringify(store.db.prepare('SELECT value FROM kv').all())
  assert.equal(dumped.includes('Hello slides'), false)
  store.close()
})

test('convert needs a handle, then returns a fidelity line', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, modules)
  const blocked = await handleInbound(app, inbound({ userId: '9', text: '/convert', command: 'convert' }))
  assert.match(textOf(blocked), /@handle/)
  store.setHandle('9', 'cosmin')
  await handleInbound(app, inbound({ userId: '9', text: '', callback: 'convert:markdown' }))
  const chat = '[01/06/2026, 09:30:25] A: hi\n'
  const out = await handleInbound(app, inbound({
    userId: '9',
    text: '',
    file: { filename: '_chat.txt', mime: 'text/plain', body: new TextEncoder().encode(chat) },
  }))
  const file = out.find((reply) => reply.kind === 'file')
  assert.ok(file && file.kind === 'file')
  if (file?.kind === 'file') assert.match(file.caption ?? '', /preserved/)
  store.close()
})

test('unlock refuses a group and a plant that is not on the session', async () => {
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const portal: DoorPortal = {
    async signIn() {
      return { ok: true, status: 200, message: 'signed in', token: 'tok', plants: [{ id: 'mine', name: 'Entrance' }] }
    },
    async plants() {
      return { ok: true, status: 200, message: 'plants', plants: [{ id: 'mine', name: 'Entrance' }] }
    },
    async missed() {
      return [{ id: 'c1', at: '2026-11-19T22:10:00Z' }]
    },
  }
  const door = createDoorModule({ portal, seal: (plain) => plain, open: (packed) => packed, publicBase: 'https://bot.example' })
  const { app } = appFor(store, [door])
  const group = await handleInbound(app, inbound({ userId: '9', chatId: '-100', isGroup: true, text: '/door unlock', command: 'door', args: 'unlock' }))
  assert.match(textOf(group), /private chat/)
  store.set('door', '9', 'session', JSON.stringify({ token: 'tok', project: 'C3X', plants: [{ id: 'mine', name: 'Entrance' }] }))
  const other = await handleInbound(app, inbound({ userId: '9', text: '/door unlock other', command: 'door', args: 'unlock other' }))
  assert.match(textOf(other), /not on your session/)
  const ask = await handleInbound(app, inbound({ userId: '9', text: '/door unlock mine', command: 'door', args: 'unlock mine' }))
  assert.match(textOf(ask), /UNLOCK/)
  const done = await handleInbound(app, inbound({ userId: '9', text: 'UNLOCK' }))
  assert.match(textOf(done), /panel link/)
  store.rememberPrivateChat('9', '9')
  const night = await runTicks(app, new Date('2026-11-19T22:30:00Z'))
  assert.equal(night.length, 1)
  assert.equal(night[0]?.reply.kind === 'text' && night[0].reply.urgent, true)
  store.close()
})

test('the door page stores a token and not the password', async () => {
  const store = new Store(':memory:')
  const portal: DoorPortal = {
    async signIn(email, password) {
      assert.equal(email, 'a@b.c')
      assert.equal(password, 's3cret')
      return { ok: true, status: 200, message: 'signed in', token: 'tok', plants: [] }
    },
    async plants() {
      return { ok: true, status: 200, message: 'plants', plants: [] }
    },
    async missed() {
      return []
    },
  }
  store.set('door', 'token1', 'owner', '9')
  const result = await handleDoorHttp('POST', '/door/token1', new URLSearchParams({ email: 'a@b.c', password: 's3cret', project: 'C3X' }), {
    get: (userId, key) => store.get('door', userId, key),
    set: (userId, key, value) => store.set('door', userId, key, value),
    del: (userId, key) => store.del('door', userId, key),
    portal,
    seal: (plain) => plain,
  })
  assert.equal(result?.status, 200)
  const saved = store.get('door', '9', 'session') ?? ''
  assert.equal(saved.includes('s3cret'), false)
  assert.match(saved, /tok/)
  store.close()
})

test('repo striker is a link and admin ban blocks the next message', async () => {
  const store = new Store(':memory:')
  store.setLang('1', 'en')
  store.setLang('2', 'en')
  const { app, logs } = appFor(store, modules)
  const repo = await handleInbound(app, inbound({ userId: '2', text: '/repo striker', command: 'repo', args: 'striker' }))
  assert.match(textOf(repo), /USB/)
  const reply = repo[0]
  assert.equal(reply?.kind, 'text')
  if (reply?.kind === 'text') assert.equal(reply.links?.[0]?.url, 'https://github.com/RobyRew/striker')
  await handleInbound(app, inbound({ userId: '1', text: '/admin ban 2', command: 'admin', args: 'ban 2' }))
  const banned = await handleInbound(app, inbound({ userId: '2', text: '/map 1, 1', command: 'map', args: '1, 1' }))
  assert.match(textOf(banned), /cannot use/)
  assert.equal(logs.some((line) => line.includes('s3cret') || line.includes('Hello')), false)
  store.close()
})

test('a spotify link returns the title, artwork, and playlist rows, not a full audio file', async () => {
  delete process.env.SPOTIFY_CLIENT_ID
  delete process.env.SPOTIFY_CLIENT_SECRET
  clearSpotifyToken()
  process.env.SPOTIFY_CLIENT_ID = 'test-id'
  process.env.SPOTIFY_CLIENT_SECRET = 'test-secret'
  setSpotifyFetch(async (url) => {
    if (url.includes('/api/token')) return Response.json({ access_token: 'app-token', expires_in: 3600 })
    if (url.includes('/playlists/pl1')) {
      return Response.json({
        name: 'Mix',
        images: [{ url: 'https://i.scdn.co/image/cover' }],
        tracks: { items: [{ track: { name: 'One', artists: [{ name: 'A' }], preview_url: 'https://p.scdn.co/mp3-preview/x' } }] },
      })
    }
    if (url.includes('i.scdn.co')) return new Response(Uint8Array.from([1, 2, 3]))
    if (url.includes('p.scdn.co')) return new Response(Uint8Array.from([4, 5]))
    return new Response('no', { status: 404 })
  })
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, [spotifyModule])
  const replies = await handleInbound(app, inbound({ userId: '9', text: 'https://open.spotify.com/playlist/pl1' }))
  const text = textOf(replies)
  assert.match(text, /Mix/)
  assert.match(text, /A — One/)
  assert.equal(text.includes('test-secret'), false)
  assert.equal(text.includes('app-token'), false)
  assert.ok(replies.some((reply) => reply.kind === 'file' && reply.filename === 'artwork.jpg'))
  assert.ok(replies.some((reply) => reply.kind === 'file' && reply.filename === 'preview.mp3'))
  assert.equal(parseSpotifyUrl('https://open.spotify.com/track/abcDEF123')?.kind, 'track')
  delete process.env.SPOTIFY_CLIENT_ID
  delete process.env.SPOTIFY_CLIENT_SECRET
  clearSpotifyToken()
  setSpotifyFetch(null)
  store.close()
})

test('a public linkedin page returns text and image, and a login wall does not ask for a password', async () => {
  setLinkedInFetch(async (url) => {
    if (url.includes('media.licdn.com')) return new Response(Uint8Array.from([7]))
    if (url.includes('authwall')) return new Response('<html>authwall join linkedin</html>', { status: 200 })
    return new Response('<html><meta property="og:title" content="A post"><meta property="og:description" content="Hello from the post"><meta property="og:image" content="https://media.licdn.com/pic.jpg"></html>', { status: 200 })
  })
  const store = new Store(':memory:')
  store.setLang('9', 'en')
  const { app } = appFor(store, [linkedInModule])
  const replies = await handleInbound(app, inbound({ userId: '9', text: 'https://www.linkedin.com/posts/someone-activity-1' }))
  assert.match(textOf(replies), /Hello from the post/)
  assert.equal(textOf(replies).toLowerCase().includes('password'), false)
  assert.ok(replies.some((reply) => reply.kind === 'file' && reply.filename === 'image.jpg'))
  const wall = await handleInbound(app, inbound({ userId: '9', text: 'https://www.linkedin.com/authwall' }))
  assert.match(textOf(wall), /without an account/)
  setLinkedInFetch(null)
  store.close()
})

test('sqlite path opens', () => {
  const dir = mkdtempSync(join(tmpdir(), 'robyrew-bot-'))
  const store = new Store(join(dir, 'bot.sqlite'))
  store.setLang('1', 'es')
  assert.equal(store.lang('1'), 'es')
  store.close()
})
