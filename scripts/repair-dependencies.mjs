/**
 * Apply only npm's non-breaking security remediations, then produce a truthful audit.
 * This intentionally does not use --force and never claims that all alerts disappeared.
 * Run on a connected developer machine. Never part of normal app startup.
 */
import { npmProcess } from './npm-process.mjs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function npm(args) {
  console.log(`\n> npm ${args.join(' ')}\n`)
  const result = npmProcess(args, {
    cwd: root, encoding: 'utf8', stdio: 'inherit', timeout: 300_000
  })
  if (result.error) console.error(result.error.message)
  return result.status === null ? 1 : result.status
}
if (!existsSync(resolve(root, 'package-lock.json'))) {
  console.error('package-lock.json absent. Lancer npm install avant security:fix.')
  process.exitCode = 1
} else {
  console.log('Correction non destructive uniquement : npm audit fix, sans --force.')
  const fixStatus = npm(['audit', 'fix'])
  const auditStatus = npm(['run', 'audit:check'])
  if (fixStatus || auditStatus) {
    console.error('\nDes vulnérabilités persistent ou un audit est incomplet. Lire audit-reports/dependances-audit.md et ne pas distribuer sans revue.')
    process.exitCode = 1
  } else {
    console.log('\nAudit npm complet terminé sans alerte connue au moment du contrôle.')
  }
}
