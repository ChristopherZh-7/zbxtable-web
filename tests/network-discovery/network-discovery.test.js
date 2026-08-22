const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('network discovery is registered under the asset router', () => {
  const router = source('src/router/async/router.map.js')
  assert.match(router, /networkDiscovery:\s*\{[\s\S]*NetworkDiscovery/)
})

test('page exposes confirmed safe scanning and read-only contract', () => {
  const page = source('src/pages/host/NetworkDiscovery.vue')
  for (const text of ['网络发现', 'RFC1918', '/24–/30', '不是全端口扫描', '发现结果', '开放端口', '不会自动创建主机']) assert.ok(page.includes(text), `missing confirmed copy: ${text}`)
  assert.match(page, /this\.\$can\('platform\.assets', 'create'\)/)
  assert.match(page, /this\.\$can\('platform\.assets', 'delete'\)/)
  assert.match(page, /v-if="canManage"/)
})

test('services cover resources, rules, results, create and delete', () => {
  const services = source('src/services/admin.js')
  for (const fn of ['networkDiscoveryResources', 'networkDiscoveryRules', 'networkDiscoveryResults', 'createNetworkDiscoveryRule', 'deleteNetworkDiscoveryRule']) {
    assert.match(services, new RegExp(`function ${fn}\\b`))
  }
  assert.match(services, /NETWORK_DISCOVERY \+ '\/rules'.*METHOD\.POST/)
  assert.match(services, /NETWORK_DISCOVERY \+ '\/rules\/' \+ id, METHOD\.DELETE/)
})
