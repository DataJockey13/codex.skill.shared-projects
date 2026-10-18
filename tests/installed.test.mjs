import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installSkill } from '../skills/setup-shared-project/scripts/install-skill.mjs'
import { verifyPackage, pack } from '../skills/setup-shared-project/scripts/lib/package.mjs'
import { json } from '../skills/setup-shared-project/scripts/lib/core.mjs'

const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url))), skill=path.join(repo,'skills/setup-shared-project')
test('Skillinstallation prüft Kontext, ist eigenständig/idempotent und erhält eigene Änderungen',t=>{
  fs.mkdirSync(path.join(repo,'.runtime'),{recursive:true})
  const temp=fs.mkdtempSync(path.join(repo,'.runtime','installed-skill-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}))
  const source=path.join(temp,'package'),skillsRoot=path.join(temp,'personal-skills')
  fs.cpSync(skill,source,{recursive:true})
  const incompatible=process.platform==='win32'?'darwin':'win32'
  assert.throws(()=>installSkill({source,skillsRoot,platform:incompatible}),/nativ/)
  assert.throws(()=>installSkill({source,skillsRoot:path.parse(repo).root}),/persönlichen/)
  const result=installSkill({source,skillsRoot});assert.equal(result.verified,true);assert.equal(result.changed,true)
  assert.equal(installSkill({source,skillsRoot}).changed,false)
  verifyPackage(result.target)
  fs.appendFileSync(path.join(source,'scripts/cli.mjs'),'\n// New managed template content\n');pack(source)
  assert.equal(installSkill({source,skillsRoot}).changed,true)
  assert.equal(installSkill({source,skillsRoot}).changed,false)
  fs.rmSync(source,{recursive:true})
  const base=path.join(temp,'Basis ä'),root=path.join(base,'Projekt ü');fs.mkdirSync(root,{recursive:true})
  const spec=path.join(temp,'spec.json');fs.writeFileSync(spec,json({bases:{[process.platform]:base},paths:{project:'Projekt ü'},apps:{}}))
  const cli=path.join(result.target,'scripts/cli.mjs'),plan=path.join(temp,'plan.json')
  const invoke=args=>{const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',cwd:root});assert.equal(r.status,0,r.stderr);return r.stdout}
  invoke(['plan','--root',root,'--spec',spec,'--out',plan]);invoke(['apply','--plan',plan]);assert.match(invoke(['info','--root',root]),/Projekt ü/)
  // The generated project is independent of both the source package and installed skill.
  const projectCli=path.join(root,'.shared-project/tools/cli.mjs'),installedCli=fs.readFileSync(cli,'utf8')
  fs.unlinkSync(cli)
  const r=spawnSync(process.execPath,[projectCli,'info'],{encoding:'utf8',cwd:root});assert.equal(r.status,0,r.stderr)
  fs.writeFileSync(cli,installedCli+'\n// customization\n')
  assert.throws(()=>installSkill({source:skill,skillsRoot}),/Update-Konflikt/)
})
test('Skillpaketprüfung erkennt abweichende Ressourcen und unbekannte Dateien',t=>{
  fs.mkdirSync(path.join(repo,'.runtime'),{recursive:true})
  const temp=fs.mkdtempSync(path.join(repo,'.runtime','package-test-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}))
  fs.cpSync(skill,temp,{recursive:true})
  fs.appendFileSync(path.join(temp,'SKILL.md'),'\nÄnderung\n');assert.throws(()=>verifyPackage(temp),/Prüfsumme/)
  pack(temp);verifyPackage(temp)
  fs.writeFileSync(path.join(temp,'unexpected.txt'),'unknown');assert.throws(()=>verifyPackage(temp),/Dateiliste/)
})
