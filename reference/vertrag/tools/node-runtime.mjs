import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { config } from './paths.mjs'

export function supportedNode(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number)
  return (major === 22 && minor >= 18) || major > 24 || (major === 24 && minor >= 12)
}

export async function reexecIfNeeded(script, args) {
  if (supportedNode(process.versions.node)) return false
  const version = config.runtime.fallbackNode
  if (!/^\d+\.\d+\.\d+$/.test(version) || !supportedNode(version)) throw new Error('Ungültige lokale Node-Version in workspace.paths.json.')
  if (!['win32','darwin','linux'].includes(process.platform) || !['x64','arm64'].includes(process.arch)) {
    throw new Error('Bitte eine Node-Version gemäß package.json für diese Umgebung installieren.')
  }
  const base = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData','Local'), 'Vertrag','tools')
    : path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches/Vertrag/tools' : '.cache/vertrag/tools')
  const platform = process.platform === 'win32' ? 'win' : process.platform
  const name = `node-v${version}-${platform}-${process.arch}`
  const archiveName = name + (process.platform === 'win32' ? '.zip' : '.tar.gz')
  const directory = path.join(base, name)
  const executable = path.join(directory, process.platform === 'win32' ? 'node.exe' : 'bin/node')
  const receipt = path.join(directory, '.verified-download.json')
  if (!fs.existsSync(executable) || !fs.existsSync(receipt)) {
    fs.mkdirSync(base, { recursive: true })
    const lock = path.join(base, `${name}.lock`)
    let fd
    try { fd = fs.openSync(lock, 'wx') }
    catch { throw new Error('Die lokale Node-Einrichtung ist bereits aktiv. Nach deren Abschluss den Befehl erneut starten.') }
    const archive = path.join(base, archiveName)
    try {
      console.log(`Node ${process.versions.node} ist zu alt. Lade lokal Node ${version} von nodejs.org …`)
      const get = async file => {
        const response = await fetch(`https://nodejs.org/dist/v${version}/${file}`, { signal: AbortSignal.timeout(120000) })
        if (!response.ok) throw new Error(`Node-Download fehlgeschlagen: HTTP ${response.status}`)
        return Buffer.from(await response.arrayBuffer())
      }
      const sums = (await get('SHASUMS256.txt')).toString('utf8')
      const line = sums.split('\n').find(value => value.trim().split(/\s+/)[1] === archiveName)
      const expected = line?.trim().split(/\s+/)[0]
      if (!expected || !/^[0-9a-f]{64}$/.test(expected)) throw new Error('Offizielle Node-Prüfsumme fehlt.')
      const bytes = await get(archiveName)
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Node-Download stimmt nicht mit der offiziellen SHA-256-Prüfsumme überein.')
      fs.writeFileSync(archive, bytes)
      const result = spawnSync(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-xf', archive, '-C', base], { stdio: 'inherit' })
      if (result.status !== 0 || !fs.existsSync(executable)) throw new Error('Lokale Node-Distribution konnte nicht entpackt werden; tar wird benötigt.')
      fs.writeFileSync(receipt, JSON.stringify({ version, archive: archiveName, sha256: expected, source: 'https://nodejs.org/dist/' }))
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); fs.rmSync(archive, { force: true }) }
  }
  const checked = spawnSync(executable, ['--version'], { encoding: 'utf8' })
  if (checked.status !== 0 || checked.stdout.trim() !== `v${version}`) throw new Error('Lokale Node-Version konnte nicht gestartet werden.')
  const npm = path.join(directory, process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js')
  console.log(`Verwende projektlokales Node ${version}.`)
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(executable, [script, ...args], { stdio: 'inherit', env: { ...process.env, npm_execpath: npm } })
    const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM')
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate)
    const clean = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate) }
    child.once('error', error => { clean(); reject(error) })
    child.once('exit', code => { clean(); resolve(code ?? 1) })
  })
  return true
}
