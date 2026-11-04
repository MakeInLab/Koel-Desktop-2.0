/**
 * Execute npm without shell:true, including when invoked by npm on Windows.
 * All arguments are supplied as argv, never interpolated into a shell command.
 * The npm_execpath environment variable is set by `npm run`.
 */
import { spawnSync } from 'node:child_process'

export function npmProcess(args, options = {}) {
  const npmEntry = process.env.npm_execpath
  if (npmEntry && /(?:npm-cli|npm)\.m?js$/i.test(npmEntry)) {
    return spawnSync(process.execPath, [npmEntry, ...args], {
      shell: false, ...options
    })
  }
  if (process.platform === 'win32') {
    // npm.cmd requires cmd.exe on Windows. Launch cmd.exe directly (no shell:true)
    // with fixed, program-controlled arguments. Never pass untrusted arguments here.
    if (args.some(a => !/^[\w.=@:/-]+$/.test(a))) {
      throw new Error('Unsupported npm CLI argument')
    }
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
      shell: false, ...options
    })
  }
  return spawnSync('npm', args, { shell: false, ...options })
}
