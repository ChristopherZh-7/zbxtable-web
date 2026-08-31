#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

const cli = require.resolve('@vue/cli-service/bin/vue-cli-service.js')
const nodeOptions = [process.env.NODE_OPTIONS, '--openssl-legacy-provider']
  .filter(Boolean)
  .join(' ')

const result = spawnSync(process.execPath, [cli, 'build'], {
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  stdio: 'inherit'
})

if (result.error) {
  throw result.error
}

process.exitCode = result.status === null ? 1 : result.status
