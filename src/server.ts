import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { handleDoorHttp } from '@robyrew/door-bot/http'
import type { DoorPortal } from '@robyrew/door-bot/portal'
import { randomBytes } from 'node:crypto'
import { Store } from './store.ts'

export interface HttpEnv {
  store: Store
  publicBase: string
  logtoEndpoint: string
  logtoAppId: string
  logtoAppSecret: string
  portal: DoorPortal
  seal(plain: string): string
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: string, type = 'text/html; charset=utf-8'): void {
  res.writeHead(status, { 'content-type': type })
  res.end(body)
}

export function startHttp(env: HttpEnv): void {
  const port = Number(process.env.PORT ?? '8787')
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', env.publicBase || 'http://127.0.0.1')
    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, 'ok', 'text/plain')
      return
    }
    if (url.pathname === '/login' && req.method === 'GET') {
      await startLogin(env, url, res)
      return
    }
    if (url.pathname === '/login/callback' && req.method === 'GET') {
      await finishLogin(env, url, res)
      return
    }
    if (url.pathname.startsWith('/door/')) {
      const raw = req.method === 'POST' ? await readBody(req) : ''
      const result = await handleDoorHttp(req.method ?? 'GET', url.pathname, new URLSearchParams(raw), {
        get: (userId, key) => env.store.get('door', userId, key),
        set: (userId, key, value) => env.store.set('door', userId, key, value),
        del: (userId, key) => env.store.del('door', userId, key),
        portal: env.portal,
        seal: env.seal,
      })
      if (!result) {
        send(res, 404, 'not found', 'text/plain')
        return
      }
      send(res, result.status, result.body, result.status === 200 && req.method === 'GET' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8')
      return
    }
    send(res, 404, 'not found', 'text/plain')
  })
  server.listen(port)
}

async function startLogin(env: HttpEnv, url: URL, res: ServerResponse): Promise<void> {
  const telegramId = url.searchParams.get('u') ?? ''
  if (!env.logtoEndpoint || !env.logtoAppId || !telegramId) {
    send(res, 503, 'Sign-in is not configured on this server yet.', 'text/plain')
    return
  }
  const state = randomBytes(16).toString('hex')
  env.store.set('logto', state, 'user', telegramId)
  const redirect = new URL('/oidc/auth', env.logtoEndpoint)
  redirect.searchParams.set('client_id', env.logtoAppId)
  redirect.searchParams.set('redirect_uri', `${env.publicBase.replace(/\/$/, '')}/login/callback`)
  redirect.searchParams.set('response_type', 'code')
  redirect.searchParams.set('scope', 'openid profile')
  redirect.searchParams.set('state', state)
  res.writeHead(302, { location: redirect.toString() })
  res.end()
}

async function finishLogin(env: HttpEnv, url: URL, res: ServerResponse): Promise<void> {
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  const telegramId = env.store.get('logto', state, 'user')
  if (!code || !telegramId || !env.logtoEndpoint || !env.logtoAppId || !env.logtoAppSecret) {
    send(res, 400, 'Sign-in did not complete.', 'text/plain')
    return
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.logtoAppId,
    client_secret: env.logtoAppSecret,
    redirect_uri: `${env.publicBase.replace(/\/$/, '')}/login/callback`,
  })
  const tokenRes = await fetch(new URL('/oidc/token', env.logtoEndpoint), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tokenRes.ok) {
    send(res, 401, 'Sign-in was rejected.', 'text/plain')
    return
  }
  const token = (await tokenRes.json()) as { id_token?: string }
  if (!token.id_token) {
    send(res, 401, 'Sign-in was rejected.', 'text/plain')
    return
  }
  const username = await usernameFromIdToken(token.id_token, env.logtoEndpoint, env.logtoAppId)
  if (typeof username !== 'string' || !/^[a-z_][a-z0-9_]{2,19}$/.test(username)) {
    send(res, 401, 'Sign-in did not include a @handle.', 'text/plain')
    return
  }
  env.store.setHandle(telegramId, username)
  env.store.del('logto', state, 'user')
  send(res, 200, `Signed in as @${username}. Return to Telegram.`, 'text/plain')
}

interface IdPayload {
  aud?: string | string[]
  username?: unknown
}

/** Checks the Logto id token against the published RSA key, then reads `username`. */
async function usernameFromIdToken(idToken: string, endpoint: string, audience: string): Promise<string | null> {
  const [head, body, sig] = idToken.split('.')
  if (!head || !body || !sig) return null
  const header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8')) as { kid?: string; alg?: string }
  if (header.alg !== 'RS256' || !header.kid) return null
  const jwks = (await (await fetch(new URL('/oidc/jwks', endpoint))).json()) as { keys?: JsonWebKey[] }
  const jwk = jwks.keys?.find((key) => key.kid === header.kid)
  if (!jwk) return null
  const key = createPublicKey({ key: jwk, format: 'jwk' })
  const ok = verifySignature('RSA-SHA256', Buffer.from(`${head}.${body}`), key, Buffer.from(sig, 'base64url'))
  if (!ok) return null
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as IdPayload
  const aud = payload.aud
  const audiences = Array.isArray(aud) ? aud : aud ? [aud] : []
  if (!audiences.includes(audience)) return null
  return typeof payload.username === 'string' ? payload.username : null
}
