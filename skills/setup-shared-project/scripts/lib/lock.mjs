import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

// All acquisitions, including stale recovery, use the same short-lived gate.
// An interrupted gate is deliberately fail-closed and needs an operator check.
export function acquireLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const gate = `${file}.acquire`
  try { fs.mkdirSync(gate) } catch (e) {
    if (e.code !== 'EEXIST') throw e
    throw new Error(`Sperrübernahme aktiv oder abgebrochen: ${gate}. Besitzer prüfen, dann das leere Gate entfernen.`)
  }
  const token = JSON.stringify({ pid: process.pid, host: os.hostname(), token: crypto.randomUUID(), since: new Date().toISOString() })
  try {
    if (fs.existsSync(file)) {
      let owner
      try { owner = JSON.parse(fs.readFileSync(file,'utf8')) } catch { throw new Error(`Beschädigte Sperre: ${file}. Manuell prüfen.`) }
      if (owner.host !== os.hostname()) throw new Error(`Sperre auf anderem Host (${owner.host}): ${file}. Keine automatische Zeitablauf-Freigabe.`)
      if (!Number.isInteger(owner.pid) || owner.pid <= 0) throw new Error(`Ungültiger Sperrbesitzer: ${file}`)
      let dead = false
      try { process.kill(owner.pid, 0) } catch (e) { if (e.code === 'ESRCH') dead = true; else if (e.code !== 'EPERM') throw e }
      if (!dead) throw new Error(`Bereits aktiv, PID ${owner.pid}: ${file}`)
      fs.unlinkSync(file)
    }
    fs.writeFileSync(file, token, { flag:'wx' })
  } finally { fs.rmdirSync(gate) }
  return () => { if (fs.existsSync(file) && fs.readFileSync(file,'utf8') === token) fs.unlinkSync(file) }
}
