#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { hash, json, readJSON, inside, physical, atomicWrite } from './lib/core.mjs'
import { MANIFEST, verifyPackage } from './lib/package.mjs'
import { acquireLock } from './lib/lock.mjs'

export function installSkill({source = path.dirname(path.dirname(fileURLToPath(import.meta.url))), skillsRoot = path.join(os.homedir(),'.agents','skills'), platform = process.platform} = {}) {
  if (platform !== process.platform) throw new Error('Installer muss nativ im gewählten Zielsystem laufen; ein fremdes Laufwerk genügt nicht.')
  skillsRoot = path.resolve(skillsRoot)
  const contextRoots = [os.homedir(),...(process.env.CODEX_HOME ? [process.env.CODEX_HOME]:[])]
  if (!contextRoots.some(root => inside(physical(root),physical(skillsRoot)))) throw new Error('Skillziel muss zur persönlichen lokalen Umgebung (Home oder aktuellem CODEX_HOME) gehören.')
  if (platform === 'win32' && (skillsRoot.startsWith('\\\\') || !/^[a-z]:\\/i.test(skillsRoot))) throw new Error('Windows-Skillablage muss auf einem lokalen Laufwerk liegen, nicht auf einer UNC-Freigabe.')
  const manifest = verifyPackage(source), target = path.join(skillsRoot,'setup-shared-project')
  if (physical(target) === physical(source)) throw new Error('Quelle und Installationsziel sind identisch.')
  if (inside(physical(source),physical(target)) || inside(physical(target),physical(source))) throw new Error('Skillquelle und Ziel dürfen sich nicht überlappen.')
  fs.mkdirSync(skillsRoot,{recursive:true})
  const unlock = acquireLock(path.join(skillsRoot,'.setup-shared-project.install.lock'))
  const staging = path.join(skillsRoot,`.setup-shared-project-${crypto.randomUUID()}`), backup = `${target}.previous-installation`
  try {
    if (!fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup,target)
    if (fs.existsSync(target)) {
      const receiptFile = path.join(target,'.installation.json')
      if (!fs.existsSync(receiptFile)) throw new Error('Vorhandener Skill ohne Installationsbeleg; nicht überschreiben.')
      const previous = readJSON(receiptFile)
      for (const [rel,digest] of Object.entries(previous.files)) {
        if (!fs.existsSync(path.join(target,rel)) || hash(fs.readFileSync(path.join(target,rel))) !== digest) throw new Error(`Eigene Skilländerung erhalten; Update-Konflikt: ${rel}`)
      }
      const old = verifyPackage(target,{version:previous.version})
      if (json(old) === json(manifest) && previous.platform === platform && previous.architecture === process.arch) return {target,version:manifest.version,changed:false,platform,verified:true}
    }
    fs.cpSync(source,staging,{recursive:true})
    verifyPackage(staging)
    atomicWrite(path.join(staging,'.installation.json'),json({schemaVersion:1,version:manifest.version,platform,architecture:process.arch,files:{...manifest.files,[MANIFEST]:hash(fs.readFileSync(path.join(staging,MANIFEST)))}}))
    fs.rmSync(backup,{recursive:true,force:true})
    if (fs.existsSync(target)) fs.renameSync(target,backup)
    try { fs.renameSync(staging,target); verifyPackage(target) }
    catch (e) { fs.rmSync(target,{recursive:true,force:true});if(fs.existsSync(backup))fs.renameSync(backup,target);throw e }
    fs.rmSync(backup,{recursive:true,force:true})
    return {target,version:manifest.version,changed:true,platform,verified:true}
  } finally { fs.rmSync(staging,{recursive:true,force:true});unlock() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args=process.argv.slice(2), options={}
    for(let i=0;i<args.length;i+=2) {if(!['--skills-root','--platform'].includes(args[i]) || !args[i+1])throw new Error('Optionen: --skills-root PFAD --platform darwin|win32|linux');options[args[i]==='--skills-root'?'skillsRoot':'platform']=args[i+1]}
    console.log(json(installSkill(options)))
  } catch(e){console.error(e.message);process.exitCode=1}
}
