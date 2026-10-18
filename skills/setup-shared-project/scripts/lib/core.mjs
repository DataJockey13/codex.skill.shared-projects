import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export const VERSION = '1.0.0'
export const CONFIG = 'shared-project.json'
export const STATE = '.shared-project/state.json'
export const hash = value => crypto.createHash('sha256').update(value).digest('hex')
export const json = value => JSON.stringify(value, null, 2) + '\n'
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'))
export function readText(file) {
  try { return fs.readFileSync(file, 'utf8') } catch (e) { if (e.code === 'ENOENT') return null; throw e }
}
export function atomicWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${crypto.randomUUID()}.tmp`
  try { fs.writeFileSync(temp, bytes); fs.renameSync(temp, file) }
  finally { fs.rmSync(temp, { force: true }) }
}
export function relative(value, label = 'Pfad', allowDot = false) {
  if (typeof value !== 'string' || !value || value.includes('\\') || /[:*?<>|"\x00-\x1f]/.test(value) || value.startsWith('/') ||
      value.split('/').some(p => p === '..' || !p || (p === '.' && !(allowDot && value === '.')))) {
    throw new Error(`${label}: relativer Pfad mit / ohne .., Laufwerk oder leere Segmente erforderlich.`)
  }
  return value
}
export function joinShared(base, rel, platform = process.platform) {
  relative(rel, 'Logischer Pfad', true)
  const p = platform === 'win32' ? path.win32 : path.posix
  if (!p.isAbsolute(base) || (platform !== 'win32' && /^(?:[a-z]:|\\)/i.test(base))) throw new Error('Ungültige absolute Basis für diese Umgebung.')
  return p.resolve(base, rel)
}
export function environment(env = process.env, platform = process.platform) {
  return platform === 'linux' && (env.WSL_DISTRO_NAME || env.WSL_INTEROP) ? 'wsl' : platform
}
export function inside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel))
}
// Resolve existing ancestors too, so a symlink cannot redirect a newly created output.
export function physical(file) {
  let p = path.resolve(file), tail = []
  while (!fs.existsSync(p)) { tail.unshift(path.basename(p)); const up = path.dirname(p); if (up === p) break; p = up }
  return path.join(fs.realpathSync(p), ...tail)
}
export function safeTarget(root, rel) {
  relative(rel)
  const file = path.resolve(root, rel)
  if (!inside(physical(root), physical(file))) throw new Error(`Pfad verlässt das Projekt über einen Symlink: ${rel}`)
  // Managed files and ancestors must not themselves be links, including internal links.
  let current = path.resolve(root)
  for (const part of rel.split('/')) {
    current = path.join(current, part)
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink als verwaltetes Ziel: ${rel}`)
  }
  return file
}
export function validateConfig(c) {
  if (c.schemaVersion !== 1 || typeof c.toolkitVersion !== 'string') throw new Error('Unbekannte Schema-/Toolkit-Version.')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(c.projectId)) throw new Error('Stabile Projektkennung fehlt oder ist ungültig.')
  if (!c.paths?.project || !c.bases || !c.apps || Array.isArray(c.apps)) throw new Error('paths.project, bases und apps sind erforderlich.')
  for (const [name, rel] of Object.entries(c.paths)) { if (!/^[a-zA-Z][\w-]*$/.test(name)) throw new Error('Ungültiger Pfadname.'); relative(rel, name, true) }
  for (const [key, base] of Object.entries(c.bases)) {
    if (!['darwin','win32','linux','wsl'].includes(key) || typeof base !== 'string') throw new Error('Unbekannte Basisumgebung.')
    joinShared(base, '.', key)
  }
  const appPaths = new Set()
  for (const [name, app] of Object.entries(c.apps)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !['npm','npm-vite'].includes(app.profile)) throw new Error('Ungültiger Appname oder Profil (npm/npm-vite).')
    relative(app.path, 'Apppfad relativ zum Projekt', true)
    if (appPaths.has(app.path)) throw new Error('Anwendungspfade müssen eindeutig sein, sonst kollidieren Paket-Wrapper.')
    appPaths.add(app.path)
    if (!Array.isArray(app.sources) || !app.sources.length) throw new Error('Quellauswahl fehlt.')
    for (const entry of [...app.sources, ...(app.exclude || []), ...(app.restart || [])]) relative(entry, 'Quellauswahl', true)
    if (!app.commands || !app.runtime?.range || !/^\d+\.\d+\.\d+$/.test(app.runtime.fallback)) throw new Error('Befehle oder Node-Anforderung fehlen.')
    for (const [task, command] of Object.entries(app.commands)) {
      if (!/^[a-z][a-z0-9-]*$/.test(task) || ['info','setup','export','guard'].includes(task)) throw new Error(`Reservierte/ungültige Aufgabe: ${task}`)
      if (command.script) {
        if (Object.keys(command).some(k => k !== 'script') || !/^[\w:.-]+$/.test(command.script) || command.script.startsWith('shared:')) throw new Error('Ungültiges oder rekursives Paket-Skript.')
      } else if (!Array.isArray(command.node) || !command.node.length || command.node.some(v => typeof v !== 'string' || v.includes('\0'))) throw new Error('Befehl braucht script oder node-Argumentliste.')
    }
    if (app.buildOutput) { relative(app.buildOutput); if (['node_modules','.git','.shared-project'].some(p => app.buildOutput.split('/').includes(p))) throw new Error('Ungültiges Buildziel.') }
    if (app.exportPath) relative(app.exportPath)
    for (const [key, value] of Object.entries(app.envPaths || {})) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key) || ['HOME','USERPROFILE','CODEX_HOME','PATH'].includes(key) || !Object.hasOwn(c.paths, value)) throw new Error('Ungültige Pfad-Umgebungsvariable.')
    }
  }
  return c
}
export function resolveWorkspace({ root, settings = readJSON(path.join(root, CONFIG)), platform = process.platform, env = process.env,
  exists = fs.existsSync, read = file => fs.readFileSync(file, 'utf8') } = {}) {
  validateConfig(settings)
  const kind = environment(env, platform), p = platform === 'win32' ? path.win32 : path.posix
  const override = Object.hasOwn(env, 'SHARED_ROOT')
  let inferred = root
  for (const part of settings.paths.project === '.' ? [] : settings.paths.project.split('/')) inferred = p.dirname(inferred)
  const same = (a,b) => platform === 'win32' ? p.normalize(a).toLowerCase() === p.normalize(b).toLowerCase() : p.normalize(a) === p.normalize(b)
  const candidates = override ? [env.SHARED_ROOT] : [settings.bases[kind], inferred].filter(Boolean)
  const failures = []
  for (const base of [...new Set(candidates)]) {
    try {
      const project = joinShared(base, settings.paths.project, platform)
      const marker = p.join(project, CONFIG)
      if (!exists(marker) || JSON.parse(read(marker)).projectId !== settings.projectId) throw new Error('Projektkennung stimmt nicht überein')
      if (!same(project, root)) {
        if (platform !== process.platform || !same(fs.realpathSync(project), fs.realpathSync(root))) throw new Error('Basis adressiert eine andere Quellinstanz')
      }
      const paths = Object.fromEntries(Object.entries(settings.paths).map(([k,v]) => [k, joinShared(base,v,platform)]))
      if (platform === process.platform && exists === fs.existsSync) for (const target of Object.values(paths)) {
        if (!inside(physical(base), physical(target))) throw new Error('Logischer Pfad verlässt die Basis über einen Symlink')
      }
      return { environment: kind, platform, architecture: process.arch, sharedRoot: p.resolve(base), paths }
    } catch (e) { failures.push(e.message) }
  }
  throw new Error(`${override ? 'Explizites SHARED_ROOT ungültig' : 'Gemeinsame Basis nicht erreichbar'} (${kind}): ${failures.join('; ')}.`)
}
export function cacheRoot({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const p = platform === 'win32' ? path.win32 : path.posix
  return env.SHARED_PROJECT_CACHE || (platform === 'win32' ? p.join(env.LOCALAPPDATA || p.join(home,'AppData','Local'),'codex-shared-projects') :
    platform === 'darwin' ? p.join(home,'Library','Caches','codex-shared-projects') : p.join(env.XDG_CACHE_HOME || p.join(home,'.cache'),'codex-shared-projects'))
}
