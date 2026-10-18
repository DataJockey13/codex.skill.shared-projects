import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'reference-manifest.json'), 'utf8'))
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const byOrigin = new Map()
for (const entry of manifest.files) {
  if (!entry.path.startsWith('reference/') || entry.path.includes('\\') ||
      entry.path.split('/').includes('..') || path.isAbsolute(entry.path)) throw new Error('Ungültiger Referenzpfad.')
  const file = path.join(root, entry.path)
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Referenz ist ein Symlink: ${entry.path}`)
  const bytes = fs.readFileSync(file)
  if (bytes.length !== entry.size || digest(bytes) !== entry.sha256) throw new Error(`Referenz wurde verändert: ${entry.path}`)
  byOrigin.set(entry.source, entry)
}
const proof = JSON.parse(fs.readFileSync(path.join(root, 'reference/vertrag/verification.reference.json'), 'utf8'))
for (const [source, sha256] of Object.entries(proof.runner_files)) {
  if (byOrigin.get(source)?.sha256 !== sha256) throw new Error(`Werkzeug stimmt nicht mit ursprünglicher Abnahme überein: ${source}`)
}
if (byOrigin.get('workspace.paths.json')?.sha256 !== proof.configuration_sha256) throw new Error('Abgenommene Basiskonfiguration stimmt nicht überein.')
if (!proof.windows.passed || !proof.mac.frontend_typecheck_and_build || !proof.mac.design_typecheck_and_build) throw new Error('Historische Abnahme ist unvollständig.')
for (const name of ['README.md', 'AGENTS.md', 'UEBERGABE.md', 'STARTPROMPT.md']) {
  const text = fs.readFileSync(path.join(root, name), 'utf8')
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1]
    if (/^(?:https?:|#)/.test(target)) continue
    const file = path.resolve(root, decodeURIComponent(target.split('#')[0]))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) throw new Error(`Defekter interner Verweis in ${name}: ${target}`)
  }
}
console.log(`Übergabe geprüft: ${manifest.files.length} bytegleiche Referenzdateien, ursprüngliche Werkzeugabnahme und lokale Dokumentverweise stimmen.`)
