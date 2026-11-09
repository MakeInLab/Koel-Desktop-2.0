/**
 * Reproducible npm security audit. Requires package-lock.json and npm registry.
 * Outputs a local JSON and Markdown report without modifying dependencies.
 * Exits non-zero on vulnerabilities or an incomplete audit (no false green).
 */
import { npmProcess } from './npm-process.mjs'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'audit-reports')
const strict = process.argv.includes('--strict')
const packageFile = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

function npm(args) {
  return npmProcess(args, {
    cwd: root, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024,
    timeout: 120_000, env: { ...process.env, npm_config_fund: 'false' }
  })
}
function parseOutput(result) {
  try { return JSON.parse(result.stdout) } catch { return null }
}
function localNow() { return new Date().toISOString() }
function summarize(result) {
  if (!result || !result.metadata || !result.vulnerabilities) return null
  const totals = result.metadata.vulnerabilities ?? {}
  const issues = Object.entries(result.vulnerabilities)
    .map(([name, info]) => ({
      name, severity: info.severity, isDirect: !!info.isDirect,
      range: info.range, fixAvailable: info.fixAvailable,
      via: Array.isArray(info.via) ? info.via.map(item => typeof item === 'string' ? item : {
        title: item.title, url: item.url, range: item.range, severity: item.severity
      }) : [],
      effects: info.effects ?? []
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { totals, issues }
}
function escapeCell(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') }

const report = {
  generatedAt: localNow(),
  packageName: packageFile.name, version: packageFile.version,
  manifest: { dependencies: packageFile.dependencies ?? {}, devDependencies: packageFile.devDependencies ?? {} },
  lockfilePresent: existsSync(join(root, 'package-lock.json')),
  installedModulesPresent: existsSync(join(root, 'node_modules')),
  audit: null, productionAudit: null, installedTree: null,
  errors: []
}
let full = null, production = null
if (!report.lockfilePresent) report.errors.push('package-lock.json absent : exécuter npm install sur une machine connectée')
if (!report.installedModulesPresent) report.errors.push('node_modules absent : exécuter npm ci ou npm install')

if (report.lockfilePresent) {
  const allResult = npm(['audit', '--json'])
  full = parseOutput(allResult)
  report.audit = summarize(full)
  if (!report.audit) report.errors.push('Audit complet impossible : ' + (allResult.error?.message ?? allResult.stderr?.trim() ?? 'réponse npm illisible').slice(0, 350))
  const prodResult = npm(['audit', '--omit=dev', '--json'])
  production = parseOutput(prodResult)
  report.productionAudit = summarize(production)
  if (!report.productionAudit) report.errors.push('Audit production impossible : ' + (prodResult.error?.message ?? prodResult.stderr?.trim() ?? 'réponse npm illisible').slice(0, 350))
}
if (report.installedModulesPresent) {
  const treeResult = npm(['ls', '--all', '--json'])
  const tree = parseOutput(treeResult)
  if (tree) report.installedTree = tree
  else report.errors.push('Inventaire npm ls --all impossible : ' + (treeResult.error?.message ?? treeResult.stderr?.trim() ?? 'réponse npm illisible').slice(0, 350))
}

mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'dependances-audit.json'), JSON.stringify(report, null, 2) + '\n')
const lines = [
  `# Audit npm - ${report.packageName} v${report.version}`,
  '', `Date (UTC) : ${report.generatedAt}`,
  '', '> Les résultats proviennent de npm audit sur cette installation. Une analyse statique seule ne remplace pas cette vérification.',
  '', '## Dépendances directes', '', '| Paquet | Type | Version demandée |', '|---|---|---|',
  ...Object.entries(report.manifest.dependencies).map(([name, version]) => `| ${escapeCell(name)} | Production | ${escapeCell(version)} |`),
  ...Object.entries(report.manifest.devDependencies).map(([name, version]) => `| ${escapeCell(name)} | Développement | ${escapeCell(version)} |`),
  '', '## Vulnérabilités', ''
]
for (const [label, section] of [['Toutes les dépendances', report.audit], ['Production uniquement', report.productionAudit]]) {
  lines.push(`### ${label}`)
  if (!section) { lines.push('Non vérifié : audit indisponible.', ''); continue }
  lines.push('```json', JSON.stringify(section.totals, null, 2), '```', '')
  if (section.issues.length) {
    lines.push('| Paquet | Sévérité | Directe | Correctif proposé |', '|---|---|---|---|')
    for (const item of section.issues) lines.push(`| ${escapeCell(item.name)} | ${escapeCell(item.severity)} | ${item.isDirect ? 'oui' : 'non'} | ${item.fixAvailable ? 'voir JSON / npm audit' : 'non'} |`)
  } else lines.push('Aucune vulnérabilité signalée par npm pour cet inventaire.')
  lines.push('')
}
if (report.errors.length) lines.push('## Contrôles incomplets', '', ...report.errors.map(s => `- ${s}`), '')
lines.push('## Suites', '', '- Traiter séparément les dépendances de production et de développement.', '- Préférer les mises à jour compatibles, puis exécuter les tests et le build.', '- Ne pas utiliser `npm audit fix --force` sans revue des changements.', '')
writeFileSync(join(output, 'dependances-audit.md'), lines.join('\n'))
console.log(`Rapports : ${join(output, 'dependances-audit.md')} et dependances-audit.json`)
const vulnerable = (s) => s && s.issues.length > 0
if (report.errors.length || vulnerable(report.productionAudit) || (strict && vulnerable(report.audit))) {
  console.error('Audit incomplet ou vulnérabilités détectées. Consulter les rapports.')
  process.exitCode = 1
} else {
  console.log(report.audit && vulnerable(report.audit) ? 'Alertes côté développement détectées : examiner le rapport.' : 'Aucune alerte détectée dans les audits disponibles.')
}
