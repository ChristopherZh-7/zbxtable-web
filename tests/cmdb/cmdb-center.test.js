const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  assetKey,
  classMeta,
  detailRows,
  isPlatformAdmin,
  mappingForTenant,
  relationBuckets,
} = require('../../src/pages/cmdb/cmdb-model')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('CMDB route and services stay inside the SmartOps application API', () => {
  const router = source('src/router/async/router.map.js')
  const service = source('src/services/cmdb.js')
  assert.match(router, /cmdbCenter:\s*\{[\s\S]*@\/pages\/cmdb/)
  for (const operation of ['getCMDBOverview', 'listCMDBAssets', 'getCMDBAsset', 'getCMDBRelations', 'listCMDBOrganizations', 'listCMDBMappings', 'upsertCMDBMapping']) {
    assert.match(service, new RegExp(`function ${operation}\\b`))
  }
  for (const forbidden of ['Auth-Token', 'SMARTOPS_ITOP', '18090', 'webservices/rest.php']) {
    assert.equal(service.includes(forbidden), false, `browser service leaked iTop detail: ${forbidden}`)
  }
})

test('CMDB page presents authoritative read-only and tenant-isolated behavior', () => {
  const page = source('src/pages/cmdb/index.vue')
  for (const copy of ['SOURCE OF TRUTH', 'iTop CMDB', '唯一真实源', '服务端只读 · 租户隔离', '资产台账', '配置属性', '配置关系', '上游依赖', '下游支撑']) {
    assert.ok(page.includes(copy), `missing confirmed CMDB UI copy: ${copy}`)
  }
  assert.match(page, /v-if="platformAdmin"[\s\S]*配置组织映射/)
  assert.match(page, /organizationAssignedElsewhere/)
  assert.doesNotMatch(page, /iframe|window\.open|target="_blank"/)
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

test('a fresh browser without local theme state still receives an object fallback', () => {
  const themeUtil = source('src/utils/themeUtil.js')
  assert.match(themeUtil, /localSettingStr \? JSON\.parse\(localSettingStr\) : null/)
  assert.match(themeUtil, /parsed && typeof parsed === 'object' \? parsed : \{\}/)
})
