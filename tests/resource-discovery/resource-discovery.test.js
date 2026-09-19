const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('resource discovery is registered under the asset router', () => {
  const router = source('src/router/async/router.map.js')
  assert.match(router, /resourceDiscovery:\s*\{[\s\S]*ResourceDiscovery/)
})

test('page renders server-provided categories and evidence without write controls or explanatory banners', () => {
  const page = source('src/pages/host/ResourceDiscovery.vue')
  for (const text of ['五类资源发现', '模板证据', '未采集', 'profile.category', 'profile.product', 'profile.template_signatures', 'record.template_name', 'record.evidence']) {
    assert.ok(page.includes(text), `missing resource data presentation: ${text}`)
  }
  for (const category of ['network', 'server', 'virtualization', 'database', 'middleware']) assert.ok(page.includes(`${category}:`))
  assert.match(page, /this\.overview = result\.data \|\| \{profiles: \[\], resources: \[\]/)
  assert.doesNotMatch(page, /<a-alert|<a-upload|<a-input|<a-modal/)
  assert.doesNotMatch(page, /METHOD\.(POST|PUT|DELETE)|\$can\([^)]*,\s*'(create|update|delete|operate)'/)
})

test('service exposes one GET-only discovery overview', () => {
  const services = source('src/services/admin.js')
  assert.match(services, /function resourceDiscoveryOverview\(\)[\s\S]*request\(RESOURCE_DISCOVERY, METHOD\.GET\)/)
  assert.doesNotMatch(services, /request\(RESOURCE_DISCOVERY[^\n]*METHOD\.(POST|PUT|DELETE)/)
})
