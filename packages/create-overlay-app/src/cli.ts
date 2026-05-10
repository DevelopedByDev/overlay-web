#!/usr/bin/env node
// @enterprise-future — not wired to production
// create-overlay-app CLI entrypoint

import { Command } from 'commander'
import chalk from 'chalk'
import { runSetup, type SetupOptions } from './lib/setup.js'

const program = new Command()

program
  .name('create-overlay-app')
  .description('Scaffold an Overlay instance with interactive setup')
  .version('0.0.1')
  .argument('<directory>', 'target directory for the new instance')
  .option('-p, --profile <profile>', 'deployment profile: saas | on-prem | hybrid', 'hybrid')
  .option('-t, --tag <tag>', 'git tag or branch to checkout', 'main')
  .option('--non-interactive', 'skip prompts and use profile defaults', false)
  .option('--docker-only', 'only generate docker-compose files, skip clone', false)
  .option('--skip-install', 'skip npm install after clone', false)
  .option('--skip-start', 'skip starting the dev server', false)
  .action(async (directory: string, options: SetupOptions) => {
    const start = Date.now()
    console.log(chalk.bold('\n  create-overlay-app v0.0.1\n'))

    try {
      const result = await runSetup(directory, options)
      if (result.success) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)
        console.log(chalk.green(`\nDone in ${elapsed}s.\n`))
        console.log(chalk.bold('Next steps:'))
        console.log(`  cd ${result.directory}`)
        if (!result.started) {
          console.log('  docker compose -f docker/docker-compose.enterprise.yml up -d')
          console.log('  npm run dev')
        }
        console.log(`  Open http://localhost:3000\n`)
      } else {
        console.error(chalk.red(`\nSetup failed: ${result.error}\n`))
        process.exit(1)
      }
    } catch (err) {
      console.error(chalk.red(`\nUnexpected error: ${err instanceof Error ? err.message : String(err)}\n`))
      process.exit(1)
    }
  })

program.parse()
