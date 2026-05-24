import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/** İsterseniz ortam değişkeni: SIDEBAR_LOGO_SRC=C:\\path\\to\\logo.svg */
const src =
  process.env.SIDEBAR_LOGO_SRC ||
  path.join('C:', 'Users', 'MuhammedEnesKarasan', 'Downloads', 'Gemini_Generated_Image_dup8p8dup8p8dup8.svg')
const out = path.join(root, 'src', 'assets', 'sidebar-logo.svg')

let s = fs.readFileSync(src, 'utf8')
s = s.replace(/<\?xml[^?]*\?>\s*/g, '')
s = s.replace(/<!DOCTYPE[\s\S]*?>\s*/g, '')
s = s.replace(/fill="#000000"/g, 'fill="#f8fafc"')
s = s.replace(
  /<svg[^>]*>/,
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2816 1536" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">',
)

fs.writeFileSync(out, s.trim() + '\n', 'utf8')
console.log('Wrote', out)
