#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CONFIG, readJSON, json, resolveWorkspace, atomicWrite } from './lib/core.mjs'
import { inspect, makePlan, applyPlan, rollback, migrationPlan } from './lib/setup.mjs'
import { execute } from './lib/runtime.mjs'

function findRoot(start) {
  let dir = path.resolve(start)
  while (!fs.existsSync(path.join(dir,CONFIG))) { const up = path.dirname(dir); if (up === dir) throw new Error('shared-project.json nicht gefunden. --root angeben oder Projekt zuerst einrichten.'); dir = up }
  return dir
}
export async function main(argv = process.argv.slice(2)) {
  const args = [...argv], options = {}
  for (let i=0;i<args.length;i++) {
    if (args[i] === '--') break
    if (['--root','--spec','--out','--plan','--journal','--edits'].includes(args[i])) {
    const flag = args[i].slice(2), value = args[i+1]
    if (!value) throw new Error(`Wert für --${flag} fehlt.`)
    options[flag] = value; args.splice(i,2); i--
    }
  }
  const [action,...rest] = args
  let result
  if (action === 'inspect') result = inspect(options.root || process.cwd())
  else if (action === 'plan') result = makePlan(options.root || process.cwd(),options.spec ? readJSON(options.spec):{})
  else if (action === 'apply') { if (!options.plan) throw new Error('--plan fehlt.'); result = applyPlan(readJSON(options.plan)) }
  else if (action === 'rollback') { if (!options.journal) throw new Error('--journal fehlt.'); result = rollback(options.journal,{allowPending:true}) }
  else if (action === 'migration-plan') { if (!options.edits) throw new Error('--edits fehlt.'); result = migrationPlan(options.root || process.cwd(),readJSON(options.edits)) }
  else if (['info','resolve','run'].includes(action)) {
    const root = findRoot(options.root || process.cwd()), config = readJSON(path.join(root,CONFIG))
    if (action === 'run') result = await execute(root,config,rest[0],rest[1],rest.slice(2).filter((v,i) => !(i===0 && v==='--')))
    else { const workspace = resolveWorkspace({root,settings:config}); if (action === 'resolve') { if (!Object.hasOwn(workspace.paths,rest[0])) throw new Error('Unbekannter logischer Pfad.'); console.log(workspace.paths[rest[0]]); return }; result = workspace }
  } else throw new Error('Befehle: inspect, plan --spec DATEI --out PLAN, apply --plan PLAN, rollback --journal DATEI, migration-plan --edits DATEI, info, resolve NAME, run APP AUFGABE; optional --root PROJEKT.')
  if (options.out) { atomicWrite(path.resolve(options.out),json(result)); console.log(`Gespeichert: ${path.resolve(options.out)}`) }
  else console.log(json(result))
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode=1 })
