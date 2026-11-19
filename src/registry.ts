import { calendarModule } from '@robyrew/cal-bot'
import { convertModule } from '@robyrew/convert-bot'
import { createDoorModule } from '@robyrew/door-bot'
import { livePortal } from '@robyrew/door-bot/portal'
import { lessonModule } from '@robyrew/lesson-bot'
import { mapModule } from '@robyrew/map-bot'
import { meModule } from '@robyrew/me-bot'
import { pptModule } from '@robyrew/ppt-bot'
import { spotifyModule } from '@robyrew/spotify-bot'
import { tideModule } from '@robyrew/tide-bot'
import { verseModule } from '@robyrew/verse-bot'
import type { BotModule } from '@robyrew/bot-sdk'
import { linksModule } from './links.ts'
import { open, seal } from './store.ts'

export interface ModuleEnv {
  publicBase: string
  sessionKey: Buffer
}

export function loadModules(env: ModuleEnv): BotModule[] {
  const door = createDoorModule({
    portal: livePortal(),
    seal: (plain) => seal(env.sessionKey, plain),
    open: (packed) => open(env.sessionKey, packed),
    publicBase: env.publicBase,
  })
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
    linksModule,
  ]
}
