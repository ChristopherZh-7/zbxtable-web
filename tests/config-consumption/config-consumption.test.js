const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  agentlessProfilesForScenario,
  agentlessSelectionPayload,
  agentlessProtocolLabel,
  applyEligibility,
  configurationContextKey,
  configurationFailureMessage,
  monitoringIdentity,
  normalizeConfigurationPage,
  relationApplications,
  retryableConfigurationTask,
  scenarioApplicationID,
  scenarioApplicationName,
  scenarioAssetClass,
  taskCIIdentity,
  taskHostSnapshot,
} = require('../../src/pages/host/config-consumption-model')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('Agentless selector is scoped and only sends opaque policy identity', () => {
  const digest = 'a'.repeat(64)
  const profile = {id: 'network-snmp', name: 'Network', protocol: 'snmp_v3', zid: 2, asset_classes: ['Server'], template_id: '7', digest}
  const resources = {agentless_profiles: [profile, {...profile, id: 'other-instance', zid: 3}, {...profile, id: 'other-class', asset_classes: ['NetworkDevice']}]}
  assert.deepEqual(agentlessProfilesForScenario(resources, 2, 'Server'), [profile])
  assert.deepEqual(agentlessSelectionPayload({agentless_profile_id: ''}, resources), {})
  const form = {zid: 2, asset_class: 'Server', template_id: '7', agentless_profile_id: profile.id, expected_agentless_digest: digest}
  assert.deepEqual(agentlessSelectionPayload(form, resources), {agentless_profile_id: profile.id, expected_agentless_digest: digest})
  for (const change of [{zid: 3}, {asset_class: 'NetworkDevice'}, {template_id: '9'}, {expected_agentless_digest: 'b'.repeat(64)}, {agentless_profile_id: 'missing-profile'}]) {
    assert.throws(() => agentlessSelectionPayload({...form, ...change}, resources), /重新选择/)
  }
  assert.match(agentlessProtocolLabel('snmp_v3'), /authPriv/)
  assert.match(agentlessProtocolLabel('https'), /证书校验/)
})

test('Agentless form keeps credentials server-side and invalidates instance/class changes', () => {
  const page = source('src/pages/host/ConfigConsumption.vue')
  assert.match(page, /data-testid="configuration-agentless-profile"/)
  assert.match(page, /密钥不进入浏览器/)
  assert.match(page, /@change="clearAgentlessSelection"/)
  assert.match(page, /expected_agentless_digest: String\(record.agentless_profile_digest/)
  assert.match(page, /\.\.\.agentlessSelectionPayload\(this.scenarioForm, this.resources\)/)
  assert.doesNotMatch(page, /v-model[^\n]*(credential|password|community|passphrase|token|http_path|url)/i)
  assert.match(configurationFailureMessage('agentless_credential_unavailable'), /服务端凭据引用不可用/)
})

test('configuration consumption is registered under the asset router', () => {
  const router = source('src/router/async/router.map.js')
  assert.match(router, /configConsumption:\s*\{[\s\S]*ConfigConsumption/)
})

test('page retains CI identity, monitoring bindings and policy controls without architecture banners', () => {
  const page = source('src/pages/host/ConfigConsumption.vue')
  for (const copy of [
    '配置数据来源', '配置管理中心', '配置组织', '编码', '组织映射版本',
    '配置项', '监控模板', '监控主机', '所属应用与配置项类型在创建后保持不变',
    '保留本次任务的资产、监控主机和执行结果', '当前', '归档', '遗留冻结',
  ]) assert.ok(page.includes(copy), `missing PRODUCT-003D authority copy: ${copy}`)
  assert.doesNotMatch(page, /hostList|business_system|asset_type_code/)
  assert.doesNotMatch(page, /\bzid:\s*this\.applyForm|\bhostid:\s*this\.applyForm/)
})

test('configuration services use CMDB identity, optimistic versions and context headers', () => {
  const services = source('src/services/admin.js')
  for (const fn of [
    'configurationResources', 'configurationScenarioList', 'createConfigurationScenario',
    'updateConfigurationScenario', 'deleteConfigurationScenario', 'configurationTaskList',
    'applyConfigurationScenario', 'retryConfigurationTask',
  ]) assert.match(services, new RegExp(`function ${fn}\\b`))
  assert.match(services, /X-CMDB-Organization-ID/)
  assert.match(services, /X-CMDB-Mapping-Generation/)
  assert.match(services, /\/assets\/['"]?\s*\+\s*encodeURIComponent\(assetClass\)[\s\S]*METHOD\.PUT/)
  assert.match(services, /expected_version:\s*Number\(expectedVersion\)/)
  assert.match(services, /configurationScenarioList\(params\)[\s\S]*METHOD\.GET, params/)
  assert.match(services, /configurationTaskList\(params\)[\s\S]*METHOD\.GET, params/)
  assert.doesNotMatch(services, /CONFIG_CONSUMPTION\s*\+\s*['"]\/hosts\//)
})

test('page drives real server pagination for scenarios, tasks and iTop assets', () => {
  const page = source('src/pages/host/ConfigConsumption.vue')
  const cmdb = source('src/services/cmdb.js')
  for (const testID of [
    'configuration-scenario-pagination', 'configuration-task-pagination', 'configuration-asset-pagination',
  ]) assert.match(page, new RegExp(`data-testid="${testID}"`))
  assert.match(page, /configurationScenarioList\(\{scope, page:[\s\S]*page_size:/)
  assert.match(page, /configurationTaskList\(\{scope, page:[\s\S]*page_size:/)
  assert.match(page, /listCMDBAssets\(\{[\s\S]*class:\s*scenarioAssetClass\(scenario\)[\s\S]*page:[\s\S]*page_size:/)
  assert.match(cmdb, /function listCMDBAssets\(params\)[\s\S]*METHOD\.GET, params/)
  assert.doesNotMatch(page, /limit:\s*1000/)
})

test('writes are absent for viewers and frozen scopes', () => {
  const page = source('src/pages/host/ConfigConsumption.vue')
  assert.match(page, /v-if="scenarioScope === 'current' && canCreate && writeContextReady"[\s\S]*data-testid="configuration-scenario-create"/)
  assert.match(page, /v-if="scenarioScope === 'current' && canOperate && writeContextReady"[\s\S]*data-testid="configuration-asset-apply"/)
  assert.match(page, /scenarioScope === 'current' && writeContextReady/)
  assert.match(page, /taskScope === 'current' && canOperate && writeContextReady && retryableConfigurationTask\(record\)/)
  assert.match(page, /v-if="scenarioScope === 'current' && canCreate && writeContextReady"[\s\S]*<a-modal/)
  assert.match(page, /v-if="scenarioScope === 'current' && canOperate && writeContextReady"[\s\S]*title="从配置项应用场景"/)
})

test('context key invalidates forms and stale responses cannot replace current state', () => {
  const page = source('src/pages/host/ConfigConsumption.vue')
  assert.match(page, /normalizeCMDBContext\(this\.overview, this\.currentTenantID\)/)
  assert.match(page, /activeCMDBContextKey/)
  assert.match(page, /tenantContextChangingEvent/)
  assert.match(page, /invalidateContext\([\s\S]*resetWorkspaces/)
  assert.match(page, /this\.scenarioVisible = false/)
  assert.match(page, /this\.applyVisible = false/)
  assert.match(page, /this\.pollContext\(\)/)
  assert.match(page, /overviewResponseIsCurrent\(overviewResponse\)/)
  assert.match(page, /sequence !== this\.assetSequence \|\| contextKey !== this\.activeCMDBContextKey/)
  assert.match(page, /sequence !== this\.assetDetailSequence \|\| contextKey !== this\.activeCMDBContextKey/)
  assert.match(page, /contextIsCurrent\(context\)/)
})

test('scenario and task snapshots normalize backend authority fields', () => {
  const scenario = {
    application_id: 41,
    application_name_snapshot: 'Payments',
    asset_class: 'Server',
  }
  assert.equal(scenarioApplicationID(scenario), 41)
  assert.equal(scenarioApplicationName(scenario), 'Payments')
  assert.equal(scenarioAssetClass(scenario), 'Server')

  const task = {
    ci_snapshot: {class: 'Server', id: 71, name_snapshot: 'pay-01', revision: 'r9'},
    host_snapshot: {zid: 2, host_id: '9001', host_name: 'pay-zbx', instance_name: 'Zabbix East'},
  }
  assert.deepEqual(taskCIIdentity(task), {class: 'Server', id: 71, name: 'pay-01', revision: 'r9'})
  assert.deepEqual(taskHostSnapshot(task), {zid: 2, host_id: '9001', host_name: 'pay-zbx', instance_name: 'Zabbix East'})
})

test('configuration pages preserve server scope, totals and legal paging', () => {
  assert.deepEqual(normalizeConfigurationPage({
    scope: 'archive', items: [{id: 1}], total: 53, page: 3, page_size: 20,
  }, 'current', 10), {
    scope: 'archive', items: [{id: 1}], total: 53, page: 3, page_size: 20,
  })
  assert.deepEqual(normalizeConfigurationPage([{id: 4}], 'legacy', 20), {
    scope: 'legacy', items: [{id: 4}], total: 1, page: 1, page_size: 20,
  })
})

test('successful configuration tasks are described as applied, not as monitoring completion', () => {
  const page = source('src/pages/host/ConfigConsumption.vue')
  assert.match(page, /success:\s*\{label:\s*'配置已应用'/)
  assert.doesNotMatch(page, /success:\s*\{label:\s*'已完成'/)
})

test('only a directly related ApplicationSolution and a resolved F49 host can be applied', () => {
  const asset = {key: 'Server:7', class: 'Server', id: 7, name: 'app-01', revision: 'r3'}
  const relations = {
    nodes: [
      asset,
      {key: 'ApplicationSolution:9', class: 'ApplicationSolution', id: 9, name: 'Payments'},
      {key: 'ApplicationSolution:10', class: 'ApplicationSolution', id: 10, name: 'Unrelated'},
    ],
    edges: [{from: 'ApplicationSolution:9', to: 'Server:7', relation: 'solution/servers'}],
  }
  const applications = relationApplications(relations, asset)
  assert.deepEqual(applications.map(item => item.id), [9])

  const scenario = {application_id: 9, asset_class: 'Server'}
  const bound = {
    binding: {id: 8, version: 4, zid: 2, host_id: '9001'},
    host: {zid: 2, host_id: '9001', host_name: 'app-zbx', instance_name: 'Zabbix East'},
  }
  assert.equal(applyEligibility(asset, applications, bound, scenario).ready, true)
  assert.equal(applyEligibility(asset, [], bound, scenario).code, 'configuration_application_mismatch')
  assert.equal(applyEligibility(asset, applications, {}, scenario).code, 'configuration_binding_required')
  assert.equal(applyEligibility({...asset, revision: ''}, applications, bound, scenario).code, 'asset_revision_missing')
  assert.equal(monitoringIdentity(bound).host_id, '9001')
})

test('legacy and blocked tasks stay frozen while an exhausted transient task keeps manual retry', () => {
  assert.equal(retryableConfigurationTask({status: 'failed', context_state: 'current', retry_count: 1, max_retry: 3}), true)
  assert.equal(retryableConfigurationTask({status: 'failed', context_state: 'legacy_frozen', retry_count: 0, max_retry: 3}), false)
  assert.equal(retryableConfigurationTask({status: 'failed', context_state: 'current', blocked: true}), false)
  assert.equal(retryableConfigurationTask({status: 'failed', context_state: 'current', retry_count: 3, max_retry: 3}), true)
  assert.match(configurationFailureMessage('configuration_binding_missing'), /监控关联/)
  assert.match(configurationFailureMessage('mapping_generation_mismatch'), /GEN|generation|GEN|\u4e16代/)
  assert.match(configurationFailureMessage('configuration_target_invalid'), /配置项.*监控主机.*主机组.*监控模板/)
})

test('list response context composes the same tenant, Organization and generation key', () => {
  assert.equal(configurationContextKey({organization_id: 44, generation: 8}, 3), '3:44:8')
  assert.equal(configurationContextKey({organization_id: 44}, 3), '')
  const page = source('src/pages/host/ConfigConsumption.vue')
  assert.match(page, /configurationResponseIsCurrent\(data\)/)
  assert.match(page, /configurationContextKey\(data && data\.context, this\.currentTenantID\)/)
})
