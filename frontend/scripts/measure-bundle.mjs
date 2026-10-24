import { build } from 'vite'
import { gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// Same Vite config/minifier/plugins as npm run build, without replacing dist.
const result = await build({ build: { write: false } })
if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one application build')
const chunks = result.output.filter((entry) => entry.type === 'chunk')
function visit(name, selected) {
  if (selected.has(name)) return
  const chunk = chunks.find((entry) => entry.fileName === name)
  if (!chunk) throw new Error(`Missing chunk: ${name}`)
  selected.add(name)
  chunk.imports.forEach((dependency) => visit(dependency, selected))
}
const initial = new Set()
chunks.filter((chunk) => chunk.isEntry).forEach((chunk) => visit(chunk.fileName, initial))
const size = (code) => ({ bytes: Buffer.byteLength(code), gzipBytes: gzipSync(code).length })
const totals = (selected) => selected.reduce((sum, chunk) => {
  const value = size(chunk.code)
  return { bytes: sum.bytes + value.bytes, gzipBytes: sum.gzipBytes + value.gzipBytes }
}, { bytes: 0, gzipBytes: 0 })
const groups = new Map()
for (const chunk of chunks) for (const [id, module] of Object.entries(chunk.modules)) {
  const normalized = id.replaceAll('\\', '/')
  const group = normalized.includes('/node_modules/')
    ? normalized.split('/node_modules/').at(-1).split('/').slice(0, normalized.split('/node_modules/').at(-1).startsWith('@') ? 2 : 1).join('/')
    : normalized.includes('/src/') ? `src/${normalized.split('/src/')[1].split('/')[0]}` : 'build helpers'
  groups.set(group, (groups.get(group) ?? 0) + module.renderedLength)
}
const report = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  command: 'node scripts/measure-bundle.mjs [output.json]',
  initialJs: { requests: initial.size, ...totals(chunks.filter((chunk) => initial.has(chunk.fileName))) },
  allJs: { requests: chunks.length, ...totals(chunks) },
  coldPageJs: Object.fromEntries(chunks.filter((chunk) => /Page-/.test(chunk.fileName)).map((chunk) => {
    const selected = new Set(initial); visit(chunk.fileName, selected)
    return [chunk.fileName.split('/').at(-1).split('-')[0], { requests: selected.size, ...totals(chunks.filter((entry) => selected.has(entry.fileName))) }]
  })),
  chunks: chunks.map((chunk) => ({ file: chunk.fileName, initial: initial.has(chunk.fileName), ...size(chunk.code), imports: chunk.imports, dynamicImports: chunk.dynamicImports })),
  // Pre-minification module contribution; useful for attribution, not download bytes.
  renderedModuleGroups: Object.fromEntries([...groups].sort((a, b) => b[1] - a[1])),
}
if (process.argv[2]) {
  await mkdir(dirname(process.argv[2]), { recursive: true })
  await writeFile(process.argv[2], `${JSON.stringify(report, null, 2)}\n`)
}
console.log(JSON.stringify(report, null, 2))
