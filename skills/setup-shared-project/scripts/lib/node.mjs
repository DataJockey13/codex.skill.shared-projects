import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { hash, json, atomicWrite } from './core.mjs'
import { acquireLock } from './lock.mjs'

const tuple = v => {
  if (!/^v?\d+\.\d+\.\d+$/.test(v)) throw new Error(`Ungültige stabile Node-Version: ${v}`)
  return v.replace(/^v/,'').split('.').map(Number)
}
const compare = (a,b) => { for (let i=0;i<3;i++) if (a[i] !== b[i]) return Math.sign(a[i]-b[i]); return 0 }
// Deliberately documented subset of npm semver; unknown syntax is rejected.
export function satisfies(version, range) {
  const v = tuple(version)
  return range.split('||').map(branch => {
    const tokens = branch.trim().split(/\s+/)
    if (!tokens.length || !tokens[0]) throw new Error('Leerer Node-Versionsbereich.')
    return tokens.map(token => {
      const m = token.match(/^(>=|<=|>|<|=|\^|~)?(\d+)\.(\d+)\.(\d+)$/)
      if (!m) throw new Error(`Nicht unterstützter Versionsbereich: ${token}. Nutze vollständige Versionen mit Vergleich, ^, ~ oder ||.`)
      const op = m[1] || '=', target = m.slice(2).map(Number), cmp = compare(v,target)
      if (op === '^' || op === '~') {
        const upper = op === '~' ? [target[0],target[1]+1,0] : target[0] ? [target[0]+1,0,0] : target[1] ? [0,target[1]+1,0] : [0,0,target[2]+1]
        return cmp >= 0 && compare(v,upper) < 0
      }
      return { '>=':cmp>=0, '<=':cmp<=0, '>':cmp>0, '<':cmp<0, '=':cmp===0 }[op]
    }).every(Boolean)
  }).some(Boolean)
}
export function run(exe, args, {cwd, env = process.env, quiet = false, onChild} = {}) {
  return new Promise((resolve,reject) => {
    const child = spawn(exe,args,{cwd,env,stdio:quiet ? 'pipe' : 'inherit',shell:false,detached:process.platform !== 'win32'})
    let output = ''
    if (quiet) { child.stdout.on('data',b => { output+=b }); child.stderr.on('data',b => { output+=b }) }
    const stop = signal => {
      if (!child.pid) return
      if (process.platform === 'win32') spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'})
      else { try { process.kill(-child.pid,signal) } catch(e) { if(e.code !== 'ESRCH')throw e } }
    }
    const interrupt = () => stop('SIGINT'), terminate = () => stop('SIGTERM')
    process.on('SIGINT',interrupt); process.on('SIGTERM',terminate)
    const clean = () => { process.off('SIGINT',interrupt); process.off('SIGTERM',terminate) }
    child.once('error',e => { clean(); reject(e) })
    child.once('close',(code,signal) => { clean(); code === 0 ? resolve(output) : reject(new Error(`${path.basename(exe)} endete mit ${signal || code}. ${output}`)) })
    onChild?.(child)
  })
}
export function findNpm(executable = process.execPath) {
  const root = path.dirname(executable)
  const candidates = [path.join(root,'node_modules/npm/bin/npm-cli.js'), path.join(root,'../lib/node_modules/npm/bin/npm-cli.js')]
  if (executable === process.execPath && process.env.npm_execpath?.endsWith('npm-cli.js')) candidates.unshift(process.env.npm_execpath)
  const npm = candidates.find(p => fs.existsSync(p))
  if (!npm) throw new Error('npm-cli.js fehlt neben Node. Installiere eine vollständige offizielle Node-Distribution mit npm: https://nodejs.org/en/download .')
  return npm
}
export function verifyArchive(bytes, sums, archive) {
  const expected = sums.split(/\r?\n/).map(l => l.trim().split(/\s+/)).find(parts => parts[1] === archive)?.[0]
  if (!/^[a-f0-9]{64}$/.test(expected || '') || hash(bytes) !== expected) throw new Error('Node-Download: offizielle SHA-256-Prüfsumme fehlt oder stimmt nicht überein.')
  return expected
}
export async function ensureNode(requirement, base, { version = process.versions.node, platform = process.platform, arch = process.arch,
  download = async url => { const r = await fetch(url,{signal:AbortSignal.timeout(120000)}); if (!r.ok) throw new Error(`Download HTTP ${r.status}: ${url}`); return Buffer.from(await r.arrayBuffer()) },
  extract = (archive, dest) => { const r = spawnSync(platform === 'win32' ? 'tar.exe':'tar',['-xf',archive,'-C',dest],{stdio:'inherit'}); if (r.status !== 0) throw new Error('Node entpacken fehlgeschlagen; tar erforderlich.') }
} = {}) {
  if (!satisfies(requirement.fallback,requirement.range)) throw new Error('Bootstrap-Version erfüllt die konfigurierte Node-Anforderung nicht.')
  if (satisfies(version,requirement.range)) return { executable:process.execPath, version, npm:findNpm(), bootstrapped:false }
  if (!['darwin','win32','linux'].includes(platform) || !['arm64','x64'].includes(arch)) throw new Error('Keine konfigurierte Node-Distribution für diese Plattform/Architektur.')
  const name = `node-v${requirement.fallback}-${platform === 'win32' ? 'win':platform}-${arch}`
  const archive = name + (platform === 'win32' ? '.zip':'.tar.gz')
  const directory = path.join(base,name), executable = path.join(directory,platform === 'win32' ? 'node.exe':'bin/node')
  const unlock = acquireLock(path.join(base,`${name}.lock`))
  try {
    const receipt = path.join(directory,'.verified.json')
    if (!fs.existsSync(executable) || !fs.existsSync(receipt)) {
      const origin = `https://nodejs.org/dist/v${requirement.fallback}/`
      const sums = (await download(origin+'SHASUMS256.txt')).toString('utf8')
      const bytes = await download(origin+archive), sha256 = verifyArchive(bytes,sums,archive)
      const staging = fs.mkdtempSync(path.join(base,'.node-'))
      try {
        const local = path.join(staging,archive); fs.writeFileSync(local,bytes); extract(local,staging)
        const unpacked = path.join(staging,name)
        atomicWrite(path.join(unpacked,'.verified.json'),json({version:requirement.fallback,platform,arch,archive,sha256,origin}))
        fs.rmSync(directory,{recursive:true,force:true}); fs.renameSync(unpacked,directory)
      } finally { fs.rmSync(staging,{recursive:true,force:true}) }
    }
    const proof = JSON.parse(fs.readFileSync(receipt,'utf8'))
    if (proof.version !== requirement.fallback || proof.platform !== platform || proof.arch !== arch) throw new Error('Node-Downloadbeleg passt nicht zur Distribution.')
    const check = spawnSync(executable,['-p','JSON.stringify({version:process.versions.node,platform:process.platform,arch:process.arch})'],{encoding:'utf8'})
    const actual = check.status === 0 ? JSON.parse(check.stdout) : {}
    if (actual.version !== requirement.fallback || actual.platform !== platform || actual.arch !== arch) throw new Error('Lokale Node-Distribution hat falsche Version, Plattform oder Architektur.')
    return { executable, version:actual.version, npm:findNpm(executable), bootstrapped:true }
  } finally { unlock() }
}
