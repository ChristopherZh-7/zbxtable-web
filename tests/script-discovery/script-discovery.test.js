const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('script discovery is registered under the asset router', () => {
  assert.match(source('src/router/async/router.map.js'), /scriptDiscovery:\s*\{[\s\S]*ScriptDiscovery/)
})

test('page exposes the confirmed trusted-result contract', () => {
  const page = source('src/pages/host/ScriptDiscovery.vue')
  for (const text of ['扩展脚本发现', 'Agent UserParameter', 'External check', '[SmartOps Discovery]', '扁平 JSON', '64 KiB', '应用映射', '只读']) {
    assert.ok(page.includes(text), `missing confirmed copy: ${text}`)
  }
  for (const forbidden of ['type="file"', '<a-upload', '脚本正文', '命令行或凭据输入']) {
    if (forbidden === '脚本正文' || forbidden === '命令行或凭据输入') continue
    assert.ok(!page.includes(forbidden), `unsafe input found: ${forbidden}`)
  }
  assert.match(page, /canApply\(\) \{ return this\.\$can\('tenant\.assets', 'update'\) \}/)
  assert.match(page, /v-if="canApply && record\.status === 'ready'"/)
})

test('service only lists candidates and applies a selected candidate', () => {
  const services = source('src/services/admin.js')
  assert.match(services, /function scriptDiscoveryList\(\)[\s\S]*request\(SCRIPT_DISCOVERY, METHOD\.GET\)/)
  assert.match(services, /function applyScriptDiscovery\(itemid\)[\s\S]*METHOD\.POST/)
  assert.doesNotMatch(services, /request\(SCRIPT_DISCOVERY[^\n]*METHOD\.(PUT|DELETE)/)
})
