import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { projectRoot, resolveWorkspace, config } from './paths.mjs'
import { reexecIfNeeded } from './node-runtime.mjs'

if (process.platform !== 'win32') throw new Error('Diese Abnahme muss nativ unter Windows laufen.')
if (await reexecIfNeeded(process.argv[1], process.argv.slice(2))) process.exit(process.exitCode ?? 0)
const workspace = resolveWorkspace()
const directory = path.join(projectRoot, '.runtime')
fs.mkdirSync(directory, { recursive: true })
const log = path.join(directory, 'windows-verification.log')
fs.writeFileSync(log, '')
const report = {
  at: new Date().toISOString(), platform: process.platform, architecture: process.arch,
  node: process.versions.node, relativeProject: config.paths.project,
  sharedBasisValidated: true,
  sharedConfigSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(projectRoot, 'workspace.paths.json'))).digest('hex'),
  steps: [], passed: false,
}
for (const [name, args] of [
  ['tools', ['--test', 'tools/tests/workspace.test.mjs']],
  ['frontend-tests', ['tools/frontend.mjs','test','frontend']],
  ['frontend-build', ['tools/frontend.mjs','build','frontend']],
  ['design-tests', ['tools/frontend.mjs','test','design']],
  ['design-build', ['tools/frontend.mjs','build','design']],
]) {
  console.log(`Prüfe ${name} …`)
  const result = spawnSync(process.execPath, args, { cwd: projectRoot,
    env: { ...process.env, SHARED_ROOT: workspace.sharedRoot }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  fs.appendFileSync(log, `\n${name}\n${result.stdout || ''}${result.stderr || ''}${result.error?.message || ''}`)
  report.steps.push({ name, exitCode: result.status, passed: result.status === 0 })
  fs.writeFileSync(path.join(directory, 'verification-windows.json'), JSON.stringify(report, null, 2) + '\n')
  if (result.status !== 0) { console.error(`Fehler bei ${name}; Details in .runtime/windows-verification.log`); process.exit(1) }
}
report.passed = true
report.completedAt = new Date().toISOString()
fs.writeFileSync(path.join(directory, 'verification-windows.json'), JSON.stringify(report, null, 2) + '\n')
console.log('Windows-Abnahme erfolgreich. Ergebnis: .runtime/verification-windows.json')
