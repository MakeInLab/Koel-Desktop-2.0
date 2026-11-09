/**
 * Windows-only packaging with the installed Electron binary and the official
 * NSIS compiler. Does not depend on electron-builder or npm packaging plugins.
 *
 * 1. Build the app with electron-vite (run before invoking this script).
 * 2. Stage Electron + the compiled app + production-only dependencies.
 * 3. Compile Setup and single-file Portable executables with makensis.
 *
 * Unsigned outputs: use a trusted signing certificate and signtool separately.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import * as ResEdit from 'resedit'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const out = join(root, 'release')
const runtime = join(out, 'Koel-Desktop-win32-x64')
const exeName = 'Koel Desktop.exe'
const appDir = join(runtime, 'resources', 'app')
const icon = join(root, 'resources', 'icon.ico')
const flags = new Set(process.argv.slice(2))
const buildSetup = !flags.has('--dir-only') && !flags.has('--portable-only')
const buildPortable = !flags.has('--dir-only') && !flags.has('--setup-only')

function ensure(condition, message) { if (!condition) throw new Error(message) }
function run(command, args, opts = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...opts })
  if (result.error) throw result.error
  ensure(result.status === 0, `Commande échouée (${result.status}): ${command} ${args.join(' ')}`)
}
function findNsis() {
  const candidates = [
    process.env.NSIS_PATH,
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'NSIS', 'makensis.exe'),
    join(process.env.ProgramFiles || 'C:\\Program Files', 'NSIS', 'makensis.exe')
  ].filter(Boolean)
  const installed = candidates.find(p => existsSync(p))
  if (installed) return installed
  if (spawnSync('makensis.exe', ['/VERSION'], { shell: false, stdio: 'ignore' }).status === 0) return 'makensis.exe'
  throw new Error('NSIS introuvable. Installer NSIS (https://nsis.sourceforge.io), puis relancer npm run dist:win. Définir NSIS_PATH si nécessaire.')
}
function nsisEscape(value) { return value.replaceAll('$', '$$') }
function nsisPath(value) { return nsisEscape(value.replaceAll('/', '\\')) }
function listEntries(folder) {
  const files = [], dirs = []
  function visit(path) {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, item.name)
      if (item.isSymbolicLink()) throw new Error(`Lien symbolique interdit dans le package : ${full}`)
      if (item.isDirectory()) { dirs.push(relative(folder, full)); visit(full) }
      else if (item.isFile()) files.push(relative(folder, full))
    }
  }
  visit(folder)
  return { files, dirs }
}

ensure(process.platform === 'win32', 'Packaging Windows uniquement. Lancer cette commande depuis PowerShell sous Windows.')
ensure(existsSync(join(root, 'out', 'main', 'index.js')), 'Fichiers compilés absents : lancer npm run build avant le packaging.')
ensure(existsSync(join(root, 'out', 'renderer', 'index.html')), 'Interface compilée absente : lancer npm run build avant le packaging.')
ensure(/^\d+\.\d+\.\d+$/.test(pkg.version), 'Numéro de version invalide.')
const electronBase = join(root, 'node_modules', 'electron')
const electronDist = join(electronBase, 'dist')
ensure(existsSync(join(electronDist, 'electron.exe')), 'Electron non installé : exécuter npx electron --version avant npm run dist:win.')
ensure(existsSync(icon), 'Icône Windows introuvable : resources/icon.ico')

mkdirSync(out, { recursive: true })
rmSync(runtime, { recursive: true, force: true })
// Electron for Windows is already downloaded by npm install / npx electron.
cpSync(electronDist, runtime, { recursive: true, dereference: false })
renameSync(join(runtime, 'electron.exe'), join(runtime, exeName))
// Embedding the .ico into the Windows PE resource is essential: NSIS `Icon`
// only affects the installer, not the application executable or its shortcuts.
// Perform this BEFORE signing. Never silently ship the generic Electron icon.
const appExe = join(runtime, exeName)
try {
  const exe = ResEdit.NtExecutable.from(readFileSync(appExe))
  const resources = ResEdit.NtExecutableResource.from(exe)
  const existing = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries)
  if (!existing.length) throw new Error('Aucun groupe d’icônes dans electron.exe')
  const ico = ResEdit.Data.IconFile.from(readFileSync(icon))
  if (!ico.icons.length) throw new Error('Fichier icon.ico vide')
  for (const group of existing) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries, group.id, group.lang, ico.icons.map(item => item.data)
    )
  }
  const versions = ResEdit.Resource.VersionInfo.fromEntries(resources.entries)
  const numericVersion = [...pkg.version.split('.').map(Number), 0]
  for (const version of versions) {
    version.setFileVersion(...numericVersion, 1033)
    version.setProductVersion(...numericVersion, 1033)
    version.setStringValues({ lang: 1033, codepage: 1200 }, {
      ProductName: 'Koel Desktop',
      FileDescription: 'Koel Desktop 2.0',
      CompanyName: 'Koel Desktop',
      FileVersion: pkg.version,
      ProductVersion: pkg.version
    })
    version.outputToResourceEntries(resources.entries)
  }
  resources.outputResource(exe)
  writeFileSync(appExe, Buffer.from(exe.generate()))
  // Reparse to ensure the generated executable still contains the new icon.
  const checkExe = ResEdit.NtExecutable.from(readFileSync(appExe))
  const checkRes = ResEdit.NtExecutableResource.from(checkExe)
  ensure(ResEdit.Resource.IconGroupEntry.fromEntries(checkRes.entries).length > 0, 'Ressource d’icône absente après modification')
  console.log('Logo Koel intégré dans Koel Desktop.exe (Setup et Portable).')
} catch (error) {
  throw new Error(`Impossible d’intégrer le logo Windows : ${error instanceof Error ? error.message : String(error)}`)
}
mkdirSync(appDir, { recursive: true })
cpSync(join(root, 'out'), join(appDir, 'out'), { recursive: true })
// Electron exposes this directory as process.resourcesPath at runtime.
// Keep the resource files at its root (NOT resources/resources/).
const runtimeResourceDir = join(runtime, 'resources')
for (const asset of ['icon.ico', 'icon.png', 'tray.ico', 'tray.png']) {
  const from = join(root, 'resources', asset)
  ensure(existsSync(from), `Fichier d'icône requis introuvable : ${from}`)
  cpSync(from, join(runtimeResourceDir, asset))
  ensure(existsSync(join(runtimeResourceDir, asset)), `Icône non copiée : ${asset}`)
}
const appPkg = {
  name: pkg.name,
  productName: 'Koel Desktop',
  version: pkg.version,
  main: pkg.main,
  private: true,
  dependencies: pkg.dependencies
}
writeFileSync(join(appDir, 'package.json'), JSON.stringify(appPkg, null, 2) + '\n')
// Explicit publish exclusion rules keep npm from falling back to .gitignore.
writeFileSync(join(appDir, '.npmignore'), 'out\nnode_modules\n')
// Install only runtime packages; npm scripts are not needed to run Koel Desktop.
// Avoid npm install's lifecycle hooks in the shipping application tree.
const npmCli = process.env.npm_execpath
ensure(npmCli && existsSync(npmCli), 'Exécuter le packaging via npm run dist:win (npm_execpath manquant).')
run(process.execPath, [npmCli, 'install', '--prefix', appDir, '--omit=dev', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'], { cwd: appDir })
ensure(existsSync(join(appDir, 'node_modules', 'discord-rpc')), 'Dépendances de production absentes du package.')
console.log(`Runtime Windows prêt : ${runtime}`)
if (!buildSetup && !buildPortable) process.exit(0)

const makensis = findNsis()
ensure(existsSync(icon), 'Icône manquante : resources/icon.ico')
const scriptsDir = join(out, 'nsis-build')
mkdirSync(scriptsDir, { recursive: true })
const dirs = listEntries(runtime)
const source = nsisPath(runtime)
const iconSource = nsisPath(icon)
const version = pkg.version
// Generate explicit uninstall operations, never recursively erase an unknown directory.
const deleteFiles = dirs.files.map(p => `  Delete "$INSTDIR\\${nsisPath(p)}"`).join('\n')
const removeFolders = dirs.dirs.sort((a, b) => b.length - a.length).map(p => `  RMDir "$INSTDIR\\${nsisPath(p)}"`).join('\n')
const define = (name, value) => `!define ${name} "${nsisEscape(value)}"`
const header = [
  define('APP_VERSION', version),
  define('APP_SOURCE', source),
  define('APP_ICON', iconSource),
  'Unicode true',
  'RequestExecutionLevel user',
  'SetCompressor /SOLID lzma',
  'Name "Koel Desktop"',
  'Icon "${APP_ICON}"',
  'UninstallIcon "${APP_ICON}"',
  'VIProductVersion "' + version + '.0"',
  'VIAddVersionKey "ProductName" "Koel Desktop"',
  'VIAddVersionKey "ProductVersion" "' + version + '"',
  'VIAddVersionKey "FileVersion" "' + version + '"',
  'VIAddVersionKey "LegalCopyright" "Copyright (c) Koel Desktop contributors"',
  'VIAddVersionKey "FileDescription" "Koel Desktop for Windows"',
  'VIAddVersionKey "CompanyName" "Koel Desktop"'
].join('\n')

if (buildSetup) {
  const setup = `!include "MUI2.nsh"
${header}
OutFile "${nsisPath(join(out, `Koel-Desktop-${version}-Setup-x64.exe`))}"
InstallDir "$LOCALAPPDATA\\Programs\\Koel Desktop"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"
Section "Koel Desktop" SecApp
  SetOutPath "$INSTDIR"
  File /r "${'${APP_SOURCE}'}\\*.*"
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\\Koel Desktop"
  CreateShortCut "$SMPROGRAMS\\Koel Desktop\\Koel Desktop.lnk" "$INSTDIR\\${exeName}"
  CreateShortCut "$DESKTOP\\Koel Desktop.lnk" "$INSTDIR\\${exeName}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\KoelDesktop" "DisplayName" "Koel Desktop"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\KoelDesktop" "DisplayVersion" "${version}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\KoelDesktop" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\KoelDesktop" "DisplayIcon" "$INSTDIR\\${exeName}"
SectionEnd
Section "Uninstall"
  Delete "$DESKTOP\\Koel Desktop.lnk"
  Delete "$SMPROGRAMS\\Koel Desktop\\Koel Desktop.lnk"
  RMDir "$SMPROGRAMS\\Koel Desktop"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\KoelDesktop"
${deleteFiles}
${removeFolders}
  Delete "$INSTDIR\\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
`
  const path = join(scriptsDir, 'setup.nsi')
  writeFileSync(path, setup)
  run(makensis, ['/V2', path])
}
if (buildPortable) {
  const portable = `${header}
OutFile "${nsisPath(join(out, `Koel-Desktop-${version}-Portable-x64.exe`))}"
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow
Section "Portable"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /r "${'${APP_SOURCE}'}\\*.*"
  ExecWait '"$PLUGINSDIR\\${exeName}"' $0
  SetErrorLevel $0
SectionEnd
`
  const path = join(scriptsDir, 'portable.nsi')
  writeFileSync(path, portable)
  run(makensis, ['/V2', path])
}
console.log('Packaging terminé. Outputs dans release/. Signature numérique à appliquer séparément.')
