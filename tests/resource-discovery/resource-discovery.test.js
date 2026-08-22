const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('resource discovery is registered under the asset router', () => {
  const router = source('src/router/async/router.map.js')
  assert.match(router, /resourceDiscovery:\s*\{[\s\S]*ResourceDiscovery/)
})

test('page exposes the confirmed five-category read-only contract', () => {
  const page = source('src/pages/host/ResourceDiscovery.vue')
  for (const text of ['五类资源发现', 'Cisco IOS', 'Linux', 'VMware', 'MySQL', 'Nginx', '模板证据', '未采集', '不扫描凭据', '不自动创建主机']) {
    assert.ok(page.includes(text), `missing confirmed copy: ${text}`)
  }
  assert.doesNotMatch(page, /METHOD\.(POST|PUT|DELETE)|\$can\([^)]*,\s*'(create|update|delete|operate)'/)
})

test('service exposes one GET-only discovery overview', () => {
  const services = source('src/services/admin.js')
  assert.match(services, /function resourceDiscoveryOverview\(\)[\s\S]*request\(RESOURCE_DISCOVERY, METHOD\.GET\)/)
  assert.doesNotMatch(services, /request\(RESOURCE_DISCOVERY[^\n]*METHOD\.(POST|PUT|DELETE)/)
})
