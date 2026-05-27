import { spawnSync } from 'node:child_process'

const commands = [
  ['npm', ['run', 'check:config']],
  ['npm', ['run', 'docs:check:self-hosting']],
  ['npm', ['run', 'license:check']],
  ['npm', ['run', 'check:shared-isomorphic']],
  ['npm', ['run', 'check:module-boundaries']],
  ['npm', ['run', 'check:providers']],
  ['npm', ['run', 'test:phase6-routes']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'build']],
] as const

for (const [command, args] of commands) {
  const label = [command, ...args].join(' ')
  console.log(`\n[phase6] ${label}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    console.error(`[phase6] ${label} failed: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`[phase6] ${label} exited with ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\n[phase6] release gate passed')
