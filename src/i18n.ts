import type { BotModule, Button, Lang, Reply } from '@robyrew/bot-sdk'
import { tr } from '@robyrew/bot-sdk'

export function hostText(lang: Lang, key: string): string {
  const table: Record<string, Record<Lang, string>> = {
    langAsk: {
      en: 'Which language should I use?',
      ro: 'În ce limbă vorbesc?',
      es: '¿En qué idioma hablo?',
    },
    langSet: {
      en: 'Language saved. Pick a product or type /help.',
      ro: 'Limba a fost salvată. Alege un produs sau scrie /help.',
      es: 'Idioma guardado. Elige un producto o escribe /help.',
    },
    banned: {
      en: 'This account cannot use the bot.',
      ro: 'Acest cont nu poate folosi botul.',
      es: 'Esta cuenta no puede usar el bot.',
    },
    unknown: {
      en: 'I do not have that command. /help lists the ones I do.',
      ro: 'Nu am comanda asta. /help le arată pe cele pe care le am.',
      es: 'No tengo ese comando. /help lista los que sí tengo.',
    },
    rate: {
      en: 'Too many requests. Wait and try again.',
      ro: 'Prea multe cereri. Așteaptă și încearcă din nou.',
      es: 'Demasiadas peticiones. Espera y vuelve a intentarlo.',
    },
    signIn: {
      en: 'This action needs a RobyRew @handle. Open the sign-in link, then come back.',
      ro: 'Acțiunea asta cere un @handle RobyRew. Deschide linkul de autentificare, apoi revino.',
      es: 'Esta acción necesita un @handle de RobyRew. Abre el enlace de acceso y vuelve.',
    },
    signInMissing: {
      en: 'Sign-in is not configured on this server yet.',
      ro: 'Autentificarea nu este configurată pe serverul ăsta încă.',
      es: 'El acceso aún no está configurado en este servidor.',
    },
    offline: {
      en: 'That service is offline.',
      ro: 'Serviciul ăla este oprit.',
      es: 'Ese servicio está apagado.',
    },
    confirmWait: {
      en: 'Send the confirmation word, or another command to cancel.',
      ro: 'Trimite cuvântul de confirmare, sau altă comandă ca să anulezi.',
      es: 'Envía la palabra de confirmación, u otro comando para cancelar.',
    },
    adminOnly: {
      en: 'Admin commands stay in your private chat.',
      ro: 'Comenzile de admin rămân în chatul tău privat.',
      es: 'Los comandos de admin se quedan en tu chat privado.',
    },
    adminNo: {
      en: 'You are not the admin.',
      ro: 'Nu ești adminul.',
      es: 'No eres el admin.',
    },
  }
  return tr(lang, table[key] ?? { en: key, ro: key, es: key })
}

export function languageAsk(): Reply {
  const buttons: Button[] = [
    { data: 'lang:en', label: 'English' },
    { data: 'lang:ro', label: 'Română' },
    { data: 'lang:es', label: 'Español' },
  ]
  return { kind: 'text', text: hostText('en', 'langAsk'), buttons }
}

export function menuReply(lang: Lang, modules: readonly BotModule[]): Reply {
  return {
    kind: 'text',
    text: hostText(lang, 'langSet'),
    buttons: modules.filter((m) => m.commands[0]).map((m) => ({ data: `cmd:${m.commands[0]}`, label: m.menu(lang) })),
  }
}

export function helpReply(lang: Lang, modules: readonly BotModule[]): Reply {
  const lines = modules.map((m) => {
    const mark = m.signIn === 'yes' ? ' · @handle' : m.signIn === 'some' ? ' · @handle to save' : ''
    return `${m.commands.map((c) => `/${c}`).join(', ')} — ${m.help(lang)}${mark}`
  })
  return { kind: 'text', text: lines.join('\n') }
}
