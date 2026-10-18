#!/usr/bin/env node
// Runs only synthetic projects. An optional real Vite run uses npm's registry.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { VERSION, CONFIG, hash, json, readJSON, atomicWrite, environment } from './lib/core.mjs'
import { makePlan, applyPlan, rollback } from './lib/setup.mjs'
import { execute, runtimeDirectory, stagedExport } from './lib/runtime.mjs'
import { acquireLock } from './lib/lock.mjs'
import { findNpm, ensureNode, run } from './lib/node.mjs'
import { MANIFEST, verifyPackage } from './lib/package.mjs'

const scripts = path.dirname(fileURLToPath(import.meta.url)), cli=path.join(scripts,'cli.mjs')
async function freePort() {
  return new Promise((resolve,reject) => {const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
}
async function eventually(fn, message) {
  const until=Date.now()+30000;let last
  while(Date.now()<until) {try {const result=await fn();if(result)return result}catch(e){last=e};await new Promise(r=>setTimeout(r,150))}
  throw new Error(`${message}: ${last?.message || 'Zeitlimit'}`)
}
async function server(root, task, port, env, body) {
  // Direct Vite node argv avoids leaving npm/shell grandchildren on cancellation.
  const child=spawn(process.execPath,[cli,'--root',root,'run','web',task,'--port',String(port),'--strictPort','--host','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']})
  let output='';child.stdout.on('data',b=>{output+=b});child.stderr.on('data',b=>{output+=b})
  const closed=new Promise(r=>child.once('close',r))
  try { await eventually(async()=>{if(child.exitCode!==null)throw new Error(output);const r=await fetch(`http://127.0.0.1:${port}`);return r.ok},`${task} startet nicht`);await body(output) }
  finally {
    if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'})
    else child.kill('SIGTERM')
    await closed
  }
}
export async function verifyNative({out, vite=false, bootstrap=false, keep=false} = {}) {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'shared-project-native-'))
  const previousCache=process.env.SHARED_PROJECT_CACHE, testContext=process.env.NODE_TEST_CONTEXT
  process.env.SHARED_PROJECT_CACHE=path.join(temp,'local-cache');delete process.env.NODE_TEST_CONTEXT
  const evidence={schemaVersion:1,toolkitVersion:VERSION,at:new Date().toISOString(),environment:environment(),platform:process.platform,architecture:process.arch,node:process.versions.node,
    nativeWindows:process.platform==='win32',checks:[],passed:false,limits:[]}
  try {
    const packageRoot=path.dirname(scripts)
    evidence.packageSha256=hash(fs.readFileSync(path.join(packageRoot,MANIFEST)));verifyPackage(packageRoot)
    const base=path.join(temp,'Gemeinsame Basis ä'), root=path.join(base,'Source','App ä')
    fs.mkdirSync(root,{recursive:true})
    const spec={bases:{[environment()]:base},paths:{project:'Source/App ä'},apps:{}}
    const p=makePlan(root,spec);assert.equal(fs.existsSync(path.join(root,CONFIG)),false)
    applyPlan(p);assert.equal(applyPlan(makePlan(root)).changed,0)
    evidence.checks.push('paths-only-preview-apply-idempotent')
    const root2=path.join(base,'Source','Andere App');fs.mkdirSync(root2,{recursive:true})
    applyPlan(makePlan(root2,{bases:{[environment()]:base},paths:{project:'Source/Andere App'},apps:{}}))
    const c1=readJSON(path.join(root,CONFIG)),c2=readJSON(path.join(root2,CONFIG))
    assert.notEqual(c1.projectId,c2.projectId);assert.notEqual(runtimeDirectory(c1,'web','test'),runtimeDirectory(c2,'web','test'))
    const manifest={name:'shared-native-fixture',version:'1.0.0',private:true,type:'module',scripts:{prepare:'node prepare.mjs',test:'node --test fixture.test.mjs',build:'node build.mjs'}}
    fs.writeFileSync(path.join(root,'prepare.mjs'),"import fs from 'node:fs';fs.writeFileSync('prepared.txt','ok')")
    fs.writeFileSync(path.join(root,'fixture.test.mjs'),"import fs from 'node:fs';import assert from 'node:assert/strict';assert.equal(fs.readFileSync('prepared.txt','utf8'),'ok')")
    fs.writeFileSync(path.join(root,'build.mjs'),"import fs from 'node:fs';fs.mkdirSync('dist',{recursive:true});fs.copyFileSync('index.html','dist/index.html')")
    fs.writeFileSync(path.join(root,'index.html'),'<!doctype html><html><head><title>Shared native ä</title></head><body>Native fixture ä</body></html>')
    const app={path:'.',profile:vite?'npm-vite':'npm',sources:['.'],commands:{test:{script:'test'},build:{script:'build'}},runtime:{range:'^22.18.0 || >=24.12.0',fallback:'24.22.0'},buildOutput:'dist',exportPath:'Exports/App ä',restart:['vite.config.mjs']}
    if(vite) {
      manifest.devDependencies={vite:'8.3.4'}
      manifest.scripts.build='vite build'
      // App-specific args go to Vite directly; other tasks use preserved npm scripts.
      app.commands.dev={node:['node_modules/vite/bin/vite.js']};app.commands.preview={node:['node_modules/vite/bin/vite.js','preview']}
      fs.mkdirSync(path.join(root,'public'));fs.writeFileSync(path.join(root,'public/probe.txt'),'before')
    }
    fs.writeFileSync(path.join(root,'package.json'),json(manifest))
    if(vite) await run(process.execPath,[findNpm(),'install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund','--cache',path.join(temp,'lock-cache')],{cwd:root})
    else fs.writeFileSync(path.join(root,'package-lock.json'),json({name:manifest.name,version:manifest.version,lockfileVersion:3,requires:true,packages:{'':{name:manifest.name,version:manifest.version}}}))
    applyPlan(makePlan(root,{apps:{web:app}}));const c=readJSON(path.join(root,CONFIG))
    const [tested,built]=await Promise.all([execute(root,c,'web','test'),execute(root,c,'web','build')])
    assert.notEqual(tested.runtime,built.runtime);assert.equal(fs.existsSync(path.join(root,'node_modules')),false);assert.equal(fs.existsSync(path.join(root,'prepared.txt')),false)
    assert.match(fs.readFileSync(path.join(built.runtime,'dist/index.html'),'utf8'),/Native fixture ä/)
    evidence.checks.push('isolated-identities','local-npm-lifecycle-test-build','parallel-test-build','source-unchanged')
    const release=acquireLock(path.join(built.runtime,'.shared-runner.lock'))
    try {await assert.rejects(execute(root,c,'web','build'),/Bereits aktiv/)}finally{release()}
    evidence.checks.push('same-runtime-lock')
    await execute(root,c,'web','export');const target=path.join(base,'Exports/App ä')
    assert.match(fs.readFileSync(path.join(target,'index.html'),'utf8'),/Native fixture ä/)
    assert.throws(()=>stagedExport(path.join(built.runtime,'dist'),target,{afterBackup:()=>{throw new Error('injected failure')}}),/injected/)
    assert.match(fs.readFileSync(path.join(target,'index.html'),'utf8'),/Native fixture ä/)
    evidence.checks.push('staged-export-and-failure-rollback')
    if(vite) {
      evidence.vite=manifest.devDependencies.vite
      const env={...process.env},port=await freePort()
      await server(root,'dev',port,env,async()=>{
        const fetchProbe=async()=>{const r=await fetch(`http://127.0.0.1:${port}/probe.txt`);return r.ok?await r.text():null}
        assert.equal(await fetchProbe(),'before')
        fs.writeFileSync(path.join(root,'public/probe.txt'),'after ä');await eventually(async()=>await fetchProbe()==='after ä','Dev-Änderung fehlt')
        fs.unlinkSync(path.join(root,'public/probe.txt'))
        const local=runtimeDirectory(c,'web','dev');await eventually(()=>!fs.existsSync(path.join(local,'public/probe.txt')),'Dev-Löschung fehlt')
        assert.notEqual(await fetchProbe(),'after ä')
        await execute(root,c,'web','test')
      })
      evidence.checks.push('vite-dev-http-change-delete','dev-and-test-parallel')
      await server(root,'preview',await freePort(),env,async()=>{})
      evidence.checks.push('vite-preview-http')
    } else evidence.limits.push('Vite/HTTP nicht ausgeführt; --vite ergänzt diesen Test.')
    const before=fs.readFileSync(path.join(root,CONFIG),'utf8'),plan=makePlan(root,{paths:{manual:'Documents/Example'}}),applied=applyPlan(plan)
    rollback(applied.journal);assert.equal(fs.readFileSync(path.join(root,CONFIG),'utf8'),before)
    evidence.checks.push('update-and-rollback')
    if(bootstrap) {
      const node=await ensureNode(app.runtime,path.join(temp,'downloaded-node'),{version:'0.0.0'})
      assert.equal(node.bootstrapped,true);assert.equal((await run(node.executable,['-p','process.versions.node'],{quiet:true})).trim(),app.runtime.fallback)
      evidence.bootstrap={version:node.version,officialDownload:true,sha256Verified:true,platform:process.platform,arch:process.arch}
      evidence.checks.push('real-official-node-bootstrap')
    }else evidence.limits.push('Realer Node-Download nicht ausgeführt; --bootstrap ergänzt diesen Test.')
    evidence.passed=true
  } catch(e){evidence.error=e.stack || e.message;throw e}
  finally {
    if(out)atomicWrite(path.resolve(out),json(evidence))
    if(previousCache===undefined)delete process.env.SHARED_PROJECT_CACHE;else process.env.SHARED_PROJECT_CACHE=previousCache
    if(testContext!==undefined)process.env.NODE_TEST_CONTEXT=testContext
    if(!keep)fs.rmSync(temp,{recursive:true,force:true});else evidence.fixture=temp
  }
  return evidence
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const args=process.argv.slice(2),outIndex=args.indexOf('--out')
  verifyNative({out:outIndex<0?undefined:args[outIndex+1],vite:args.includes('--vite'),bootstrap:args.includes('--bootstrap'),keep:args.includes('--keep')})
    .then(result=>console.log(json(result))).catch(e=>{console.error(e.stack);process.exitCode=1})
}
