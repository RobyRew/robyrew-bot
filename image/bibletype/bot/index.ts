import { tr, type BotModule, type Lang, type Reply } from '@robyrew/bot-sdk'
import { CHAPTERS, NAMES } from './books.ts'

const help: Record<Lang, string> = {
  en: 'Send a reference such as John 3:16. I repeat the reference. The verse text stays in BibleType.',
  ro: 'Trimite o referință, de exemplu Ioan 3:16. Repet referința. Textul versetului rămâne în BibleType.',
  es: 'Envía una referencia, por ejemplo Juan 3:16. Repito la referencia. El texto del versículo se queda en BibleType.',
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export interface ParsedRef {
  index: number
  chapter: number
  verse: string
}

/** Returns the book index and chapter when the reference fits the canon. No verse body. */
export function parseReference(raw: string): ParsedRef | null {
  const text = raw.trim()
  const match = text.match(/^(.*?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/)
  if (!match) return null
  const book = fold(match[1] ?? '')
  const chapter = Number(match[2])
  const verse = match[3]
  const end = match[4]
  const index = NAMES.en.findIndex((_, i) => [NAMES.en[i], NAMES.ro[i], NAMES.es[i]].some((name) => fold(name) === book))
  if (index < 0) return null
  const chapters = CHAPTERS[index] ?? 0
  if (chapter < 1 || chapter > chapters) return null
  const versePart = verse ? (end ? `:${verse}-${end}` : `:${verse}`) : ''
  return { index, chapter, verse: versePart }
}

export function formatReference(index: number, chapter: number, verse: string, lang: Lang): string {
  return `${NAMES[lang][index]} ${chapter}${verse}`
}

export const verseModule: BotModule = {
  id: 'verse',
  commands: ['verse'],
  bucket: 'lookup',
  signIn: 'no',
  menu: (lang) => tr(lang, { en: 'Verse reference', ro: 'Referință', es: 'Referencia' }),
  help: (lang) => help[lang],
  async handle(input): Promise<Reply> {
    const raw = input.args.trim()
    if (!raw) return { kind: 'text', text: help[input.lang] }
    const parsed = parseReference(raw)
    if (!parsed) {
      return {
        kind: 'text',
        text: tr(input.lang, {
          en: 'That reference does not match a book and chapter I know.',
          ro: 'Referința asta nu se potrivește cu o carte și un capitol pe care le știu.',
          es: 'Esa referencia no coincide con un libro y un capítulo que conozca.',
        }),
      }
    }
    const name = formatReference(parsed.index, parsed.chapter, parsed.verse, input.lang)
    return {
      kind: 'text',
      text: tr(input.lang, {
        en: `${name}\nThe text stays in BibleType.`,
        ro: `${name}\nTextul rămâne în BibleType.`,
        es: `${name}\nEl texto se queda en BibleType.`,
      }),
    }
  },
}
