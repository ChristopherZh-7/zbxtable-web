const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const {activeProvision, acceptsProvisionSnapshot, newProvisionRequestKey, provisionIdentityKey, provisionRequest, provisionState} = require('../../src/pages/cmdb/monitoring-provision-model')
const source = name => fs.readFileSync(path.join(__dirname, '../..', name), 'utf8')

test('provision request contains only a scoped group, CI revision and stable operation key', () => {
  const key = '00000000-0000-4000-8000-000000000001'
  const asset = {id: 9, class: 'Server', revision: 'a'.repeat(64)}
  const group = {zid: 2, host_group_id: '41'}
  assert.deepEqual(provisionRequest(group, asset, key), {zid: 2, target_host_group_id: '41', expected_revision: asset.revision, idempotency_key: key})
  for (const bad of [null, {...group, zid: 0}, {...group, host_group_id: '../41'}]) assert.throws(() => provisionRequest(bad, asset, key))
  assert.throws(() => provisionRequest(group, {...asset, revision: ''}, key))
  assert.equal(newProvisionRequestKey({}), '')
  assert.equal(newProvisionRequestKey({randomUUID: () => key}), key)
})

test('creation is not represented as collection health and task identity includes mapping context', () => {
  assert.equal(provisionState('bound').label, '创建并绑定完成')
  assert.notEqual(provisionState('bound').label, '采集健康')
  assert.equal(activeProvision({status: 'pending'}), true)
  assert.equal(activeProvision({status: 'failed', retryable: true}), true)
  assert.equal(activeProvision({status: 'bound'}), false)
  assert.equal(provisionIdentityKey({key: '7:41:1', ready: true}, {class: 'Server', id: 9}), '7:41:1/Server:9')
  assert.equal(provisionIdentityKey({key: '7:41:1', ready: false}, {class: 'Server', id: 9}), '')
})

test('native provisioning preserves role gates, snapshots and stale response boundaries', () => {
  const page = source('src/pages/cmdb/MonitoringProvision.vue')
  assert.match(page, /v-if="writable && !bound && !retired"/)
  assert.match(page, /if \(!this.requestSnapshot\) this.requestSnapshot = provisionRequest/)
  assert.match(page, /if \(!acceptsProvisionSnapshot\(this.latest, newest\)\) return/)
  assert.match(page, /if \(acceptsProvisionSnapshot\(this.latest, job\)\) this.jobs/)
  assert.match(page, /if \(acceptsProvisionSnapshot\(this.latest, result\)\) this.jobs/)
  assert.match(page, /beforeDestroy\(\)[\s\S]*this.disposed = true/)
  assert.match(page, /checkContext\(data\)/)
  assert.match(page, /bound\(\) \{ this.loadJobs\(\) \}/)
  assert.match(page, /writable\(value\)[\s\S]*this.close/)
  assert.match(page, /v-if="writable && bound && !configured"[\s\S]*?cmdb-provision-configure/)
  assert.match(page, /:message="error"/)
  assert.doesNotMatch(page, /v-model[^\n]*(template|interface|credential)/i)
  assert.doesNotMatch(page, /v-model[^\n]*(password|token|community|host_id|host_name|address)/i)
  const parent = source('src/pages/cmdb/index.vue')
  assert.match(parent, /:key="`\$\{cmdbContext.key\}\/\$\{assetKey\(selectedAsset\)\}`"/)
  assert.match(parent, /!detailLoading && selectedAsset && selectedDetail && assetKey\(selectedAsset\) === assetKey\(selectedDetail\)/)
  assert.match(parent, /:asset="selectedDetail"/)
  assert.match(parent, /监控对象创建任务/)
  assert.match(parent, /受影响的监控创建任务/)
  assert.match(parent, /result.archived_monitoring_provisions/)
  const services = source('src/services/cmdb.js')
  assert.match(services, /function createMonitoringProvision[\s\S]*cmdbWriteConfig\(context\)/)
})

test('stale or empty polling cannot erase an accepted job or roll its version back', () => {
  const current = {id: 10, version: 3, status: 'bound'}
  assert.equal(acceptsProvisionSnapshot(null, null), true)
  assert.equal(acceptsProvisionSnapshot(null, current), true)
  for (const older of [null, {id: 9, version: 99}, {id: 10, version: 2}, {id: 'invalid', version: 4}]) {
    assert.equal(acceptsProvisionSnapshot(current, older), false)
  }
  for (const newer of [current, {id: 10, version: 4}, {id: 11, version: 1}]) {
    assert.equal(acceptsProvisionSnapshot(current, newer), true)
  }
})
