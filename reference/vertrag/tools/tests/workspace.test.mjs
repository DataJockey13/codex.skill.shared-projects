import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { joinShared, resolveWorkspace, config } from '../paths.mjs'
import { syncSources, runtimeDirectory, acquireLock } from '../frontend.mjs'
import { supportedNode } from '../node-runtime.mjs'

test('zu alte Node-Versionen werden vor Installation und Build erkannt', () => {
  for (const version of ['20.19.0','22.11.0','22.17.9','23.11.0','24.11.9']) assert.equal(supportedNode(version),false)
  for (const version of ['22.18.0','24.12.0','24.22.0','26.8.1']) assert.equal(supportedNode(version),true)
})

test('gleiche logische API-Referenz wird in native Mac- und Windows-Pfade aufgelöst', () => {
  for (const platform of ['darwin','win32']) {
    const base = config.bases[platform]
    const marker = joinShared(base, `${config.paths.project}/workspace.paths.json`, platform)
    const result = resolveWorkspace({ platform, env: {}, root: joinShared(base, config.paths.project, platform),
      exists: file => file === marker, read: () => JSON.stringify(config) })
    assert.equal(result.paths.api, joinShared(base, 'Source/api.curasoft.de', platform))
    assert.equal(result.sharedRoot, platform === 'win32' ? path.win32.resolve(base) : base)
  }
})

test('nicht erreichbare explizite Basis wird nicht still durch eine andere ersetzt', () => {
  assert.throws(() => resolveWorkspace({ env: { SHARED_ROOT: '/missing' }, exists: () => false }), /nicht erreichbar/)
})

test('alternativer Windows-Mount wird anhand der Projektidentität erkannt', () => {
  const base = 'Q:\\MacHome'
  const root = joinShared(base, config.paths.project, 'win32')
  const marker = joinShared(base, `${config.paths.project}/workspace.paths.json`, 'win32')
  const result = resolveWorkspace({ platform: 'win32', env: {}, root,
    exists: file => file === marker, read: () => JSON.stringify(config) })
  assert.equal(result.sharedRoot, base)
})

test('absolute Pfade und Ausbruch aus der gemeinsamen Basis werden abgewiesen', () => {
  for (const value of ['../Source','/Source','C:/Source','Source\\file','a/../../file']) {
    assert.throws(() => joinShared('/base', value))
  }
})

test('native Laufzeiten trennen Plattform, Architektur und Aufgabe', () => {
  const mac = runtimeDirectory('frontend','dev',{platform:'darwin',home:'/cache-test',env:{}})
  const win = runtimeDirectory('frontend','dev',{platform:'win32',home:'C:\\CacheTest',env:{}})
  assert.notEqual(mac,win)
  assert.notEqual(mac,runtimeDirectory('frontend','check',{platform:'darwin',home:'/cache-test',env:{}}))
  assert.notEqual(mac,runtimeDirectory('frontend','dev',{platform:'darwin',arch:'other',home:'/cache-test',env:{}}))
})

test('Quellabgleich übernimmt Änderungen und Löschungen, erhält native Module und entfernt Installationshooks', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vertrag-runtime-test-'))
  const source=path.join(root,'source'), dest=path.join(root,'runtime')
  try {
    fs.mkdirSync(path.join(source,'src'),{recursive:true})
    fs.mkdirSync(path.join(dest,'node_modules'),{recursive:true})
    fs.writeFileSync(path.join(source,'package.json'),JSON.stringify({name:'test',scripts:{preinstall:'bad'},dependencies:{}}))
    fs.writeFileSync(path.join(source,'src','a.ts'),'first')
    fs.writeFileSync(path.join(dest,'node_modules','native'),'keep')
    syncSources(source,dest)
    assert.equal(JSON.parse(fs.readFileSync(path.join(dest,'package.json'))).scripts,undefined)
    fs.writeFileSync(path.join(source,'src','a.ts'),'second')
    syncSources(source,dest)
    assert.equal(fs.readFileSync(path.join(dest,'src','a.ts'),'utf8'),'second')
    fs.unlinkSync(path.join(source,'src','a.ts'))
    syncSources(source,dest)
    assert.equal(fs.existsSync(path.join(dest,'src','a.ts')),false)
    assert.equal(fs.readFileSync(path.join(dest,'node_modules','native'),'utf8'),'keep')
    assert.equal(fs.existsSync(path.join(source,'node_modules')),false)
  } finally { fs.rmSync(root,{recursive:true,force:true}) }
})

test('Laufzeitsperre verhindert gleichzeitige Mutation derselben Installation', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vertrag-lock-test-'))
  try {
    const release=acquireLock(root)
    assert.throws(()=>acquireLock(root),/bereits aktiv/)
    release()
    acquireLock(root)()
  } finally { fs.rmSync(root,{recursive:true,force:true}) }
})
