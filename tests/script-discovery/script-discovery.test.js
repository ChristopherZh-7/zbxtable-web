const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('script discovery is registered under the asset router', () => {
  assert.match(source('src/router/async/router.map.js'), /scriptDiscovery:\s*\{[\s\S]*ScriptDiscovery/)
})

test('page exposes trusted CMDB candidates as a manual-confirmation read-only view', () => {
  const page = source('src/pages/host/ScriptDiscovery.vue')

  for (const text of [
    '扩展脚本发现',
    '人工确认',
    '候选仅供查看',
    'CMDB 候选字段（只读）',
    '{{ record.item_key }}',
    '{{ record.item_type }}',
    'record.mappable_fields',
    'record.error_message',
  ]) {
    assert.ok(page.includes(text), `missing confirmed copy: ${text}`)
  }

  assert.doesNotMatch(page, /<a-alert|<a-input|<a-textarea|<a-modal/)
  assert.match(page, /await scriptDiscoveryList\(\)/)
  assert.doesNotMatch(page, /type="file"|<a-upload/)
  assert.doesNotMatch(page, /应用映射|applyScriptDiscovery|canApply|@click="apply\(record\)"/)
})

test('frontend service only lists script-discovery candidates', () => {
  const services = source('src/services/admin.js')

  assert.match(services, /function scriptDiscoveryList\(\)[\s\S]*request\(SCRIPT_DISCOVERY, METHOD\.GET\)/)
  assert.doesNotMatch(services, /applyScriptDiscovery/)
  assert.doesNotMatch(services, /request\(SCRIPT_DISCOVERY[^\n]*METHOD\.(POST|PUT|DELETE)/)
})
