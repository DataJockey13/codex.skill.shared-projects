import fs from 'node:fs'
import path from 'node:path'
import { VERSION, hash, json, atomicWrite, readJSON, relative } from './core.mjs'

export const MANIFEST = 'skill-package.json'
export function packageFiles(root, rel = '') {
  const result = []
  for (const e of fs.readdirSync(path.join(root,rel),{withFileTypes:true})) {
    const name = rel ? `${rel}/${e.name}`:e.name
    if (e.isSymbolicLink()) throw new Error(`Symlink im Skillpaket: ${name}`)
    if ([MANIFEST,'.installation.json'].includes(name)) continue
    if (e.isDirectory()) result.push(...packageFiles(root,name))
    else if (e.isFile()) result.push(name)
    else throw new Error('Unbekannter Dateityp im Skillpaket.')
  }
  return result.sort()
}
export function pack(root) {
  const files = Object.fromEntries(packageFiles(root).map(rel => [rel,hash(fs.readFileSync(path.join(root,rel)))]))
  const manifest = {schemaVersion:1,name:'setup-shared-project',version:VERSION,files}
  atomicWrite(path.join(root,MANIFEST),json(manifest))
  return manifest
}
export function verifyPackage(root, {version = VERSION} = {}) {
  const m = readJSON(path.join(root,MANIFEST))
  if (m.schemaVersion !== 1 || m.name !== 'setup-shared-project' || m.version !== version) throw new Error('Skillpaket-Version ungültig.')
  const actual = packageFiles(root)
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(m.files).sort())) throw new Error('Skillpaket-Dateiliste stimmt nicht.')
  for (const [rel,digest] of Object.entries(m.files)) {
    relative(rel)
    if (hash(fs.readFileSync(path.join(root,rel))) !== digest) throw new Error(`Skillpaket-Prüfsumme falsch: ${rel}`)
  }
  if (!actual.includes('SKILL.md') || !actual.includes('scripts/cli.mjs')) throw new Error('Unvollständiges Skillpaket.')
  return m
}
