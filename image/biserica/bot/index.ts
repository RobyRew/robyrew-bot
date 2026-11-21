import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tr, type BotModule, type Lang, type Reply } from '@robyrew/bot-sdk'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const help: Record<Lang, string> = {
  en: 'Ask for a lesson number. I send the printable A4 sheet. The wording stays the sheet’s Romanian.',
  ro: 'Cere numărul lecției. Trimit fișa A4 de tipărit.',
  es: 'Pide el número de la lección. Envío la ficha A4. El texto sigue en rumano.',
}

async function sheets(): Promise<string[]> {
  const names = await readdir(root)
  return names.filter((name) => /^Lecția\s+\d+/i.test(name) && name.endsWith('.html')).sort()
}

export const lessonModule: BotModule = {
  id: 'lesson',
  commands: ['lesson'],
  bucket: 'lookup',
  signIn: 'no',
  menu: (lang) => tr(lang, { en: 'Lessons', ro: 'Lecții', es: 'Lecciones' }),
  help: (lang) => help[lang],
  async handle(input): Promise<Reply | null> {
    const files = await sheets()
    const wanted = input.args.trim()
    if (!wanted) {
      const list = files.map((name) => name.replace(/\.html$/, '')).join('\n')
      return { kind: 'text', text: list || help[input.lang] }
    }
    const file = files.find((name) => new RegExp(`Lecția\\s+0*${wanted}\\b`, 'i').test(name))
    if (!file) {
      return {
        kind: 'text',
        text: tr(input.lang, {
          en: 'No sheet with that number.',
          ro: 'Nu există fișa cu numărul ăsta.',
          es: 'No hay ficha con ese número.',
        }),
      }
    }
    const body = await readFile(join(root, file))
    return { kind: 'file', filename: file, mime: 'text/html', body, caption: file.replace(/\.html$/, '') }
  },
}
