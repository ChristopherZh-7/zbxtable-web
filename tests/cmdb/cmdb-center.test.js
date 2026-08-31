const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  assetKey,
  buildAssetFields,
  candidateMatchLabel,
  classMeta,
  createAssetForm,
  detailRows,
  editableFields,
  isPlatformAdmin,
  lifecycleMeta,
  mappingForTenant,
  monitoringHostStatusLabel,
  monitoringStateMeta,
  relationBuckets,
  statusOptions,
  validateAssetForm,
} = require('../../src/pages/cmdb/cmdb-model')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('CMDB route and services stay inside the SmartOps application API', () => {
  const router = source('src/router/async/router.map.js')
  const service = source('src/services/cmdb.js')
  assert.match(router, /cmdbCenter:\s*\{[\s\S]*@\/pages\/cmdb/)
  for (const operation of ['getCMDBOverview', 'listCMDBAssets', 'getCMDBAsset', 'getCMDBRelations', 'getCMDBMonitoring', 'listCMDBMonitoringCandidates', 'bindCMDBMonitoring', 'unbindCMDBMonitoring', 'repairCMDBMonitoring', 'getCMDBReferences', 'createCMDBAsset', 'updateCMDBAsset', 'retireCMDBAsset', 'activateCMDBAsset', 'listCMDBOrganizations', 'listCMDBMappings', 'upsertCMDBMapping']) {
    assert.match(service, new RegExp(`function ${operation}\\b`))
  }
  assert.doesNotMatch(service, /deleteCMDBAsset|METHOD\.DELETE/)
  for (const forbidden of ['Auth-Token', 'SMARTOPS_ITOP', '18090', 'webservices/rest.php']) {
    assert.equal(service.includes(forbidden), false, `browser service leaked iTop detail: ${forbidden}`)
  }
})

test('CMDB page presents authoritative governed lifecycle and tenant isolation', () => {
  const page = source('src/pages/cmdb/index.vue')
  for (const copy of ['SOURCE OF TRUTH', 'iTop CMDB', '唯一配置真源', '受控写入 · 租户隔离', '新增资产', '编辑资产', '退役', '重新启用', '不会删除历史', '资产台账', '配置属性', '配置关系', '上游依赖', '下游支撑']) {
    assert.ok(page.includes(copy), `missing confirmed CMDB UI copy: ${copy}`)
  }
  assert.match(page, /v-if="platformAdmin"[\s\S]*配置组织映射/)
  assert.match(page, /v-if="canCreate && sourceReady"[\s\S]*新增资产/)
  assert.match(page, /v-if="canUpdate && !selectedLifecycle\.retired"[\s\S]*编辑资产/)
  assert.match(page, /canPerform\(this\.permissions, 'tenant\.cmdb', 'operate'\)/)
  assert.match(page, /organizationAssignedElsewhere/)
  assert.doesNotMatch(page, /iframe|window\.open|target="_blank"/)
})

test('CMDB inspector presents an explicit CI to Host monitoring closure without automatic binding', () => {
  const page = source('src/pages/cmdb/index.vue')
  for (const copy of ['监控闭环', 'CMDB ↔ ZABBIX', 'iTop 期望', 'Zabbix 实际', '关联监控主机', '更换绑定', '按 CMDB 状态修复监控', '解除关联', '只建立身份关联，不复制资产数据', '最终仍需人工确认']) {
    assert.ok(page.includes(copy), `missing monitoring closure copy: ${copy}`)
  }
  assert.match(page, /v-if="canOperate" class="monitoring-actions"/)
  assert.match(page, /v-if="monitoringReconciliation\.can_repair"/)
  assert.match(page, /candidate\.selectable/)
  assert.doesNotMatch(page, /自动绑定|创建 Zabbix|删除 Zabbix/)
})

test('CMDB page distinguishes empty ready, unconfigured and read failure states', () => {
  const page = source('src/pages/cmdb/index.vue')
  assert.match(page, /overview\.state === 'error' \? 'error'/)
  assert.match(page, /overview\.state === 'error'[\s\S]*CMDB 数据读取失败/)
  assert.match(page, /overview\.state === 'unconfigured'[\s\S]*当前租户尚未关联 iTop Organization/)
  assert.match(page, /if \(this\.overview\.state === 'error'\) return '读取失败'/)
  assert.match(page, /if \(this\.overview\.state === 'unconfigured'\) return '未配置'/)
  assert.match(page, /v-else[\s\S]*资产台账/)
})

test('CMDB model builds stable asset metadata and detail rows', () => {
  const asset = {id: 7, class: 'Server', name: 'cmdb-app-01', managementip: '10.0.0.7', empty: ''}
  assert.equal(assetKey(asset), 'Server:7')
  assert.equal(classMeta('Server').label, '物理服务器')
  assert.deepEqual(detailRows(asset), [
    {key: 'managementip', label: '管理 IP', value: '10.0.0.7'},
  ])
})

test('CMDB model exposes only the confirmed per-class write fields', () => {
  const serverFields = editableFields('Server').map((field) => field.key)
  const pcFields = editableFields('PC').map((field) => field.key)
  const networkFields = editableFields('NetworkDevice').map((field) => field.key)
  assert.ok(serverFields.includes('managementip'))
  assert.equal(pcFields.includes('managementip'), false)
  assert.ok(networkFields.includes('networkdevicetype_id'))
  assert.equal(editableFields('Person').length, 0)
})

test('CMDB form payload trims fields, preserves clears and validates network type', () => {
  const createForm = createAssetForm('Server')
  createForm.name = '  app-01  '
  createForm.managementip = ' 10.0.0.8 '
  const createFields = buildAssetFields('Server', createForm, true)
  assert.equal(createFields.name, 'app-01')
  assert.equal(createFields.managementip, '10.0.0.8')
  assert.equal(Object.hasOwn(createFields, 'location_id'), false)

  const editForm = createAssetForm('Server', {name: 'app-01', status: 'production', location_id: 9})
  editForm.location_id = undefined
  const editFields = buildAssetFields('Server', editForm, false)
  assert.equal(editFields.location_id, 0)
  assert.equal(validateAssetForm('NetworkDevice', {name: 'switch-01'}), '请选择网络设备类型')
  assert.equal(validateAssetForm('NetworkDevice', {name: 'switch-01', networkdevicetype_id: 3}), '')
})

test('CMDB lifecycle treats retired records as recoverable rather than deleted', () => {
  assert.deepEqual(lifecycleMeta({status: 'obsolete'}), {retired: true, action: 'activate', label: '重新启用'})
  assert.deepEqual(lifecycleMeta({status: 'production'}), {retired: false, action: 'retire', label: '退役'})
  assert.deepEqual(statusOptions('ApplicationSolution'), [{value: 'active', label: '启用'}])
})

test('CMDB monitoring model labels reconciliation, runtime state and candidate evidence', () => {
  assert.deepEqual(monitoringStateMeta({state: 'healthy'}), {status: 'success', label: '关联正常', tone: 'healthy'})
  assert.equal(monitoringStateMeta({state: 'host_missing'}).status, 'error')
  assert.equal(monitoringHostStatusLabel('enabled'), '启用')
  assert.equal(monitoringHostStatusLabel('disabled'), '停用')
  assert.equal(candidateMatchLabel({match_reasons: ['名称一致', '管理 IP 一致']}), '名称一致 · 管理 IP 一致')
  assert.equal(candidateMatchLabel({match_reasons: []}), '无自动匹配依据，需人工确认')
})

test('CMDB relation spine separates upstream and downstream around the selected node', () => {
  const app = {key: 'ApplicationSolution:1', id: 1, class: 'ApplicationSolution', name: 'Portal'}
  const server = {key: 'Server:2', id: 2, class: 'Server', name: 'Server'}
  const network = {key: 'NetworkDevice:3', id: 3, class: 'NetworkDevice', name: 'Switch'}
  const relations = {
    nodes: [app, server, network],
    edges: [
      {from: app.key, to: server.key, relation: 'supports'},
      {from: server.key, to: network.key, relation: 'depends_on'},
    ],
  }
  assert.deepEqual(relationBuckets(relations, server).upstream.map((node) => node.name), ['Portal'])
  assert.deepEqual(relationBuckets(relations, server).downstream.map((node) => node.name), ['Switch'])
})

test('only platform administrators may see mapping management and mappings resolve by tenant', () => {
  assert.equal(isPlatformAdmin({role: 'admin'}), true)
  assert.equal(isPlatformAdmin({role: 'platform_admin'}), true)
  assert.equal(isPlatformAdmin({role: 'tenant_admin'}), false)
  const mapping = mappingForTenant([{tenant_id: 3, itop_organization_id: 8}], '3')
  assert.equal(mapping.itop_organization_id, 8)
})

test('tenant viewers do not trigger platform-only setup or dashboard configuration requests', () => {
  const layout = source('src/layouts/AdminLayout.vue')
  const dashboard = source('src/pages/dashboard/index.vue')
  assert.match(layout, /isPlatformAdministrator\(\)[\s\S]*role === 'admin' \|\| role === 'platform_admin'/)
  assert.match(layout, /if \(this\.isPlatformAdministrator\) this\.checkSetupStatus\(\)/)
  assert.match(dashboard, /const configReady = this\.isPlatformAdministrator \? this\.initConfig\(\) : Promise\.resolve\(\)/)
  assert.match(dashboard, /v-if="isPlatformAdministrator" size="small" icon="setting"/)
})

test('a fresh browser without local theme state still receives an object fallback', () => {
  const themeUtil = source('src/utils/themeUtil.js')
  assert.match(themeUtil, /localSettingStr \? JSON\.parse\(localSettingStr\) : null/)
  assert.match(themeUtil, /parsed && typeof parsed === 'object' \? parsed : \{\}/)
})
