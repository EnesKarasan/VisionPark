/**
 * assets/header-logo.svg → components/headerLogoAsset.ts
 * Çalıştır: node scripts/embed-header-logo.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svgPath = path.join(root, 'assets', 'header-logo.svg')
const outPath = path.join(root, 'components', 'headerLogoAsset.ts')

let xml = fs.readFileSync(svgPath, 'utf8')
xml = xml.replace(/<\?xml[^?]*\?>\s*/g, '')
xml = xml.replace(/<!DOCTYPE[\s\S]*?>\s*/g, '')
xml = xml.replace(/fill="#000000"/g, 'fill="__LOGO_COLOR__"')
xml = xml.replace(/stroke="#000000"/g, 'stroke="__LOGO_COLOR__"')

const vb = xml.match(/viewBox="([^"]+)"/)
const parts = vb ? vb[1].trim().split(/\s+/).map(Number) : [0, 0, 138, 26]
const [, , vw, vh] = parts.length >= 4 ? parts : [0, 0, 138, 26]
const HEADER_LOGO_WIDTH = 138
const HEADER_LOGO_HEIGHT = Math.max(26, Math.round((HEADER_LOGO_WIDTH * vh) / vw))

xml = xml.replace(
  /<svg[^>]*>/,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${HEADER_LOGO_WIDTH}" height="${HEADER_LOGO_HEIGHT}" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">`,
)

const escaped = xml.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

const header = `/**
 * Otomatik üretildi: node scripts/embed-header-logo.mjs
 * Kaynak: assets/header-logo.svg — logoyu değiştirmek için o dosyayı güncelleyip betiği yeniden çalıştırın.
 *
 * Tek renk için SVG içinde __LOGO_COLOR__ kullanın (header rengine uyar).
 */

export const HEADER_LOGO_WIDTH = ${HEADER_LOGO_WIDTH};
export const HEADER_LOGO_HEIGHT = ${HEADER_LOGO_HEIGHT};

export const HEADER_LOGO_SVG_XML = \`
${escaped}
\`.trim();
`

fs.writeFileSync(outPath, header, 'utf8')
console.log('Wrote', outPath)
