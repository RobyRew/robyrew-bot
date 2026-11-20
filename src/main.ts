import { livePortal } from '@robyrew/door-bot/portal'
import { mkdirSync } from 'node:fs'
import { createApp } from './dispatch.ts'
import { loadModules } from './registry.ts'
import { startHttp } from './server.ts'
import { keyFromHex, seal, Store } from './store.ts'
import { runTelegram } from './telegram.ts'

const dataDir = process.env.DATA_DIR ?? './data'
mkdirSync(dataDir, { recursive: true })
const store = new Store(`${dataDir}/bot.sqlite`)
const sessionKey = process.env.SESSION_ENCRYPTION_KEY ? keyFromHex(process.env.SESSION_ENCRYPTION_KEY) : null
if (!sessionKey) {
  console.log(JSON.stringify({ t: new Date().toISOString(), cmd: 'door-key-missing', user: '' }))
}
const publicBase = process.env.PUBLIC_BASE ?? ''
const app = createApp({
  store,
  modules: loadModules({ publicBase, sessionKey }),
  adminId: process.env.TELEGRAM_ADMIN_ID ?? null,
  publicBase,
  log: (command, userId) => {
    console.log(JSON.stringify({ t: new Date().toISOString(), cmd: command, user: userId }))
  },
})

startHttp({
  store,
  publicBase,
  logtoEndpoint: process.env.LOGTO_ENDPOINT ?? '',
  logtoAppId: process.env.LOGTO_APP_ID ?? '',
  logtoAppSecret: process.env.LOGTO_APP_SECRET ?? '',
  portal: livePortal(),
  seal: (plain) => {
    if (!sessionKey) throw new Error('SESSION_ENCRYPTION_KEY is not set')
    return seal(sessionKey, plain)
  },
})

const token = process.env.TELEGRAM_BOT_TOKEN
if (token) void runTelegram(token, app)
