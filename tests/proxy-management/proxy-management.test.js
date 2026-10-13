const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const root = path.resolve(process.env.TARGET_ROOT || path.join(__dirname, '../..'))

const {
  filterGroupRows,
  filterProxyRows,
  flattenGroups,
  flattenProxies,
  formatDeviation,
  proxyPricingBasis,
  readBusinessSnapshot,
} = require(path.join(root, 'src/pages/system/proxy-management/model'))

const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const snapshot = {
  generated_at: '2026-08-22T00:00:00Z',
  summary: {instance_count: 2, proxy_count: 2},
  instances: [
    {zid: 1, instance: 'prod', name: 'Production', supported: true, available: true, warnings: [], groups: [{proxy_groupid: '9', name: 'Edge', state_name: 'online'}], proxies: [{proxyid: '11', name: 'edge-a', proxy_groupid: '9', proxy_group_name: 'Edge', state_name: 'online'}]},
    {zid: 2, instance: 'backup', name: 'Backup', supported: true, available: true, warnings: [], groups: [], proxies: [{proxyid: '12', name: 'standalone', proxy_groupid: '0', state_name: 'offline'}]},
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

test('pricing basis counts unique (zid, proxyid) rows and ignores table filters', () => {
  const basis = proxyPricingBasis(snapshot)
  assert.deepEqual(basis, {count: 2, complete: true, display: '2', reasons: []})
  assert.equal(filterProxyRows(flattenProxies(snapshot), {zid: 1}).length, 1)
  assert.equal(proxyPricingBasis(snapshot).count, 2)
})

test('pricing basis refuses unavailable, duplicate, or inconsistent snapshots', () => {
  const unavailable = structuredClone(snapshot)
  unavailable.instances[1].available = false
  unavailable.instances[1].error = 'unreachable'
  assert.equal(proxyPricingBasis(unavailable).complete, false)
  assert.equal(proxyPricingBasis(unavailable).display, '--')

  const duplicate = structuredClone(snapshot)
  duplicate.instances[0].proxies.push({...duplicate.instances[0].proxies[0]})
  duplicate.summary.proxy_count = 3
  assert.match(proxyPricingBasis(duplicate).reasons.join(','), /duplicate_proxy/)

  const mismatch = structuredClone(snapshot)
  mismatch.summary.proxy_count = 9
  assert.match(proxyPricingBasis(mismatch).reasons.join(','), /proxy_count_mismatch/)
})

test('proxy page is read-only, retains data on refresh errors, and polls every 15 seconds', () => {
  const page = source('src/pages/system/proxy-management/index.vue')
  const service = source('src/services/zabbix.js')
  const routeMap = source('src/router/async/router.map.js')
  assert.match(routeMap, /proxyManagement[\s\S]*pages\/system\/proxy-management/)
  assert.match(page, /REFRESH_INTERVAL_MS = 15000/)
  assert.match(page, /billableProxies/)
  assert.match(page, /pricingBasis\.complete/)
  assert.match(page, /this\.snapshot = next/)
  assert.doesNotMatch(page, /catch[\s\S]{0,180}this\.snapshot\s*=/)
  assert.match(service, /\/v1\/zabbix\/proxy-management.*METHOD\.GET/)
  assert.doesNotMatch(service, /proxy-management[^\n]*METHOD\.(POST|PUT|DELETE)/)
  assert.doesNotMatch(page, /删除代理|启停代理|新建代理/)
})


// Production reload/computed/helper logic, not live HTTP or browser acceptance.
const pricingVm = require('node:vm')
const pricingModel = require(path.join(root, 'src/pages/system/proxy-management/model'))
const pricingInlineInputs = {
  "schema": "issue061-proxy-pricing-fixed-inputs-v1",
  "failed_response": {
    "data": {
      "code": 403,
      "message": "无权执行该操作"
    }
  },
  "known_two_snapshot": {
    "generated_at": "2026-10-09T21:31:24Z",
    "summary": {
      "instance_count": 1,
      "available_instance_count": 1,
      "group_count": 1,
      "proxy_count": 2,
      "online_proxy_count": 0,
      "offline_proxy_count": 0
    },
    "instances": [
      {
        "zid": 1,
        "instance": "f03-local",
        "name": "F03 Local Zabbix",
        "version": "7.0.29",
        "supported": true,
        "available": true,
        "warnings": [],
        "groups": [
          {
            "proxy_groupid": "5",
            "name": "f10n-b60af8ea1593-Billing Group",
            "state": 1,
            "state_name": "offline",
            "failover_delay": "1m",
            "minimum_online": "1",
            "online_proxies": 0,
            "proxy_count": 2,
            "assigned_hosts": 0,
            "average_assigned_hosts": 0
          }
        ],
        "proxies": [
          {
            "proxyid": "8",
            "name": "f10n-b60af8ea1593-proxy-a",
            "proxy_groupid": "5",
            "proxy_group_name": "f10n-b60af8ea1593-Billing Group",
            "operating_mode": 0,
            "operating_mode_name": "active",
            "state": 0,
            "state_name": "unknown",
            "last_access": 0,
            "version": 0,
            "version_name": "unknown",
            "compatibility": 0,
            "compatibility_name": "undefined",
            "assigned_host_count": 0,
            "monitored_host_count": 0,
            "group_average_assigned": 0,
            "load_deviation": 0
          },
          {
            "proxyid": "9",
            "name": "f10n-b60af8ea1593-proxy-b",
            "proxy_groupid": "5",
            "proxy_group_name": "f10n-b60af8ea1593-Billing Group",
            "operating_mode": 0,
            "operating_mode_name": "active",
            "state": 0,
            "state_name": "unknown",
            "last_access": 0,
            "version": 0,
            "version_name": "unknown",
            "compatibility": 0,
            "compatibility_name": "undefined",
            "assigned_host_count": 0,
            "monitored_host_count": 0,
            "group_average_assigned": 0,
            "load_deviation": 0
          }
        ]
      }
    ]
  },
  "successful_zero_snapshot": {
    "generated_at": "2026-10-09T21:31:24Z",
    "summary": {
      "instance_count": 1,
      "available_instance_count": 1,
      "group_count": 0,
      "proxy_count": 0,
      "online_proxy_count": 0,
      "offline_proxy_count": 0
    },
    "instances": [
      {
        "zid": 1,
        "instance": "f03-local",
        "name": "F03 Local Zabbix",
        "version": "7.0.29",
        "supported": true,
        "available": true,
        "warnings": [],
        "groups": [],
        "proxies": []
      }
    ]
  },
  "partial_instance_snapshot": {
    "generated_at": "2026-10-09T21:31:24Z",
    "summary": {
      "instance_count": 2,
      "available_instance_count": 1,
      "group_count": 1,
      "proxy_count": 1,
      "online_proxy_count": 0,
      "offline_proxy_count": 0
    },
    "instances": [
      {
        "zid": 1,
        "instance": "f03-local",
        "name": "F03 Local Zabbix",
        "version": "7.0.29",
        "supported": true,
        "available": true,
        "warnings": [],
        "groups": [
          {
            "proxy_groupid": "5",
            "name": "f10n-b60af8ea1593-Billing Group",
            "state": 1,
            "state_name": "offline",
            "failover_delay": "1m",
            "minimum_online": "1",
            "online_proxies": 0,
            "proxy_count": 2,
            "assigned_hosts": 0,
            "average_assigned_hosts": 0
          }
        ],
        "proxies": [
          {
            "proxyid": "8",
            "name": "f10n-b60af8ea1593-proxy-a",
            "proxy_groupid": "5",
            "proxy_group_name": "f10n-b60af8ea1593-Billing Group",
            "operating_mode": 0,
            "operating_mode_name": "active",
            "state": 0,
            "state_name": "unknown",
            "last_access": 0,
            "version": 0,
            "version_name": "unknown",
            "compatibility": 0,
            "compatibility_name": "undefined",
            "assigned_host_count": 0,
            "monitored_host_count": 0,
            "group_average_assigned": 0,
            "load_deviation": 0
          }
        ]
      },
      {
        "zid": 2,
        "instance": "fixture-unavailable",
        "name": "Unavailable fixture",
        "version": "7.0.29",
        "supported": true,
        "available": false,
        "warnings": [],
        "groups": [],
        "proxies": [],
        "error": "unreachable"
      }
    ]
  },
  "expected_unknown_display": "--",
  "expected_two_display": "2",
  "expected_zero_display": "0"
}
const pricingInputs = process.env.FIXED_INPUT ? JSON.parse(fs.readFileSync(process.env.FIXED_INPUT, 'utf8')) : pricingInlineInputs
assert.deepEqual(pricingInputs, pricingInlineInputs, 'identical fixed inputs for BASELINE/MODIFIED/ROLLBACK/REAPPLY')
const pricingPage = source('src/pages/system/proxy-management/index.vue')
const pricingMethod = /pricingBasis\(\)\s*\{([\s\S]*?)\},/.exec(pricingPage)[1]
const pricingReloadMethod = /async reload\(\)\s*\{([\s\S]*?)\r?\n    \},/.exec(pricingPage)[1]
const pricingLastSuccessMethod = /generatedAtLabel\(\)\s*\{([\s\S]*?)\},/.exec(pricingPage)[1]
const actualPricing = pricingVm.runInNewContext('(function(){'+pricingMethod+'})', {proxyPricingBasis: pricingModel.proxyPricingBasis})
const actualLastSuccess = pricingVm.runInNewContext('(function(){'+pricingLastSuccessMethod+'})')
function pricingState(snapshot = pricingModel.emptySnapshot()) {
  return {snapshot, loading: false, globalError: '', $t: () => 'never', formatTime: value => value}
}
async function actualPricingReload(state, response) {
  const reload = pricingVm.runInNewContext('(async function(){'+pricingReloadMethod+'})', {
    getProxyManagement: async () => structuredClone(response), readBusinessSnapshot: pricingModel.readBusinessSnapshot,
  })
  await reload.call(state)
}

test('first failed load must not publish numeric billable zero', async () => {
  const state = pricingState()
  await actualPricingReload(state, pricingInputs.failed_response)
  assert.equal(state.globalError, '无权执行该操作')
  assert.equal(state.loading, false)
  assert.equal(actualPricing.call(state).display, pricingInputs.expected_unknown_display)
  assert.equal(actualPricing.call(state).complete, false)
})

test('failed refresh must invalidate price value while preserving diagnostic snapshot', async () => {
  const preserved = structuredClone(pricingInputs.known_two_snapshot), state = pricingState(preserved)
  const lastSuccess = actualLastSuccess.call(state)
  assert.equal(actualPricing.call(state).display, pricingInputs.expected_two_display)
  await actualPricingReload(state, pricingInputs.failed_response)
  assert.equal(state.snapshot, preserved)
  assert.deepEqual(state.snapshot, pricingInputs.known_two_snapshot)
  assert.equal(actualLastSuccess.call(state), lastSuccess)
  assert.equal(state.globalError, '无权执行该操作')
  assert.equal(state.loading, false)
  assert.equal(actualPricing.call(state).display, pricingInputs.expected_unknown_display)
  assert.equal(actualPricing.call(state).count, 2, 'diagnostic count retained, not used as a confirmed price')
})

test('successful generated snapshot can publish genuine billable zero', async () => {
  const state = pricingState()
  await actualPricingReload(state, {data: {code: 200, data: pricingInputs.successful_zero_snapshot}})
  assert.equal(state.globalError, '')
  assert.equal(state.snapshot.generated_at, pricingInputs.successful_zero_snapshot.generated_at)
  assert.equal(actualPricing.call(state).complete, true)
  assert.equal(actualPricing.call(state).display, pricingInputs.expected_zero_display)
  assert.equal(pricingModel.proxyPricingBasis(state.snapshot).complete, true, 'optional flag defaults to successful request')
})

test('unrequested snapshot remains unconfirmed without a generation timestamp', () => {
  const state = pricingState()
  assert.equal(state.snapshot.generated_at, '')
  assert.equal(state.globalError, '')
  assert.equal(actualPricing.call(state).display, pricingInputs.expected_unknown_display)
  assert.equal(pricingModel.proxyPricingBasis(state.snapshot).complete, false)
})

test('successful refresh clears the request failure and restores the current price value', async () => {
  const state = pricingState(structuredClone(pricingInputs.successful_zero_snapshot))
  state.globalError = '无权执行该操作'
  await actualPricingReload(state, {data: {code: 200, data: pricingInputs.known_two_snapshot}})
  assert.equal(state.globalError, '')
  assert.equal(state.loading, false)
  assert.equal(state.snapshot.generated_at, pricingInputs.known_two_snapshot.generated_at)
  assert.equal(actualPricing.call(state).complete, true)
  assert.equal(actualPricing.call(state).display, pricingInputs.expected_two_display)
})

test('partial instance snapshots remain unconfirmed while retaining diagnostic rows', async () => {
  const state = pricingState()
  await actualPricingReload(state, {data: {code: 200, data: pricingInputs.partial_instance_snapshot}})
  assert.equal(state.globalError, '')
  assert.equal(state.snapshot.instances.length, 2)
  assert.equal(state.snapshot.instances[0].proxies.length, 1)
  assert.equal(state.snapshot.instances[1].error, 'unreachable')
  assert.equal(actualPricing.call(state).display, pricingInputs.expected_unknown_display)
  assert.equal(actualPricing.call(state).complete, false)
})
