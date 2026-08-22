const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('configuration consumption is registered under the asset router', () => {
  const router = source('src/router/async/router.map.js')
  assert.match(router, /configConsumption:\s*\{[\s\S]*ConfigConsumption/)
})

test('page exposes confirmed scenario and task lifecycle without discovery scope', () => {
  const page = source('src/pages/host/ConfigConsumption.vue')
  for (const text of ['配置消费', '业务系统 + 资产类型唯一', '60 秒内完成', '仅替换上一次由本功能管理', '重新排队']) assert.ok(page.includes(text), `missing confirmed copy: ${text}`)
  assert.match(page, /this\.\$can\('tenant\.assets', 'create'\)/)
  assert.match(page, /this\.\$can\('tenant\.assets', 'update'\)/)
  assert.match(page, /this\.\$can\('tenant\.assets', 'delete'\)/)
  assert.doesNotMatch(page, /自动发现|创建主机|discovery rule/i)
})

test('services cover scenario CRUD, apply, task status, and retry', () => {
  const services = source('src/services/admin.js')
  for (const fn of [
    'configurationResources', 'configurationScenarioList', 'createConfigurationScenario',
    'updateConfigurationScenario', 'deleteConfigurationScenario', 'configurationTaskList',
    'applyConfigurationScenario', 'retryConfigurationTask',
  ]) assert.match(services, new RegExp(`function ${fn}\\b`))
  assert.match(services, /\/hosts\/.*METHOD\.PUT/)
  assert.match(services, /\/retry'.*METHOD\.POST/)
})
