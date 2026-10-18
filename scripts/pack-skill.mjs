import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pack, verifyPackage } from '../skills/setup-shared-project/scripts/lib/package.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../skills/setup-shared-project')
if (process.argv.includes('--check')) console.log(`Skillpaket geprüft: ${Object.keys(verifyPackage(root).files).length} Dateien.`)
else console.log(`Skillpaket gepackt: ${Object.keys(pack(root).files).length} Dateien.`)
