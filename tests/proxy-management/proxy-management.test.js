const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  filterGroupRows,
  filterProxyRows,
  flattenGroups,
  flattenProxies,
  formatDeviation,
  readBusinessSnapshot,
} = require('../../src/pages/system/proxy-management/model')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')
const snapshot = {
  generated_at: '2026-08-22T00:00:00Z',
  summary: {instance_count: 2, proxy_count: 2},
  instances: [
    {zid: 1, instance: 'prod', name: 'Production', warnings: [], groups: [{proxy_groupid: '9', name: 'Edge', state_name: 'online'}], proxies: [{proxyid: '11', name: 'edge-a', proxy_groupid: '9', proxy_group_name: 'Edge', state_name: 'online'}]},
    {zid: 2, instance: 'backup', name: 'Backup', warnings: [], groups: [], proxies: [{proxyid: '12', name: 'standalone', proxy_groupid: '0', state_name: 'offline'}]},
  ],
}

test('proxy snapshot unwraps the API envelope and preserves empty defaults', () => {
  const normalized = readBusinessSnapshot({data: {code: 200, data: snapshot}})
  assert.equal(normalized.instances.length, 2)
  assert.equal(normalized.summary.instance_count, 2)
  assert.equal(normalized.summary.offline_proxy_count, 0)
  assert.throws(() => readBusinessSnapshot({data: {code: 403, message: '无权执行该操作'}}), /无权/)
})

test('proxy and group filters combine instance state group and keyword', () => {
  const proxies = flattenProxies(snapshot)
  const groups = flattenGroups(snapshot)
  assert.equal(filterProxyRows(proxies, {zid: 1, proxy_group_key: '1:9', state: 'online', keyword: 'edge'}).length, 1)
  assert.equal(filterProxyRows(proxies, {proxy_group_key: '2:9'}).length, 0)
  assert.equal(filterProxyRows(proxies, {state: 'offline'}).length, 1)
  assert.equal(filterGroupRows(groups, {zid: 1, keyword: 'prod'}).length, 1)
  assert.equal(filterGroupRows(groups, {state: 'offline'}).length, 0)
})

test('load deviation is explicit host-count deviation', () => {
  assert.equal(formatDeviation(2), '+2.0')
  assert.equal(formatDeviation(-1.25), '-1.3')
  assert.equal(formatDeviation(0), '0')
})

test('proxy page is read-only, retains data on refresh errors, and polls every 15 seconds', () => {
  const page = source('src/pages/system/proxy-management/index.vue')
  const service = source('src/services/zabbix.js')
  const routeMap = source('src/router/async/router.map.js')
  assert.match(routeMap, /proxyManagement[\s\S]*pages\/system\/proxy-management/)
  assert.match(page, /REFRESH_INTERVAL_MS = 15000/)
  assert.match(page, /this\.snapshot = next/)
  assert.doesNotMatch(page, /catch[\s\S]{0,180}this\.snapshot\s*=/)
  assert.match(service, /\/v1\/zabbix\/proxy-management.*METHOD\.GET/)
  assert.doesNotMatch(service, /proxy-management[^\n]*METHOD\.(POST|PUT|DELETE)/)
  assert.doesNotMatch(page, /删除代理|启停代理|新建代理/)
})
