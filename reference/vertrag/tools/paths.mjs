import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
export const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'workspace.paths.json'), 'utf8'))

export function joinShared(base, relative, platform = process.platform) {
  const p = platform === 'win32' ? path.win32 : path.posix
  if (typeof relative !== 'string' || relative.includes('\\') ||
      p.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.split('/').includes('..')) {
    throw new Error('Erwartet wird ein relativer Pfad mit / ohne .. oder Laufwerksangabe.')
  }
  return p.resolve(base, ...relative.split('/').filter(Boolean))
}

export function resolveWorkspace({ platform = process.platform, env = process.env,
  root = projectRoot, settings = config, exists = fs.existsSync,
  read = file => fs.readFileSync(file, 'utf8') } = {}) {
  const p = platform === 'win32' ? path.win32 : path.posix
  const candidates = []
  if (env.SHARED_ROOT) candidates.push(env.SHARED_ROOT)
  else {
    if (settings.bases[platform]) candidates.push(settings.bases[platform])
    // Opening through another mount (for example the alternative drive) is valid
    // when the shared Documents/Vertrag layout and workspace identity match.
    let inferred = root
    for (const ignored of settings.paths.project.split('/')) inferred = p.dirname(inferred)
    if (p.normalize(joinShared(inferred, settings.paths.project, platform)).toLowerCase() ===
        p.normalize(root).toLowerCase()) candidates.push(inferred)
  }
  for (const base of [...new Set(candidates)]) {
    if (!p.isAbsolute(base)) continue
    const marker = joinShared(base, `${settings.paths.project}/workspace.paths.json`, platform)
    try {
      if (!exists(marker) || JSON.parse(read(marker)).workspaceId !== settings.workspaceId) continue
      const paths = Object.fromEntries(Object.entries(settings.paths)
        .map(([name, relative]) => [name, joinShared(base, relative, platform)]))
      return { platform, architecture: process.arch, sharedRoot: p.resolve(base), paths }
    } catch { /* try the next validated mount */ }
  }
  throw new Error('Gemeinsame Pfadbasis nicht erreichbar. Freigabe und workspace.paths.json prüfen oder SHARED_ROOT auf die gemeinsame Basis setzen.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const workspace = resolveWorkspace()
    if (process.argv[2] === 'resolve') {
      const value = process.argv[3] ?? ''
      console.log(workspace.paths[value] ?? joinShared(workspace.sharedRoot, value))
    } else console.log(JSON.stringify(workspace, null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
