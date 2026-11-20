import { calendarModule } from '@robyrew/cal-bot'
import { convertModule } from '@robyrew/convert-bot'
import { createDoorModule } from '@robyrew/door-bot'
import { livePortal } from '@robyrew/door-bot/portal'
import { lessonModule } from '@robyrew/lesson-bot'
import { linkedInModule } from '@robyrew/linkedin-bot'
import { mapModule } from '@robyrew/map-bot'
import { meModule } from '@robyrew/me-bot'
import { pptModule } from '@robyrew/ppt-bot'
import { spotifyModule } from '@robyrew/spotify-bot'
import { tideModule } from '@robyrew/tide-bot'
import { verseModule } from '@robyrew/verse-bot'
import { tr, type BotModule } from '@robyrew/bot-sdk'
import { linksModule } from './links.ts'
import { open, seal } from './store.ts'

export interface ModuleEnv {
  publicBase: string
  sessionKey: Buffer | null
}

const doorOff: BotModule = {
  id: 'door',
  commands: ['door'],
  bucket: 'none',
  signIn: 'no',
  menu: (lang) => tr(lang, { en: 'Door', ro: 'Ușă', es: 'Puerta' }),
  help: (lang) => tr(lang, {
    en: 'Door linking needs SESSION_ENCRYPTION_KEY on the server.',
    ro: 'Legarea ușii cere SESSION_ENCRYPTION_KEY pe server.',
    es: 'Ligar la puerta exige SESSION_ENCRYPTION_KEY en el servidor.',
  }),
  async handle(input) {
    return { kind: 'text', text: doorOff.help(input.lang) }
  },
}

export function loadModules(env: ModuleEnv): BotModule[] {
  const door = env.sessionKey
    ? createDoorModule({
        portal: livePortal(),
        seal: (plain) => seal(env.sessionKey as Buffer, plain),
        open: (packed) => open(env.sessionKey as Buffer, packed),
        publicBase: env.publicBase,
      })
    : doorOff
  return [
    mapModule,
    spotifyModule,
    lessonModule,
    verseModule,
    tideModule,
    calendarModule,
    pptModule,
    convertModule,
    door,
    meModule,
    linkedInModule,
    linksModule,
  ]
}
