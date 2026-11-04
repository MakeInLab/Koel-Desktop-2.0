/**
 * Debian/Linux x64 packaging, without electron-builder.
 * Run on Linux after `npm run build` and `npm install`.
 * Outputs a Debian .deb and a tar.gz portable app directory.
 * Does NOT disable Chromium's sandbox.
 */
import { cpSync, chmodSync, existsSync, mkdirSync, readFileSync, rmSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const release = join(root, 'release')
const appName = 'koel-desktop'
const appExecutable = 'koel-desktop'
const target = join(release, 'Koel-Desktop-linux-x64')
const icon = join(root, 'resources', 'icon.png')
const flags = new Set(process.argv.slice(2))
const buildDeb = !flags.has('--portable-only')
const buildPortable = !flags.has('--deb-only')

function assert(ok, message) { if (!ok) throw new Error(message) }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options })
  if (result.error) throw result.error
  assert(result.status === 0, `Échec (${result.status}) : ${command} ${args.join(' ')}`)
}
function safeVersion(version) { return /^\d+\.\d+\.\d+$/.test(version) }
function iconIsPng256() {
  const png = readFileSync(icon)
  return png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && png.readUInt32BE(16) === 256 && png.readUInt32BE(20) === 256
}

assert(process.platform === 'linux' && process.arch === 'x64', 'Packaging Debian x64 uniquement. Utiliser Debian ou Ubuntu x64.')
assert(safeVersion(pkg.version), 'Numéro de version invalide')
assert(existsSync(join(root, 'out', 'main', 'index.js')), 'Compilation manquante : npm run build')
assert(existsSync(join(root, 'out', 'renderer', 'index.html')), 'Interface manquante : npm run build')
assert(existsSync(icon) && iconIsPng256(), 'Logo 256 x 256 absent : resources/icon.png')
const electronDir = join(root, 'node_modules', 'electron', 'dist')
assert(existsSync(join(electronDir, 'electron')), 'Binaire Electron Linux absent : npm install puis npx electron --version (sur Linux)')
assert(existsSync(join(electronDir, 'chrome-sandbox')), 'Binaire chrome-sandbox absent dans Electron Linux')
const npmCli = process.env.npm_execpath
assert(npmCli && existsSync(npmCli), 'Lancer via npm run dist:linux (npm_execpath manquant)')

mkdirSync(release, { recursive: true })
rmSync(target, { recursive: true, force: true })
cpSync(electronDir, target, { recursive: true, dereference: false })
renameSync(join(target, 'electron'), join(target, appExecutable))
chmodSync(join(target, appExecutable), 0o755)
// For .deb, dpkg installs this file as root with the SUID sandbox bit intact.
// For the portable archive, a user extraction does not grant root ownership:
// a distribution supporting user namespace sandbox is therefore needed.
chmodSync(join(target, 'chrome-sandbox'), 0o4755)
const appDir = join(target, 'resources', 'app')
mkdirSync(appDir, { recursive: true })
cpSync(join(root, 'out'), join(appDir, 'out'), { recursive: true })
for (const asset of ['icon.png', 'tray.png']) {
  const source = join(root, 'resources', asset)
  if (existsSync(source)) cpSync(source, join(target, 'resources', asset))
}
const runtimePkg = {
  name: pkg.name, productName: 'Koel Desktop', version: pkg.version,
  main: pkg.main, private: true, dependencies: pkg.dependencies
}
writeFileSync(join(appDir, 'package.json'), JSON.stringify(runtimePkg, null, 2) + '\n')
writeFileSync(join(appDir, '.npmignore'), 'out\nnode_modules\n')
run(process.execPath, [npmCli, 'install', '--prefix', appDir, '--omit=dev', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'], { cwd: appDir })
assert(existsSync(join(appDir, 'node_modules', 'discord-rpc')), 'discord-rpc absent des dépendances installées')
console.log(`Runtime Linux prêt : ${target}`)

if (buildDeb) {
  const controlDir = join(release, 'deb-build')
  rmSync(controlDir, { recursive: true, force: true })
  const installDir = join(controlDir, 'opt', appName)
  mkdirSync(dirname(installDir), { recursive: true })
  cpSync(target, installDir, { recursive: true, dereference: false })
  chmodSync(join(installDir, 'chrome-sandbox'), 0o4755)
  const launcherDir = join(controlDir, 'usr', 'bin')
  mkdirSync(launcherDir, { recursive: true })
  const launcher = join(launcherDir, appName)
  writeFileSync(launcher, `#!/bin/sh\nexec /opt/${appName}/${appExecutable} "$@"\n`)
  chmodSync(launcher, 0o755)
  const desktopDir = join(controlDir, 'usr', 'share', 'applications')
  mkdirSync(desktopDir, { recursive: true })
  writeFileSync(join(desktopDir, `${appName}.desktop`), `[Desktop Entry]\nName=Koel Desktop\nComment=Client musical pour Koel\nExec=/usr/bin/${appName} %U\nIcon=${appName}\nType=Application\nTerminal=false\nCategories=AudioVideo;Audio;Player;\nStartupNotify=true\n`)
  const iconDir = join(controlDir, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps')
  mkdirSync(iconDir, { recursive: true })
  cpSync(icon, join(iconDir, `${appName}.png`))
  const metaDir = join(controlDir, 'DEBIAN')
  mkdirSync(metaDir, { recursive: true })
  const control = [
    `Package: ${appName}`,
    `Version: ${pkg.version}`,
    'Section: sound',
    'Priority: optional',
    'Architecture: amd64',
    'Maintainer: Koel Desktop contributors',
    'Depends: libc6, libnss3, libnspr4, libgtk-3-0 | libgtk-3-0t64, libgbm1, libasound2 | libasound2t64, libxss1, libatk-bridge2.0-0',
    'Description: Koel Desktop 2.0 - lecteur Koel pour Debian',
    ' Client Electron compatible Koel 9.15+, playlists et Discord Rich Presence.',
    ''
  ].join('\n')
  writeFileSync(join(metaDir, 'control'), control)
  const debPath = join(release, `Koel-Desktop-${pkg.version}-linux-amd64.deb`)
  // --root-owner-group is important for the root-owned setuid sandbox in a .deb.
  run('dpkg-deb', ['--root-owner-group', '--build', controlDir, debPath])
  console.log(`Paquet Debian prêt : ${debPath}`)
}

if (buildPortable) {
  // A portable archive remains unprivileged: its sandbox depends on user namespaces.
  const archive = join(release, `Koel-Desktop-${pkg.version}-linux-x64-portable.tar.gz`)
  const temp = join(release, '.linux-portable-build')
  rmSync(temp, { recursive: true, force: true })
  mkdirSync(temp, { recursive: true })
  const dest = join(temp, appName)
  cpSync(target, dest, { recursive: true, dereference: false })
  // Do not ship a misleading setuid bit in a user-owned portable archive.
  chmodSync(join(dest, 'chrome-sandbox'), 0o755)
  const start = join(dest, 'start-koel-desktop.sh')
  writeFileSync(start, `#!/bin/sh\ncd "$(dirname "$0")" || exit 1\nexec ./koel-desktop "$@"\n`)
  chmodSync(start, 0o755)
  run('tar', ['-czf', archive, '-C', temp, appName])
  rmSync(temp, { recursive: true, force: true })
  console.log(`Archive portable Linux prête : ${archive}`)
}
console.log('Packaging Debian terminé. Installer et lancer sur une machine Debian x64 pour valider.')
