import { tr, type BotModule, type Lang } from '@robyrew/bot-sdk'

/** Public repos that stay a description and a link. No command reaches into them. */
const LINKS: Record<string, { about: Record<Lang, string>; url?: string }> = {
  striker: {
    about: {
      en: 'Striker is a USB runtime console. It has no chat command.',
      ro: 'Striker e o consolă de runtime pe USB. Nu are comandă în chat.',
      es: 'Striker es una consola de runtime por USB. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/striker',
  },
  linkedin: {
    about: {
      en: 'LinkedIn Professional is an on-device tweak. It has no chat command.',
      ro: 'LinkedIn Professional e un tweak pe telefon. Nu are comandă în chat.',
      es: 'LinkedIn Professional es un tweak en el teléfono. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/linkedin-pro-ios',
  },
  'make it play': {
    about: {
      en: 'Make It Play patching has no chat command. Version lookup is /spotify.',
      ro: 'Patch-ul Make It Play nu are comandă în chat. Căutarea de versiuni e /spotify.',
      es: 'El parche Make It Play no tiene comando en el chat. La búsqueda de versiones es /spotify.',
    },
  },
  'split-stream': {
    about: {
      en: 'split-stream moves one app’s traffic through your server. It has no chat command.',
      ro: 'split-stream mută traficul unei aplicații prin serverul tău. Nu are comandă în chat.',
      es: 'split-stream mueve el tráfico de una app por tu servidor. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/split-stream',
  },
  'tweak-kit': {
    about: {
      en: 'tweak-kit is shared iOS tweak plumbing. It has no chat command.',
      ro: 'tweak-kit e infrastructura comună a tweak-urilor iOS. Nu are comandă în chat.',
      es: 'tweak-kit es la fontanería común de los tweaks de iOS. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/tweak-kit',
  },
  hackintosh: {
    about: {
      en: 'The OpenCore notes are archived guides. They have no chat command.',
      ro: 'Notele OpenCore sunt ghiduri arhivate. Nu au comandă în chat.',
      es: 'Las notas de OpenCore son guías archivadas. No tienen comando en el chat.',
    },
    url: 'https://github.com/RobyRew',
  },
  ytlite: {
    about: {
      en: 'YTLite is a fork kept as a repo. It has no chat command.',
      ro: 'YTLite e un fork păstrat ca repo. Nu are comandă în chat.',
      es: 'YTLite es un fork guardado como repo. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/YTLite',
  },
  scinsta: {
    about: {
      en: 'SCInsta is a fork kept as a repo. It has no chat command.',
      ro: 'SCInsta e un fork păstrat ca repo. Nu are comandă în chat.',
      es: 'SCInsta es un fork guardado como repo. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/SCInsta',
  },
  uyouplus: {
    about: {
      en: 'uYouPlus is a fork kept as a repo. It has no chat command.',
      ro: 'uYouPlus e un fork păstrat ca repo. Nu are comandă în chat.',
      es: 'uYouPlus es un fork guardado como repo. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/uYouPlus',
  },
  parcelstudio: {
    about: {
      en: 'ParcelStudio is the Mac parcel editor. It has no chat command.',
      ro: 'ParcelStudio e editorul de parcelă de pe Mac. Nu are comandă în chat.',
      es: 'ParcelStudio es el editor de parcela del Mac. No tiene comando en el chat.',
    },
  },
  finca: {
    about: {
      en: 'Finca del Pi 7 stays off this bot.',
      ro: 'Finca del Pi 7 rămâne în afara botului.',
      es: 'Finca del Pi 7 se queda fuera del bot.',
    },
  },
  toppresenter: {
    about: {
      en: 'TopPresenter is the Mac worship app. It has no chat command.',
      ro: 'TopPresenter e aplicația de prezentare de pe Mac. Nu are comandă în chat.',
      es: 'TopPresenter es la app de presentación del Mac. No tiene comando en el chat.',
    },
    url: 'https://github.com/RobyRew/TopPresenter',
  },
  infrastructure: {
    about: {
      en: 'The VPS baseline has no chat command.',
      ro: 'Baza VPS-ului nu are comandă în chat.',
      es: 'La base del VPS no tiene comando en el chat.',
    },
  },
}

export const linksModule: BotModule = {
  id: 'repo',
  commands: ['repo'],
  bucket: 'lookup',
  signIn: 'no',
  menu: (lang) => tr(lang, { en: 'Repos', ro: 'Repo-uri', es: 'Repos' }),
  help: (lang) => tr(lang, {
    en: 'Ask /repo and a name. Tools that only run on a Mac or a phone answer with a link.',
    ro: 'Întreabă /repo și un nume. Uneltele care merg doar pe Mac sau pe telefon răspund cu un link.',
    es: 'Pregunta /repo y un nombre. Las herramientas que solo van en un Mac o un teléfono responden con un enlace.',
  }),
  async handle(input) {
    const name = input.args.trim().toLowerCase()
    const hit = LINKS[name]
    if (!hit) {
      return { kind: 'text', text: Object.keys(LINKS).sort().join('\n') }
    }
    return {
      kind: 'text',
      text: hit.about[input.lang],
      links: hit.url ? [{ url: hit.url, label: name }] : undefined,
    }
  },
}
