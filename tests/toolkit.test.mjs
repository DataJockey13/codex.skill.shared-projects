import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { CONFIG, STATE, VERSION, hash, json, joinShared, resolveWorkspace, validateConfig, readJSON } from '../skills/setup-shared-project/scripts/lib/core.mjs'
import { inspect, makePlan, applyPlan, rollback, migrationPlan } from '../skills/setup-shared-project/scripts/lib/setup.mjs'
import { runtimeDirectory, claimSource, syncSources, devSynchronizer, stagedExport, execute } from '../skills/setup-shared-project/scripts/lib/runtime.mjs'
import { acquireLock } from '../skills/setup-shared-project/scripts/lib/lock.mjs'
import { satisfies, ensureNode, verifyArchive } from '../skills/setup-shared-project/scripts/lib/node.mjs'

function fixture(t, node = false, name = 'Projekt ä mit Leerzeichen') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'shared-project-test-'))
  t.after(() => fs.rmSync(temp,{recursive:true,force:true}))
  const base = path.join(temp,'Gemeinsame Basis'), root = path.join(base,'Source',name)
  fs.mkdirSync(root,{recursive:true})
  const spec = {bases:{[process.platform]:base},paths:{project:`Source/${name}`,api:'Source/API ä'},apps:{}}
  if (node) {
    fs.writeFileSync(path.join(root,'package.json'),json({name:'synthetic',version:'1.0.0',private:true,type:'module',scripts:{
      prepare:'node prepare.mjs',test:'node --test tests/example.test.mjs',build:'node build.mjs',custom:'node -e "console.log(42)"'
    }}))
    fs.writeFileSync(path.join(root,'package-lock.json'),json({name:'synthetic',version:'1.0.0',lockfileVersion:3,requires:true,packages:{'':{name:'synthetic',version:'1.0.0'}}}))
    fs.writeFileSync(path.join(root,'prepare.mjs'),"import fs from 'node:fs';fs.writeFileSync('prepared.txt','hook ran')\n")
    fs.writeFileSync(path.join(root,'build.mjs'),"import fs from 'node:fs';fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html',fs.readFileSync('input.txt'))\n")
    fs.writeFileSync(path.join(root,'input.txt'),'hello ä')
    fs.mkdirSync(path.join(root,'tests'))
    fs.writeFileSync(path.join(root,'tests/example.test.mjs'),"import assert from 'node:assert/strict';import fs from 'node:fs';assert.equal(fs.readFileSync('prepared.txt','utf8'),'hook ran')\n")
    spec.apps.web = {path:'.',profile:'npm',sources:['.'],commands:{test:{script:'test'},build:{script:'build'}},runtime:{range:'>=22.18.0',fallback:'24.22.0'},buildOutput:'dist',exportPath:'Exports/site'}
  }
  return {temp,base,root,spec}
}
const install = f => { applyPlan(makePlan(f.root,f.spec)); return readJSON(path.join(f.root,CONFIG)) }

test('Pfade ohne Node: Vorschau ist rein, Einrichtung idempotent und eigene AGENTS bleiben erhalten',t => {
  const f = fixture(t)
  fs.writeFileSync(path.join(f.root,'AGENTS.md'),'# Eigene Regeln\nEigene Anweisung.\n')
  const plan = makePlan(f.root,f.spec)
  assert.equal(fs.existsSync(path.join(f.root,CONFIG)),false)
  assert.equal(plan.inspection.packages.length,0)
  assert.equal(applyPlan(plan).changed > 0,true)
  const c = readJSON(path.join(f.root,CONFIG))
  assert.match(c.projectId,/^[\w-]{36}$/)
  assert.equal(fs.existsSync(path.join(f.root,'package.json')),false)
  assert.match(fs.readFileSync(path.join(f.root,'AGENTS.md'),'utf8'),/^# Eigene Regeln/)
  assert.equal(applyPlan(makePlan(f.root)).changed,0)
  assert.equal(readJSON(path.join(f.root,CONFIG)).projectId,c.projectId)
  assert.equal(resolveWorkspace({root:f.root}).paths.api,path.join(f.base,'Source/API ä'))
})
test('native Pfadregeln und explizite falsche Overrides werden abgewiesen',t => {
  const f = fixture(t), c = install(f)
  for (const rel of ['../escape','/absolute','C:/bad','C:bad','a\\b','a/../b','a//b']) assert.throws(() => joinShared('/base',rel))
  assert.throws(() => joinShared('Z:\\Mac','a','linux'))
  assert.throws(() => resolveWorkspace({root:f.root,env:{SHARED_ROOT:path.join(f.temp,'falsch')}}),/Explizites/)
  assert.throws(() => resolveWorkspace({root:f.root,env:{SHARED_ROOT:''}}),/Explizites/)
  const win = {...c,bases:{win32:'Z:\\Freigabe'},paths:{project:'Source/App',api:'Source/API ä'}}
  const marker = JSON.stringify(win)
  const result = resolveWorkspace({root:'Y:\\Freigabe\\Source\\App',settings:win,platform:'win32',env:{},exists:p => p.startsWith('Y:'),read:() => marker})
  assert.equal(result.paths.api,'Y:\\Freigabe\\Source\\API ä')
  assert.throws(() => resolveWorkspace({root:'/base/source/app',settings:{...c,bases:{linux:'/base'},paths:{project:'Source/App'}},platform:'linux',env:{},exists:()=>true,read:()=>JSON.stringify(c)}))
  assert.throws(() => resolveWorkspace({root:'/mnt/share/Source/App',settings:{...win,bases:{win32:'Z:\\Freigabe'}},platform:'linux',env:{WSL_DISTRO_NAME:'Ubuntu',SHARED_ROOT:'Z:\\Freigabe'},exists:()=>true,read:()=>marker}),/wsl/)
})
test('symbolische Pfadausbrüche und verwaltete Symlinkziele werden blockiert',t => {
  const f = fixture(t)
  const outside = path.join(f.temp,'outside'); fs.mkdirSync(outside)
  fs.symlinkSync(outside,path.join(f.root,'.shared-project'),'dir')
  assert.throws(() => makePlan(f.root,f.spec),/Symlink/)
  fs.unlinkSync(path.join(f.root,'.shared-project')); install(f)
  fs.mkdirSync(path.join(f.base,'Source/API ä'),{recursive:true})
  fs.rmSync(path.join(f.base,'Source/API ä'),{recursive:true});fs.symlinkSync(outside,path.join(f.base,'Source/API ä'),'dir')
  assert.throws(() => resolveWorkspace({root:f.root}),/Symlink/)
})
test('bestehende Skripte, Lifecycle-Hooks und verschachtelte Git-Anweisungen bleiben erhalten',t => {
  const f = fixture(t,true)
  fs.mkdirSync(path.join(f.root,'nested/.git'),{recursive:true})
  fs.writeFileSync(path.join(f.root,'nested/AGENTS.override.md'),'Eigene Unterregeln\n')
  install(f)
  const manifest = readJSON(path.join(f.root,'package.json'))
  assert.equal(manifest.scripts.prepare,'node prepare.mjs')
  assert.equal(manifest.scripts.custom,'node -e "console.log(42)"')
  assert.match(manifest.scripts['shared:build'],/run web build/)
  const nested = fs.readFileSync(path.join(f.root,'nested/AGENTS.override.md'),'utf8')
  assert.match(nested,/^Eigene Unterregeln/);assert.match(nested,/\.\.\/shared-project.json/)
  assert.equal(applyPlan(makePlan(f.root)).changed,0)
  syncSources(f.root,path.join(f.temp,'runtime'),f.spec.apps.web)
  const local = readJSON(path.join(f.temp,'runtime/package.json'))
  assert.equal(local.scripts.prepare,manifest.scripts.prepare)
  assert.equal(local.scripts['shared:build'],undefined)
})
test('Update erhält Benutzerkonfiguration; angepasste Werkzeuge und Abschnitte ergeben konkrete Konflikte',t => {
  const f = fixture(t), c = install(f)
  c.paths.manual = 'Documents/Eigen';fs.writeFileSync(path.join(f.root,CONFIG),json(c))
  const agents = path.join(f.root,'AGENTS.md');fs.appendFileSync(agents,'\nMeine spätere Regel.\n')
  const update = makePlan(f.root)
  assert.deepEqual(update.changes.map(e=>e.path),[STATE])
  applyPlan(update)
  assert.equal(readJSON(path.join(f.root,CONFIG)).paths.manual,'Documents/Eigen')
  const tool = path.join(f.root,'.shared-project/tools/cli.mjs');fs.appendFileSync(tool,'\n// Eigene Änderung\n')
  const conflict = makePlan(f.root)
  assert.equal(conflict.conflicts.some(v => v.path.endsWith('cli.mjs')),true)
  assert.throws(() => applyPlan(conflict),/Konflikte/)
  fs.writeFileSync(agents,fs.readFileSync(agents,'utf8').replace('Toolkit '+VERSION,'Toolkit eigene Version'))
  assert.equal(makePlan(f.root).conflicts.some(v => v.path === 'AGENTS.md'),true)
})
test('unveränderte verwaltete Teile aktualisieren sich anhand des früheren Zustands',t => {
  const f = fixture(t);install(f)
  const file = '.shared-project/tools/cli.mjs', full = path.join(f.root,file), state = readJSON(path.join(f.root,STATE))
  fs.writeFileSync(full,'// alte Vorlagenversion\n');state.managed.files[file] = hash('// alte Vorlagenversion\n');state.toolkitVersion = '0.9.0'
  fs.writeFileSync(path.join(f.root,STATE),json(state))
  const plan = makePlan(f.root);assert.equal(plan.conflicts.length,0);assert.ok(plan.changes.some(e => e.path===file))
  applyPlan(plan);assert.match(fs.readFileSync(full,'utf8'),/function main/)
})
test('gespeicherter Plan ist vor Änderungen geschützt, Teilfehler und bewusster Rollback stellen Ausgang wieder her',t => {
  const f = fixture(t), plan = makePlan(f.root,f.spec)
  fs.writeFileSync(path.join(f.root,'AGENTS.md'),'Zwischenzeitlich')
  assert.throws(() => applyPlan(plan),/veraltet/)
  fs.unlinkSync(path.join(f.root,'AGENTS.md'))
  assert.throws(() => applyPlan(makePlan(f.root,f.spec),{afterWrite:()=>{throw new Error('simulierter Schreibfehler')}}),/Schreibfehler/)
  assert.equal(fs.existsSync(path.join(f.root,CONFIG)),false)
  const result = applyPlan(makePlan(f.root,f.spec));assert.ok(result.journal)
  fs.appendFileSync(path.join(f.root,'AGENTS.md'),'Nachträglich\n')
  assert.throws(() => rollback(result.journal),/Rollback-Konflikt/)
  const j = readJSON(result.journal), agent = j.entries.find(e => e.path==='AGENTS.md')
  fs.writeFileSync(path.join(f.root,'AGENTS.md'),agent.after)
  rollback(result.journal);assert.equal(fs.existsSync(path.join(f.root,CONFIG)),false)
})
test('gleichnamige Apps haben isolierte Projekte, Aufgaben und Laufzeiten; kopierte Kennungen kollidieren sichtbar',t => {
  const a = fixture(t,true,'A'), b = fixture(t,true,'B'), ca=install(a), cb=install(b)
  const dirs = [runtimeDirectory(ca,'web','dev'),runtimeDirectory(cb,'web','dev'),runtimeDirectory(ca,'web','test'),
    runtimeDirectory(ca,'web','dev',{platform:'win32'}),runtimeDirectory(ca,'web','dev',{arch:'andere'}),runtimeDirectory(ca,'web','dev',{nodeVersion:'24.22.0'})]
  assert.equal(new Set(dirs).size,dirs.length)
  assert.equal(runtimeDirectory(ca,'web','build'),runtimeDirectory(ca,'web','preview'))
  const runtime = path.join(a.temp,'runtime');fs.mkdirSync(runtime);claimSource(runtime,a.root)
  assert.throws(() => claimSource(runtime,b.root),/kollidiert/)
  const alias = path.join(a.temp,'alias');fs.symlinkSync(a.root,alias,'dir');claimSource(runtime,alias)
})
test('Quellabgleich übernimmt Änderungen und Löschungen; lokale Module und eigene Quellen bleiben erhalten',t => {
  const f = fixture(t,true), dest = path.join(f.temp,'runtime'), app=f.spec.apps.web
  fs.mkdirSync(path.join(dest,'node_modules/native'),{recursive:true});fs.writeFileSync(path.join(dest,'node_modules/native/addon.node'),'native')
  fs.writeFileSync(path.join(f.root,'to-delete.txt'),'alt');syncSources(f.root,dest,app)
  fs.unlinkSync(path.join(f.root,'to-delete.txt'));fs.writeFileSync(path.join(f.root,'input.txt'),'neu');syncSources(f.root,dest,app)
  assert.equal(fs.existsSync(path.join(dest,'to-delete.txt')),false)
  assert.equal(fs.readFileSync(path.join(dest,'input.txt'),'utf8'),'neu')
  assert.equal(fs.readFileSync(path.join(dest,'node_modules/native/addon.node'),'utf8'),'native')
  assert.equal(fs.readFileSync(path.join(f.root,'input.txt'),'utf8'),'neu')
  fs.writeFileSync(path.join(dest,'.shared-source-files.json'),json(['../danger']))
  assert.throws(() => syncSources(f.root,dest,app),/relativer/)
})
test('Quellabgleich unterstützt Wechsel zwischen Datei und Verzeichnis ohne unverwaltete Dateien zu löschen',t=>{
  const f=fixture(t,true),dest=path.join(f.temp,'runtime'),app=f.spec.apps.web, entry=path.join(f.root,'switch')
  fs.writeFileSync(entry,'file');syncSources(f.root,dest,app)
  fs.unlinkSync(entry);fs.mkdirSync(entry);fs.writeFileSync(path.join(entry,'child'),'directory');syncSources(f.root,dest,app)
  assert.equal(fs.readFileSync(path.join(dest,'switch/child'),'utf8'),'directory')
  fs.rmSync(entry,{recursive:true});fs.writeFileSync(entry,'file again');syncSources(f.root,dest,app)
  assert.equal(fs.readFileSync(path.join(dest,'switch'),'utf8'),'file again')
  fs.writeFileSync(path.join(dest,'.shared-source-files.json'),json(['.shared-owner.json']))
  assert.throws(()=>syncSources(f.root,dest,app),/reservierter/)
})
test('Dev synchronisiert und verlangt Neustart bei Paket-, Lock- oder Konfigurationsänderung',t => {
  const f = fixture(t,true);install(f)
  const dest = path.join(f.temp,'dev'), warnings = [], tick = devSynchronizer(f.root,dest,f.spec.apps.web,f.root,v=>warnings.push(v))
  assert.equal(tick(),true);fs.writeFileSync(path.join(f.root,'input.txt'),'changed');assert.equal(tick(),true)
  assert.equal(fs.readFileSync(path.join(dest,'input.txt'),'utf8'),'changed')
  fs.appendFileSync(path.join(f.root,'package-lock.json'),'\n');assert.equal(tick(),false);assert.equal(tick(),false);assert.equal(warnings.length,1)
})
test('Sperren koordinieren gleiche Laufzeit, räumen tote lokale PIDs und respektieren fremde Hosts',t => {
  const f=fixture(t), lock=path.join(f.temp,'runner.lock'), release=acquireLock(lock)
  assert.throws(()=>acquireLock(lock),/Bereits aktiv/);release()
  const child=spawnSync(process.execPath,['-e',''],{encoding:'utf8'})
  fs.writeFileSync(lock,json({pid:child.pid,host:os.hostname()}));acquireLock(lock)()
  fs.writeFileSync(lock,json({pid:123,host:'anderer-host'}));assert.throws(()=>acquireLock(lock),/anderem Host/)
  fs.unlinkSync(lock);fs.mkdirSync(lock+'.acquire');assert.throws(()=>acquireLock(lock),/abgebrochen/)
})
test('gestufter Export erhält brauchbaren Build bei Kopier-/Austauschfehlern und nach Abbruch',t => {
  const f=fixture(t), from=path.join(f.temp,'local'), target=path.join(f.base,'Export')
  fs.mkdirSync(from);fs.mkdirSync(target);fs.writeFileSync(path.join(from,'index.html'),'new');fs.writeFileSync(path.join(target,'index.html'),'old')
  for (const phase of ['beforeSwap','afterBackup']) {
    assert.throws(()=>stagedExport(from,target,{[phase]:()=>{throw new Error('Fehler')}}),/Fehler/)
    assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),'old')
  }
  fs.renameSync(target,target+'.shared-previous');stagedExport(from,target)
  assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),'new')
  const release=acquireLock(target+'.shared-export.lock');assert.throws(()=>stagedExport(from,target),/Bereits aktiv/);release()
})
test('Node-Bereich, Distribution und Prüfsumme werden vor Bootstrap geprüft',async t => {
  assert.equal(satisfies('22.11.0','^22.18.0 || >=24.12.0'),false)
  assert.equal(satisfies('24.22.0','^22.18.0 || >=24.12.0'),true)
  assert.throws(()=>satisfies('24.22.0','latest'),/Nicht unterstützt/)
  const f=fixture(t), requirement={range:'>=24.12.0',fallback:'24.22.0'}
  assert.equal((await ensureNode(requirement,path.join(f.temp,'tools'))).bootstrapped,false)
  await assert.rejects(ensureNode({...requirement,fallback:'20.1.0'},path.join(f.temp,'tools')),/erfüllt/)
  await assert.rejects(ensureNode(requirement,path.join(f.temp,'tools'),{version:'20.1.0',download:async()=>{throw new Error('TLS fehlgeschlagen')}}),/TLS/)
  await assert.rejects(ensureNode(requirement,path.join(f.temp,'tools'),{version:'20.1.0',download:async()=>Buffer.from('bad')}),/SHA-256/)
  assert.equal(verifyArchive(Buffer.from('ok'),`${hash('ok')}  node.tar.gz`,'node.tar.gz'),hash('ok'))
})
test('Migration verändert nur explizite Konfigurationswerte oder echte Linkziele',t => {
  const f=fixture(t)
  fs.writeFileSync(path.join(f.root,'settings.json'),json({path:'/old',quote:'historisch /old'}))
  fs.writeFileSync(path.join(f.root,'doc.md'),'[Config](old.json)\nHistorisch old.json\n')
  const plan=migrationPlan(f.root,[{kind:'config',path:'settings.json',pointer:'/path',from:'/old',to:'Source/API'},
    {kind:'markdown-link',path:'doc.md',from:'old.json',to:'settings.json'}])
  applyPlan(plan)
  assert.equal(readJSON(path.join(f.root,'settings.json')).quote,'historisch /old')
  assert.match(fs.readFileSync(path.join(f.root,'doc.md'),'utf8'),/Historisch old.json/)
  assert.throws(()=>migrationPlan(f.root,[{kind:'text',path:'doc.md'}]),/Rohquellen/)
})
test('Migration bündelt mehrere JSON-Stellen und aktualisiert explizit deren Prüfsumme',t=>{
  const f=fixture(t),original=json({first:'/old',second:'/old'})
  fs.writeFileSync(path.join(f.root,'settings.json'),original)
  fs.writeFileSync(path.join(f.root,'manifest.json'),json({sha:hash(original)}))
  const plan=migrationPlan(f.root,[{kind:'config',path:'settings.json',pointer:'/first',from:'/old',to:'Source/First'},
    {kind:'config',path:'settings.json',pointer:'/second',from:'/old',to:'Source/Second'},
    {kind:'checksum',path:'manifest.json',pointer:'/sha',from:hash(original),of:'settings.json'}])
  assert.equal(plan.entries.length,2);applyPlan(plan)
  assert.equal(readJSON(path.join(f.root,'manifest.json')).sha,hash(fs.readFileSync(path.join(f.root,'settings.json'))))
})
test('generisches npm-Profil führt Lifecycle, Test, Build und Export lokal aus',async t => {
  const f=fixture(t,true), other=fixture(t,true,'Zweites Projekt'), c=install(f), otherConfig=install(other),previous=process.env.SHARED_PROJECT_CACHE
  fs.writeFileSync(path.join(other.root,'input.txt'),'anderes Projekt')
  const testContext=process.env.NODE_TEST_CONTEXT;delete process.env.NODE_TEST_CONTEXT
  process.env.SHARED_PROJECT_CACHE=path.join(f.temp,'cache')
  t.after(()=>{if(previous===undefined) delete process.env.SHARED_PROJECT_CACHE;else process.env.SHARED_PROJECT_CACHE=previous;if(testContext!==undefined)process.env.NODE_TEST_CONTEXT=testContext})
  const tested=await execute(f.root,c,'web','test');assert.ok(tested.runtime.startsWith(process.env.SHARED_PROJECT_CACHE))
  const [built,otherBuilt]=await Promise.all([execute(f.root,c,'web','build'),execute(other.root,otherConfig,'web','build')])
  assert.notEqual(built.runtime,otherBuilt.runtime)
  assert.equal(fs.readFileSync(path.join(built.runtime,'dist/index.html'),'utf8'),'hello ä')
  assert.equal(fs.readFileSync(path.join(otherBuilt.runtime,'dist/index.html'),'utf8'),'anderes Projekt')
  await execute(f.root,c,'web','export');assert.equal(fs.readFileSync(path.join(f.base,'Exports/site/index.html'),'utf8'),'hello ä')
  assert.equal(fs.existsSync(path.join(f.root,'prepared.txt')),false)
  assert.equal(fs.existsSync(path.join(f.root,'node_modules')),false)
})
