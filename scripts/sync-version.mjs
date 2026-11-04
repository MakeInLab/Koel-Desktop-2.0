/** Sync Electron's package metadata with the version shown in the UI. */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(resolve(root, 'src/shared/version.ts'), 'utf8')
const found = source.match(/export const APP_VERSION = '([^']+)'/)
if (!found || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(found[1])) {
  throw new Error('Invalid APP_VERSION in src/shared/version.ts')
}
const path = resolve(root, 'package.json')
const pkg = JSON.parse(readFileSync(path, 'utf8'))
if (pkg.version !== found[1]) {
  pkg.version = found[1]
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`Koel Desktop: package.json updated to ${found[1]}`)
}
