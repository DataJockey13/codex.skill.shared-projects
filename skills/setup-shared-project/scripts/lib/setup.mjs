import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { VERSION, CONFIG, STATE, hash, json, readText, readJSON, safeTarget, relative, inside, physical, atomicWrite, validateConfig, resolveWorkspace } from './core.mjs'
import { acquireLock } from './lock.mjs'
import { satisfies } from './node.mjs'

const scriptRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const begin = '<!-- setup-shared-project:begin -->', end = '<!-- setup-shared-project:end -->'
function walk(root, visit, rel = '.', depth = 0) {
  if (depth > 8) return
  for (const item of fs.readdirSync(path.join(root,rel),{withFileTypes:true})) {
    if (item.isSymbolicLink() || ['node_modules','.git','.runtime','.shared-project','reference'].includes(item.name)) continue
    const name = rel === '.' ? item.name : `${rel}/${item.name}`
    visit(name,item)
    if (item.isDirectory()) walk(root,visit,name,depth+1)
  }
}
export function inspect(root) {
  root = fs.realpathSync(root)
  const packages = [], instructionFiles = [], gitRoots = [], warnings = []
  walk(root,(rel,item) => {
    if (item.isFile() && path.basename(rel) === 'package.json') {
      const p = readJSON(path.join(root,rel)), dir = path.posix.dirname(rel)
      packages.push({path:dir,name:p.name,scripts:p.scripts || {},engines:p.engines || {},packageManager:p.packageManager || 'unbekannt',
        npmLock:fs.existsSync(path.join(root,dir,'package-lock.json')),vite:!!(p.dependencies?.vite || p.devDependencies?.vite),workspaces:p.workspaces || null})
    }
    if (item.isFile() && /^AGENTS(?:\.override)?\.md$/.test(path.basename(rel))) instructionFiles.push(rel)
    if (item.isDirectory() && fs.existsSync(path.join(root,rel,'.git'))) gitRoots.push(rel)
    if (['yarn.lock','pnpm-lock.yaml','bun.lock','bun.lockb'].includes(path.basename(rel))) warnings.push(`Anderer Paketmanager: ${rel}; kein npm-Profil ohne geklärte Migration.`)
  })
  return {root,packages,instructionFiles,gitRoots,warnings,configured:fs.existsSync(path.join(root,CONFIG)),version:VERSION}
}
function section(content) {
  const starts = content.split(begin).length-1, ends = content.split(end).length-1
  if (starts !== ends || starts > 1) throw new Error('Beschädigter/mehrfacher verwalteter AGENTS-Abschnitt.')
  if (!starts) return null
  const start = content.indexOf(begin), stop = content.indexOf(end)+end.length
  if (stop < start) throw new Error('Ungültige Reihenfolge der AGENTS-Marker.')
  return {start,stop,text:content.slice(start,stop)}
}
function managedInstructions(prefix = '.') {
  return `${begin}\n## Gemeinsame Quellen auf Mac und Windows\n\nDie Konfiguration steht in [shared-project.json](${prefix}/shared-project.json).\nLöse logische Pfade mit \`node ${prefix}/.shared-project/tools/cli.mjs resolve NAME\` auf.\nBearbeite die gemeinsame Quelle; lokale Laufzeitkopien sind abgeleitet.\nNutze für konfigurierte Apps \`shared:setup\`, \`shared:dev\`, \`shared:test\` und\n\`shared:build\`, soweit im jeweiligen package.json vorhanden. Native node_modules,\nCaches und Builds bleiben lokal. Installiere keine Abhängigkeiten in die Quelle.\nEine absolute Basis gehört nur nach bases; relative Pfade dürfen sie nicht verlassen.\nEigene Anweisungen und historische Quellen werden bei Updates erhalten.\nToolkit ${VERSION}. Neue Chats lesen diese Regeln; laufende Chats laden sie nicht zwingend nach.\n${end}`
}
function filesIn(dir, rel = '') {
  const list = []
  for (const e of fs.readdirSync(path.join(dir,rel),{withFileTypes:true})) {
    const name = rel ? `${rel}/${e.name}` : e.name
    if (e.isSymbolicLink()) throw new Error('Toolkitpaket darf keine Symlinks enthalten.')
    if (e.isDirectory()) list.push(...filesIn(dir,name))
    else if (e.isFile() && e.name.endsWith('.mjs')) list.push(name)
  }
  return list.sort()
}
export function makePlan(root, spec = {}, { sourceScripts = scriptRoot } = {}) {
  root = fs.realpathSync(root)
  const report = inspect(root), oldState = fs.existsSync(path.join(root,STATE)) ? readJSON(path.join(root,STATE)) : null
  const existing = fs.existsSync(path.join(root,CONFIG)) ? readJSON(path.join(root,CONFIG)) : null
  if (existing && !oldState) throw new Error('Vorhandene shared-project.json ohne Installationszustand: erst Herkunft und Übernahme klären.')
  if (existing && oldState.projectId !== existing.projectId) throw new Error('Projektkennung und Installationszustand stimmen nicht überein. Identitätsänderungen brauchen eine bewusste Übernahme.')
  if (oldState?.toolkitVersion && Number(oldState.toolkitVersion.split('.')[0]) > Number(VERSION.split('.')[0])) throw new Error('Downgrade einer neueren Hauptversion nicht unterstützt.')
  const config = { ...existing,schemaVersion:1,toolkitVersion:VERSION,projectId:existing?.projectId || crypto.randomUUID(),
    bases:existing?.bases || spec.bases, paths:existing?.paths || spec.paths, apps:existing?.apps || {} }
  if (spec.projectId && spec.projectId !== config.projectId) throw new Error('Einrichtung/Update darf die stabile projectId nicht ändern.')
  if (spec.bases) config.bases = {...config.bases,...spec.bases}
  if (spec.paths) config.paths = {...config.paths,...spec.paths}
  if (spec.apps) config.apps = {...config.apps,...spec.apps}
  validateConfig(config)
  // Preview validates the current mount before creating a marker, too.
  const nativeBase = config.bases[process.platform === 'linux' && process.env.WSL_DISTRO_NAME ? 'wsl':process.platform]
  if (!nativeBase || physical(path.resolve(nativeBase,config.paths.project)) !== physical(root)) throw new Error('Native Basis und paths.project müssen genau dieses Zielprojekt adressieren.')
  for (const app of Object.values(config.apps)) {
    if (!satisfies(app.runtime.fallback,app.runtime.range)) throw new Error('Fallback-Node erfüllt den Bereich nicht.')
    const source = safeTarget(root,app.path === '.' ? 'package.json' : `${app.path}/package.json`)
    const manifest = readJSON(source), appRoot = path.dirname(source)
    if (!fs.existsSync(path.join(appRoot,'package-lock.json'))) throw new Error('npm-Profil braucht eine vorhandene Lockdatei; getrennt und nachvollziehbar erzeugen.')
    if (manifest.workspaces || (manifest.packageManager && !manifest.packageManager.startsWith('npm@'))) throw new Error('V1 benötigt eine eigenständige npm-App.')
    if (['pnpm-lock.yaml','yarn.lock','bun.lock','bun.lockb'].some(f => fs.existsSync(path.join(appRoot,f)))) throw new Error('Andere Lockdatei gefunden; Paketmanager vor Einrichtung klären.')
    for (const command of Object.values(app.commands)) if (command.script && !manifest.scripts?.[command.script]) throw new Error(`Paket-Skript fehlt: ${command.script}`)
  }
  const desired = new Map(), managed = { files:{}, sections:{}, scripts:{} }, conflicts = []
  const setFile = (rel, next) => {
    const current = readText(safeTarget(root,rel)), baseline = oldState?.managed?.files?.[rel]
    if (current !== null && current !== next && (baseline === undefined || hash(current) !== baseline)) conflicts.push({path:rel,reason:'Verwaltete Datei weicht vom Ausgangshash ab.',currentHash:hash(current),expectedHash:baseline || null})
    desired.set(rel,next); managed.files[rel] = hash(next)
  }
  // Configuration is user-owned after setup; merge only requested fields and toolkit version.
  desired.set(CONFIG,json(config)); managed.files[CONFIG] = hash(json(config))
  for (const rel of filesIn(sourceScripts).filter(rel => rel === 'cli.mjs' || rel.startsWith('lib/'))) setFile(`.shared-project/tools/${rel}`,fs.readFileSync(path.join(sourceScripts,rel),'utf8'))
  const contexts = ['.',...report.gitRoots]
  for (const dir of contexts) {
    const prefix = path.posix.relative(dir,'.') || '.'
    const override = dir === '.' ? 'AGENTS.override.md':`${dir}/AGENTS.override.md`
    const rel = fs.existsSync(path.join(root,override)) ? override : dir === '.' ? 'AGENTS.md':`${dir}/AGENTS.md`
    const current = readText(safeTarget(root,rel)) || '', old = section(current), next = managedInstructions(prefix)
    const baseline = oldState?.managed?.sections?.[rel]
    if (old && old.text !== next && (baseline === undefined || hash(old.text) !== baseline)) conflicts.push({path:rel,reason:'Verwalteter Anweisungsabschnitt wurde angepasst.'})
    desired.set(rel,old ? current.slice(0,old.start)+next+current.slice(old.stop) : current+(current && !current.endsWith('\n') ? '\n':'')+'\n'+next+'\n')
    managed.sections[rel] = hash(next)
  }
  for (const [rel,digest] of Object.entries(oldState?.managed?.sections || {})) if (!managed.sections[rel]) {
    const current = readText(safeTarget(root,rel))
    if (current === null) continue
    const old = section(current)
    if (old && hash(old.text) !== digest) conflicts.push({path:rel,reason:'Entfernter verwalteter Abschnitt wurde angepasst.'})
    else if (old) desired.set(rel,current.slice(0,old.start)+current.slice(old.stop))
  }
  for (const [name,app] of Object.entries(config.apps)) {
    const rel = app.path === '.' ? 'package.json':`${app.path}/package.json`
    const current = JSON.parse(desired.get(rel) || fs.readFileSync(safeTarget(root,rel),'utf8'))
    current.scripts ||= {}
    const prefix = path.posix.relative(app.path,'.shared-project/tools/cli.mjs')
    const keys = ['setup',...Object.keys(app.commands),...(app.exportPath ? ['export']:[])]
    managed.scripts[rel] = {}
    for (const task of keys) {
      const key = `shared:${task}`, next = `node "${prefix}" run ${name} ${task}`
      const previous = oldState?.managed?.scripts?.[rel]?.[key]
      if (current.scripts[key] !== undefined && current.scripts[key] !== next && current.scripts[key] !== previous) conflicts.push({path:rel,key,reason:'Vorhandenes npm-Skript wird nicht überschrieben.'})
      current.scripts[key] = next; managed.scripts[rel][key] = next
    }
    desired.set(rel,json(current))
  }
  // Removed managed resources are retired only when still unmodified.
  for (const [rel,digest] of Object.entries(oldState?.managed?.files || {})) if (!desired.has(rel)) {
    const current = readText(safeTarget(root,rel))
    if (current !== null && hash(current) !== digest) conflicts.push({path:rel,reason:'Entfernte verwaltete Datei wurde lokal angepasst.'})
    desired.set(rel,null)
  }
  for (const [rel,scripts] of Object.entries(oldState?.managed?.scripts || {})) {
    const current = JSON.parse(desired.get(rel) || fs.readFileSync(safeTarget(root,rel),'utf8'))
    for (const [key,value] of Object.entries(scripts)) if (!managed.scripts[rel]?.[key]) {
      if (current.scripts?.[key] === value) delete current.scripts[key]
      else if (current.scripts?.[key] !== undefined) conflicts.push({path:rel,key,reason:'Entferntes Wrapper-Skript wurde lokal angepasst.'})
    }
    desired.set(rel,json(current))
  }
  const state = {schemaVersion:1,toolkitVersion:VERSION,projectId:config.projectId,managed}
  desired.set(STATE,json(state))
  const entries = [...desired].map(([rel,after]) => {
    const before = readText(safeTarget(root,rel))
    return {path:rel,beforeHash:before === null ? null:hash(before),after,afterHash:after === null ? null:hash(after)}
  })
  return {schemaVersion:1,kind:'shared-project-setup',toolkitVersion:VERSION,root,projectId:config.projectId,
    inspection:report,conflicts,entries,changes:entries.filter(e => e.beforeHash !== e.afterHash).map(e => ({path:e.path,action:e.beforeHash === null ? 'create':e.afterHash === null ? 'delete':'update'}))}
}
export function applyPlan(plan, { afterWrite } = {}) {
  if (plan.schemaVersion !== 1 || !['shared-project-setup','shared-project-migration'].includes(plan.kind) || plan.conflicts?.length) throw new Error('Plan ungültig oder enthält ungelöste Konflikte.')
  const root = fs.realpathSync(plan.root)
  const unlock = acquireLock(safeTarget(root,'.shared-project/setup.lock'))
  try {
    const seen = new Set()
    for (const entry of plan.entries) {
      if (seen.has(entry.path)) throw new Error('Doppeltes Planziel.'); seen.add(entry.path)
      const before = readText(safeTarget(root,entry.path))
      if ((before === null ? null:hash(before)) !== entry.beforeHash) throw new Error(`Plan veraltet: ${entry.path}. Vorschau erneut erzeugen.`)
      if ((entry.after === null ? null:hash(entry.after)) !== entry.afterHash) throw new Error('Planinhalt/Hash inkonsistent.')
    }
    const changes = plan.entries.filter(e => e.beforeHash !== e.afterHash)
    if (!changes.length) return {changed:0,journal:null}
    const journalPath = path.join(root,'.shared-project/transactions',`${crypto.randomUUID()}.json`)
    const journal = {schemaVersion:1,root,kind:plan.kind,status:'pending',entries:changes.map(e => ({...e,before:readText(safeTarget(root,e.path))}))}
    atomicWrite(journalPath,json(journal))
    try {
      for (const e of changes) {
        const file = safeTarget(root,e.path)
        if (e.after === null) fs.rmSync(file,{force:true}); else atomicWrite(file,e.after)
        afterWrite?.(e.path)
      }
      journal.status = 'applied'; atomicWrite(journalPath,json(journal))
      return {changed:changes.length,journal:journalPath}
    } catch (error) {
      try { rollback(journalPath,{allowPending:true,locked:true}) } catch (e) { throw new Error(`${error.message}; Rückweg: ${journalPath}; ${e.message}`) }
      throw error
    }
  } finally { unlock() }
}
export function rollback(journalPath, {allowPending = false, locked = false} = {}) {
  const j = readJSON(journalPath)
  if (j.schemaVersion !== 1 || !['applied',...(allowPending ? ['pending']:[])].includes(j.status)) throw new Error('Journal ist nicht zurückrollbar.')
  if (!inside(physical(path.join(j.root,'.shared-project/transactions')),physical(journalPath))) throw new Error('Journal liegt außerhalb des Zielprojekts.')
  const unlock = locked ? () => {}:acquireLock(safeTarget(j.root,'.shared-project/setup.lock'))
  try {
    for (const e of j.entries) {
      const current = readText(safeTarget(j.root,e.path)), digest = current === null ? null:hash(current)
      if (digest !== e.afterHash && !(allowPending && digest === e.beforeHash)) throw new Error(`Rollback-Konflikt: ${e.path}. Nachträgliche Änderungen bleiben erhalten.`)
      if ((e.before === null ? null:hash(e.before)) !== e.beforeHash) throw new Error('Beschädigter Journalinhalt.')
    }
    for (const e of [...j.entries].reverse()) {
      const file = safeTarget(j.root,e.path)
      if (e.before === null) fs.rmSync(file,{force:true}); else atomicWrite(file,e.before)
    }
    j.status = 'rolled-back'; atomicWrite(journalPath,json(j))
    return {rolledBack:j.entries.length}
  } finally { unlock() }
}
export function migrationPlan(root, edits) {
  root = fs.realpathSync(root)
  if (!Array.isArray(edits) || !edits.length) throw new Error('Explizite Migrationsstellen fehlen.')
  const originals = new Map(), pending = new Map()
  const content = rel => {
    if (!originals.has(rel)) originals.set(rel,fs.readFileSync(safeTarget(root,rel),'utf8'))
    return pending.get(rel) ?? originals.get(rel)
  }
  for (const edit of [...edits.filter(e=>e.kind!=='checksum'),...edits.filter(e=>e.kind==='checksum')]) {
    if (!['config','markdown-link','checksum'].includes(edit.kind)) throw new Error('Migration nur für explizite Konfigurationswerte, Markdown-Linkziele und deren Prüfsummen. Rohquellen bleiben unangetastet.')
    const before = content(edit.path)
    let after
    if (edit.kind === 'config' || edit.kind === 'checksum') {
      const value = JSON.parse(before), parts = edit.pointer?.split('/').slice(1).map(s => s.replaceAll('~1','/').replaceAll('~0','~'))
      if (!edit.pointer?.startsWith('/') || !parts.length || parts.some(p => ['__proto__','constructor','prototype'].includes(p))) throw new Error('Expliziter JSON-Pointer erforderlich.')
      let parent = value
      for (const part of parts.slice(0,-1)) { if (!Object.hasOwn(parent,part)) throw new Error('JSON-Pointer fehlt.'); parent = parent[part] }
      const key = parts.at(-1)
      const to = edit.kind === 'checksum' ? hash(content(edit.of)) : edit.to
      if (edit.kind === 'checksum' && edit.path === edit.of) throw new Error('Keine selbstreferenzielle Prüfsumme.')
      if (!Object.hasOwn(parent,key) || typeof edit.from !== 'string' || parent[key] !== edit.from || typeof to !== 'string') throw new Error('Migrationsausgangswert stimmt nicht überein.')
      parent[key] = to; after = json(value)
    } else {
      if (!edit.from || /[\r\n()]/.test(edit.from+edit.to) || !/^(?:\.\.?\/|[\w%\u0080-\uffff])/.test(edit.to) || /^(?:https?:|[A-Z]:)/i.test(edit.to)) throw new Error('Migration braucht ein wirkliches relatives Linkziel.')
      const needle = `](${edit.from})`
      if (before.split(needle).length !== 2) throw new Error('Linkziel muss genau einmal vorkommen; Stelle genauer vorbereiten.')
      if (!fs.existsSync(path.resolve(root,path.dirname(edit.path),decodeURIComponent(edit.to.split('#')[0])))) throw new Error('Neues Linkziel existiert nicht.')
      after = before.replace(needle,`](${edit.to})`)
    }
    pending.set(edit.path,after)
  }
  const entries=[...pending].map(([rel,after])=>({path:rel,beforeHash:hash(originals.get(rel)),after,afterHash:hash(after)}))
  return {schemaVersion:1,kind:'shared-project-migration',root,conflicts:[],entries,changes:entries.map(e => ({path:e.path,action:'update'}))}
}
