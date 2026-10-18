import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { projectRoot, resolveWorkspace } from './paths.mjs'
import { reexecIfNeeded } from './node-runtime.mjs'

const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const runtimeFolders = ['src', 'tests', 'public']
const runtimeFile = name => ['package.json', 'package-lock.json', 'index.html', '.npmrc'].includes(name) ||
  /^(?:vite\.config\.|tsconfig.*\.json$|\.env(?:\.|$))/.test(name)

export function runtimeDirectory(app, role, { platform = process.platform, arch = process.arch,
  nodeMajor = process.versions.node.split('.')[0], env = process.env, home = os.homedir() } = {}) {
  const p = platform === 'win32' ? path.win32 : path.posix
  const cache = env.VERTRAG_RUNTIME_ROOT || (platform === 'win32'
    ? p.join(env.LOCALAPPDATA || p.join(home, 'AppData', 'Local'), 'Vertrag', 'runtime')
    : platform === 'darwin' ? p.join(home, 'Library', 'Caches', 'Vertrag', 'runtime')
    : p.join(env.XDG_CACHE_HOME || p.join(home, '.cache'), 'vertrag', 'runtime'))
  return p.join(cache, `${platform}-${arch}-node${nodeMajor}`, app, role)
}

export function syncSources(source, destination) {
  const previousFile = path.join(destination, '.source-files.json')
  const previous = fs.existsSync(previousFile) ? JSON.parse(fs.readFileSync(previousFile, 'utf8')) : []
  const current = []
  const copy = relative => {
    const from = path.join(source, relative), to = path.join(destination, relative)
    const stat = fs.lstatSync(from)
    if (stat.isSymbolicLink()) throw new Error(`Symlink in Laufzeitquelle bitte ausdrücklich prüfen: ${relative}`)
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(from)) copy(path.join(relative, name))
      return
    }
    if (!stat.isFile()) return
    let bytes = fs.readFileSync(from)
    if (relative === 'package.json') {
      const manifest = JSON.parse(bytes)
      // The generated runtime installs dependencies without calling the shared wrapper.
      delete manifest.scripts
      bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
    }
    current.push(relative)
    if (!fs.existsSync(to) || !bytes.equals(fs.readFileSync(to))) {
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.writeFileSync(to, bytes)
    }
  }
  fs.mkdirSync(destination, { recursive: true })
  for (const name of fs.readdirSync(source)) {
    if (runtimeFolders.includes(name) || runtimeFile(name)) copy(name)
  }
  const wanted = new Set(current)
  for (const relative of previous) {
    if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
      throw new Error('Ungültiger Eintrag im lokalen Laufzeitmanifest.')
    }
    if (!wanted.has(relative)) fs.rmSync(path.join(destination, relative), { force: true })
  }
  if (JSON.stringify(previous) !== JSON.stringify(current)) fs.writeFileSync(previousFile, JSON.stringify(current))
}

export function acquireLock(directory) {
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, '.runner.lock')
  const value = JSON.stringify({ pid: process.pid, hostname: os.hostname() })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, value, { flag: 'wx' })
      return () => { if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === value) fs.unlinkSync(file) }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      let owner
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { throw new Error(`Ungültige Laufzeitsperre: ${file}`) }
      if (owner.hostname !== os.hostname()) throw new Error('Dieses Ausgabeziel wird auf einer anderen Umgebung verwendet.')
      let alive = true
      try { process.kill(owner.pid, 0) } catch (e) { if (e.code === 'ESRCH') alive = false }
      if (alive) throw new Error(`Diese Laufzeit ist bereits aktiv (PID ${owner.pid}). Dev und Tests verwenden getrennte Laufzeiten.`)
      fs.unlinkSync(file)
    }
  }
  throw new Error('Laufzeitsperre konnte nicht erworben werden.')
}

export function quarantineModules(source, app) {
  const modules = path.join(source, 'node_modules')
  if (!fs.existsSync(modules)) return
  const backup = path.join(runtimeDirectory(app, 'previous-installations'), `${Date.now()}-${crypto.randomUUID()}`)
  fs.mkdirSync(path.dirname(backup), { recursive: true })
  try { fs.renameSync(modules, backup) }
  catch (error) {
    if (error.code !== 'EXDEV') throw error
    fs.cpSync(modules, backup, { recursive: true })
    fs.rmSync(modules, { recursive: true })
  }
  console.log(`Vorherige Installation lokal gesichert: ${backup}`)
  return backup
}

function run(executable, args, cwd, env, shell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, stdio: 'inherit', shell })
    const stop = signal => { if (!child.killed) child.kill(signal) }
    const interrupt = () => stop('SIGINT'), terminate = () => stop('SIGTERM')
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate)
    const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate) }
    child.once('error', error => { cleanup(); reject(error) })
    child.once('exit', (code, signal) => {
      cleanup()
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(executable)} endete mit ${signal || code}.`))
    })
  })
}

export async function main(action = 'info', app = 'frontend', extra = []) {
  if (action === 'block-install') {
    if (![projectRoot, path.join(projectRoot, 'vertrag.csi'), path.join(projectRoot, 'vertrag.csi.entwurf')]
      .includes(path.resolve(process.cwd()))) throw new Error('Installationsschutz nur im gemeinsamen Quellordner aufrufen.')
    quarantineModules(process.cwd(), app === 'design' ? 'design' : 'frontend')
    throw new Error('Keine Installation im gemeinsamen Quellordner. Verwende npm run setup; die Abhängigkeiten werden lokal pro Umgebung installiert.')
  }
  if (!['frontend', 'design'].includes(app)) throw new Error('Anwendung muss frontend oder design sein.')
  if (!['info','setup','dev','test','type-check','build','preview','export'].includes(action)) throw new Error(`Unbekannte Aktion: ${action}`)
  if (await reexecIfNeeded(fileURLToPath(import.meta.url), [action, app, ...extra])) return
  const workspace = resolveWorkspace()
  const source = workspace.paths[app]
  const role = action === 'dev' ? 'dev' : ['build','preview','export'].includes(action) ? 'build' : 'check'
  const runtime = runtimeDirectory(app, role)
  if (path.resolve(runtime).startsWith(path.resolve(projectRoot) + path.sep)) {
    throw new Error('VERTRAG_RUNTIME_ROOT muss außerhalb des gemeinsamen Projektordners liegen.')
  }
  if (action === 'info') { console.log(JSON.stringify({ source, runtime, ...workspace }, null, 2)); return }
  const release = acquireLock(runtime)
  let timer
  try {
    syncSources(source, runtime)
    const env = { ...process.env, SHARED_ROOT: workspace.sharedRoot,
      VERTRAG_ROOT: workspace.paths.project, CURASOFT_API_ROOT: workspace.paths.api }
    const fingerprint = hash(fs.readFileSync(path.join(runtime, 'package.json')) +
      fs.readFileSync(path.join(runtime, 'package-lock.json')) +
      (fs.existsSync(path.join(runtime, '.npmrc')) ? fs.readFileSync(path.join(runtime, '.npmrc')) : ''))
    const installed = path.join(runtime, '.dependencies.sha256')
    if (!fs.existsSync(path.join(runtime, 'node_modules', 'vite', 'bin', 'vite.js')) ||
        !fs.existsSync(installed) || fs.readFileSync(installed, 'utf8') !== fingerprint) {
      console.log(`Installiere lokale Abhängigkeiten: ${runtime}`)
      if (env.npm_execpath && fs.existsSync(env.npm_execpath)) {
        await run(process.execPath, [env.npm_execpath, 'ci', '--no-audit', '--no-fund'], runtime, env)
      } else {
        // Only fixed arguments enter the Windows command shell.
        await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], runtime, env, process.platform === 'win32')
      }
      fs.writeFileSync(installed, fingerprint)
    }
    console.log(`Laufzeit: ${runtime}`)
    const node = args => run(process.execPath, args, runtime, env)
    const vite = args => node([path.join(runtime, 'node_modules', 'vite', 'bin', 'vite.js'), ...args])
    const typecheck = () => node([path.join(runtime, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js'), '--noEmit'])
    const build = async () => { await typecheck(); await vite(['build', ...extra]) }
    if (action === 'setup') return
    if (action === 'test') {
      const tests = fs.readdirSync(path.join(runtime, 'tests')).filter(name => name.endsWith('.test.ts')).sort()
      await node(['--experimental-strip-types', '--test', ...extra, ...tests.map(name => path.join('tests', name))])
    } else if (action === 'type-check') await typecheck()
    else if (action === 'build') await build()
    else if (action === 'export') {
      await build()
      const unlockExport = acquireLock(path.join(source, '.runtime', 'export'))
      try {
        const staging = path.join(source, '.runtime', 'export', 'staging')
        const previous = path.join(source, '.runtime', 'export', 'previous')
        const target = path.join(source, 'dist')
        fs.rmSync(staging, { recursive: true, force: true })
        fs.cpSync(path.join(runtime, 'dist'), staging, { recursive: true })
        fs.rmSync(previous, { recursive: true, force: true })
        if (fs.existsSync(target)) fs.renameSync(target, previous)
        try { fs.renameSync(staging, target) }
        catch (error) { if (fs.existsSync(previous)) fs.renameSync(previous, target); throw error }
        fs.rmSync(previous, { recursive: true, force: true })
        console.log(`Exportiert: ${path.join(source, 'dist')}`)
      } finally { unlockExport() }
    } else if (action === 'preview') {
      if (!fs.existsSync(path.join(runtime, 'dist', 'index.html'))) await build()
      await vite(['preview', '--host', '127.0.0.1', ...extra])
    } else if (action === 'dev') {
      const packageHash = () => hash(fs.readFileSync(path.join(source, 'package.json')) + fs.readFileSync(path.join(source, 'package-lock.json')))
      const initial = packageHash()
      let warned = false
      timer = setInterval(() => {
        try {
          if (packageHash() !== initial) {
            if (!warned) console.error('Abhängigkeiten geändert. Dev-Server neu starten, damit die lokale Installation aktualisiert wird.')
            warned = true
            return
          }
          syncSources(source, runtime)
        } catch (error) { console.error(`Quellabgleich fehlgeschlagen: ${error.message}`) }
      }, 1000)
      await vite(['--host', '127.0.0.1', ...extra])
    }
  } finally { if (timer) clearInterval(timer); release() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [, , action, app, ...extra] = process.argv
  try { await main(action, app, extra) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
