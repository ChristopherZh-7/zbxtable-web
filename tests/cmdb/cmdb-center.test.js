const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  admissionEvidenceLabel,
  admissionStateMeta,
  assetKey,
  buildAssetFields,
  candidateMatchLabel,
  classMeta,
  createAssetForm,
  createAdmissionForm,
  detailRows,
  editableFields,
  governanceTenantIsCurrent,
  isPlatformAdmin,
  lifecycleMeta,
  mappingFailureInvalidatesContext,
  mappingForTenant,
  mappingPreviewContextChanged,
  mappingTransitionReasonMessage,
  monitoringHostStatusLabel,
  monitoringStateMeta,
  normalizeCMDBContext,
  normalizeMappingTransitionPreview,
  relationBuckets,
  statusOptions,
  validateAssetForm,
} = require('../../src/pages/cmdb/cmdb-model')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('CMDB route and services stay inside the SmartOps application API', () => {
  const router = source('src/router/async/router.map.js')
  const service = source('src/services/cmdb.js')
  assert.match(router, /cmdbCenter:\s*\{[\s\S]*@\/pages\/cmdb/)
  for (const operation of ['getCMDBOverview', 'listCMDBAssets', 'getCMDBAsset', 'getCMDBRelations', 'getCMDBMonitoring', 'listCMDBMonitoringCandidates', 'bindCMDBMonitoring', 'unbindCMDBMonitoring', 'repairCMDBMonitoring', 'getCMDBReferences', 'listCMDBAdmissions', 'admitCMDBCandidate', 'retryCMDBAdmission', 'createCMDBAsset', 'updateCMDBAsset', 'retireCMDBAsset', 'activateCMDBAsset', 'listCMDBOrganizations', 'listCMDBMappings', 'upsertCMDBMapping', 'previewCMDBMappingTransition', 'executeCMDBMappingTransition']) {
    assert.match(service, new RegExp(`function ${operation}\\b`))
  }
  assert.doesNotMatch(service, /deleteCMDBAsset|METHOD\.DELETE/)
  for (const forbidden of ['Auth-Token', 'SMARTOPS_ITOP', '18090', 'webservices/rest.php']) {
    assert.equal(service.includes(forbidden), false, `browser service leaked iTop detail: ${forbidden}`)
  }
})

test('CMDB page presents authoritative governed lifecycle and tenant isolation', () => {
  const page = source('src/pages/cmdb/index.vue')
  for (const copy of ['配置数据来源', '配置管理中心', '新增资产', '编辑资产', '退役', '重新启用', '不会删除历史', '资产台账', '配置属性', '配置关系', '上游依赖', '下游支撑']) {
    assert.ok(page.includes(copy), `missing confirmed CMDB UI copy: ${copy}`)
  }
  assert.match(page, /v-if="platformAdmin"[\s\S]*配置组织映射/)
  assert.match(page, /v-if="canCreate && writeContextReady"[\s\S]*新增资产/)
  assert.match(page, /v-if="canUpdate && !selectedLifecycle\.retired"[\s\S]*编辑资产/)
  assert.match(page, /canPerform\(this\.permissions, 'tenant\.cmdb', 'operate'\)/)
  assert.match(page, /organizationAssignedElsewhere/)
  assert.match(page, /getCMDBOverview/)
  assert.match(page, /listCMDBAssets/)
  assert.doesNotMatch(page, /iframe|window\.open|target="_blank"/)
})

test('CMDB asset editor is grouped, viewport-safe and never compiles a third grid column', () => {
  const page = source('src/pages/cmdb/index.vue')
  for (const section of ['基本信息', '责任归属', '技术与采购']) {
    assert.ok(page.includes(section), `missing asset form section: ${section}`)
  }
  assert.match(page, /width="840px"/)
  assert.match(page, /maxHeight: 'calc\(100vh - 260px\)'/)
  assert.match(page, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(page, /grid-column-start: 1; grid-column-end: -1;/)
  assert.doesNotMatch(page, /grid-column:\s*1\s*\/\s*-1/)
})

test('CMDB inspector separates binding reconciliation, configuration and collection health without automatic binding', () => {
  const page = source('src/pages/cmdb/index.vue')
  for (const copy of ['监控状态', '资产 ↔ 监控', '绑定对账', '配置状态', '采集健康', '资产期望', '监控实际', '关联监控主机', '更换绑定', '按 CMDB 状态修复监控', '解除关联', '只建立身份关联，不复制资产数据', '最终仍需人工确认']) {
    assert.ok(page.includes(copy), `missing monitoring state copy: ${copy}`)
  }
  assert.match(page, /data-testid="cmdb-binding-reconciliation"/)
  assert.match(page, /data-testid="cmdb-monitoring-configuration"/)
  assert.match(page, /data-testid="cmdb-collection-health"/)
  assert.match(page, /collection_health/)
  assert.match(page, /v-if="canOperate && writeContextReady" class="monitoring-actions"/)
  assert.match(page, /v-if="monitoringReconciliation\.can_repair"/)
  assert.match(page, /candidate\.selectable/)
  assert.doesNotMatch(page, /自动绑定|创建 Zabbix|删除 Zabbix|创建监控主机|删除监控主机/)
})

test('CMDB page distinguishes empty ready, unconfigured and read failure states', () => {
  const page = source('src/pages/cmdb/index.vue')
  assert.match(page, /overview\.state === 'error' \? 'error'/)
  assert.match(page, /overview\.state === 'error'[\s\S]*CMDB 数据读取失败/)
  assert.match(page, /overview\.state === 'unconfigured'[\s\S]*当前租户尚未关联配置组织/)
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
  assert.ok(serverFields.includes('smartops_operations_team_id'))
  assert.ok(serverFields.includes('smartops_primary_owner_id'))
  assert.ok(serverFields.includes('smartops_backup_owner_id'))
  assert.equal(pcFields.includes('managementip'), false)
  assert.ok(networkFields.includes('networkdevicetype_id'))
  assert.equal(editableFields('Person').length, 0)
})

test('CMDB form payload trims fields, preserves clears and validates network type', () => {
  const createForm = createAssetForm('Server')
  createForm.name = '  app-01  '
  createForm.managementip = ' 10.0.0.8 '
  createForm.smartops_operations_team_id = 21
  createForm.smartops_primary_owner_id = 31
  const createFields = buildAssetFields('Server', createForm, true)
  assert.equal(createFields.name, 'app-01')
  assert.equal(createFields.managementip, '10.0.0.8')
  assert.equal(createFields.smartops_operations_team_id, 21)
  assert.equal(Object.hasOwn(createFields, 'location_id'), false)

  const editForm = createAssetForm('Server', {name: 'app-01', status: 'production', location_id: 9})
  editForm.location_id = undefined
  const editFields = buildAssetFields('Server', editForm, false)
  assert.equal(editFields.location_id, 0)
  assert.equal(validateAssetForm('NetworkDevice', {name: 'switch-01'}), '请选择运维团队')
  assert.equal(validateAssetForm('NetworkDevice', {name: 'switch-01', status: 'production', smartops_operations_team_id: 21, networkdevicetype_id: 3}), '生产/在用资产必须选择主负责人')
  assert.equal(validateAssetForm('NetworkDevice', {name: 'switch-01', status: 'production', smartops_operations_team_id: 21, smartops_primary_owner_id: 31, smartops_backup_owner_id: 31, networkdevicetype_id: 3}), '备份负责人不能与主负责人相同')
  assert.equal(validateAssetForm('NetworkDevice', {name: 'switch-01', status: 'production', smartops_operations_team_id: 21, smartops_primary_owner_id: 31, smartops_backup_owner_id: 32, networkdevicetype_id: 3}), '')
  assert.equal(validateAssetForm('ApplicationSolution', {name: 'portal', status: 'active'}), '')
})

test('CMDB admission model preserves classified evidence, suggested type and recoverable stages', () => {
  const candidate = {
    host_name: 'edge-01',
    address: '10.50.0.11',
    suggested_class: 'NetworkDevice',
    state: 'binding_pending',
    classifications: [
      {category: '网络设备', template_name: 'Cisco IOS by SNMP'},
      {category: '服务器', product: 'Linux'},
    ],
  }
  assert.deepEqual(admissionStateMeta(candidate), {status: 'warning', label: '监控待关联', tone: 'pending', step: 2})
  assert.equal(admissionEvidenceLabel(candidate), 'Cisco IOS by SNMP · Linux')
  const form = createAdmissionForm(candidate)
  assert.equal(form.class, 'NetworkDevice')
  assert.equal(form.fields.name, 'edge-01')
  assert.equal(form.fields.managementip, '10.50.0.11')
})

test('CMDB admission queue drives real API pagination and preserves a legal current page', () => {
  const page = source('src/pages/cmdb/index.vue')
  const service = source('src/services/cmdb.js')

  assert.match(service, /function listCMDBAdmissions\(params\)[\s\S]*METHOD\.GET, params/)
  assert.match(page, /data-testid="cmdb-admission-pagination"/)
  assert.match(page, /:current="admissionPage\.page"/)
  assert.match(page, /:page-size="admissionPage\.page_size"/)
  assert.match(page, /@change="changeAdmissionPage"/)
  assert.match(page, /emptyAdmissionPage = \(\) => \(\{items: \[\], total: 0, page: 1, page_size: 100, limit: 200\}\)/)

  assert.match(page, /@search="applyAdmissionFilters"/)
  const admissionSearch = page.match(/<a-input-search[\s\S]*?placeholder="搜索主机、IP、主机编号"[\s\S]*?\/>/)
  assert.ok(admissionSearch, 'the admission search input must be rendered')
  assert.doesNotMatch(
    admissionSearch[0],
    /:loading="admissionLoading"/,
    'an in-flight admission request must not make Ant InputSearch discard a newer operator search',
  )
  assert.match(page, /@change="applyAdmissionFilters"/)
  assert.match(page, /applyAdmissionFilters\(\) \{[\s\S]*?loadAdmissions\(1\)/)
  assert.match(page, /refreshAdmissions\(\) \{[\s\S]*?loadAdmissions\(this\.admissionPage\.page\)/)
  assert.match(page, /changeAdmissionPage\(page\) \{[\s\S]*?loadAdmissions\(page\)/)

  assert.match(page, /listCMDBAdmissions\(\{[\s\S]*?page: requestedPage,[\s\S]*?page_size: requestedPageSize/)
  assert.match(page, /const lastPage = Math\.max\(1, Math\.ceil\(total \/ pageSize\)\)/)
  assert.match(page, /if \(responsePage > lastPage\) \{[\s\S]*?loadAdmissions\(lastPage\)/)
  assert.match(page, /const requestedPage = [^\n]*this\.admissionPage\.page/)
  assert.match(
    page,
    /const initialAdmissionLoad = this\.loadAdmissions\(\)[\s\S]*?await this\.ensureCMDBReferences\(\)[\s\S]*?await initialAdmissionLoad/,
    'the initial queue request must start before slow reference aggregation',
  )
  assert.ok((page.match(/await this\.loadAdmissions\(\)/g) || []).length >= 2, 'submit and retry must reload the current page')
})

test('CMDB lifecycle treats retired records as recoverable rather than deleted', () => {
  assert.deepEqual(lifecycleMeta({status: 'obsolete'}), {retired: true, action: 'activate', label: '重新启用'})
  assert.deepEqual(lifecycleMeta({status: 'production'}), {retired: false, action: 'retire', label: '退役'})
  assert.deepEqual(statusOptions('ApplicationSolution'), [{value: 'active', label: '启用'}])
})

test('CMDB monitoring model labels reconciliation, runtime state and candidate evidence', () => {
  assert.deepEqual(monitoringStateMeta({state: 'healthy'}), {status: 'success', label: '绑定对账正常', tone: 'healthy'})
  assert.equal(monitoringStateMeta({state: 'host_missing'}).status, 'error')
  assert.equal(monitoringHostStatusLabel('enabled'), '启用')
  assert.equal(monitoringHostStatusLabel('disabled'), '停用')
  assert.equal(candidateMatchLabel({match_reasons: ['名称一致', '管理 IP 一致']}), '名称一致 · 管理 IP 一致')
  assert.equal(candidateMatchLabel({match_reasons: []}), '无自动匹配依据，需人工确认')
})

test('CMDB admission completion proves only iTop creation and F49 binding', () => {
  assert.deepEqual(admissionStateMeta({state: 'completed'}), {status: 'success', label: '建档并绑定完成', tone: 'completed', step: 3})
  const page = source('src/pages/cmdb/index.vue')
  assert.match(page, /责任建档并绑定完成/)
  assert.match(page, /采集健康需另行判定/)
  assert.doesNotMatch(page, /责任与监控已闭环|value="completed">闭环完成/)
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

test('Organization governance separates initial binding from an explicit previewed transition', () => {
  const page = source('src/pages/cmdb/index.vue')
  const service = source('src/services/cmdb.js')
  const request = source('src/utils/request.js')
  for (const testID of [
    'cmdb-mapping-open', 'cmdb-mapping-current', 'cmdb-mapping-target', 'cmdb-mapping-preview',
    'cmdb-mapping-impact', 'cmdb-mapping-confirmation', 'cmdb-mapping-reason', 'cmdb-mapping-transition-submit',
  ]) assert.ok(page.includes(`data-testid="${testID}"`), `missing governance selector: ${testID}`)
  for (const copy of ['当前组织 · 已关联', '待切换组织', '受影响的关联记录', '原资产与监控数据保留', '遗留未完成关联（待归档）', 'archived_unresolved', '精确确认短语', '切换原因']) {
    assert.ok(page.includes(copy), `missing explicit transition copy: ${copy}`)
  }
  assert.match(page, /v-if="mappingForm\.tenant_id && !selectedMapping"/)
  assert.match(page, /v-else-if="mappingForm\.tenant_id && selectedMapping"/)
  assert.match(page, /expected_organization_id:[\s\S]*expected_generation:[\s\S]*preview_digest:[\s\S]*idempotency_key:/)
  assert.match(service, /mappings\/\$\{encodeURIComponent\(tenantID\)\}\/transitions\/preview/)
  assert.match(service, /mappings\/\$\{encodeURIComponent\(tenantID\)\}\/transitions`/)
  assert.match(service, /X-CMDB-Organization-ID/)
  assert.match(service, /X-CMDB-Mapping-Generation/)
  assert.match(request, /tenant && tenant\.id[\s\S]*config && config\.headers/, 'explicit target tenant header must override stored tenant context')
})

test('CMDB context and transition preview normalization are fail-closed and generation-aware', () => {
  const context = normalizeCMDBContext({
    state: 'ready',
    organization: {id: 81, name: 'ORG-A'},
    mapping: {tenant_id: 7, itop_organization_id: 81, generation: 4, state: 'active'},
  }, 7)
  assert.deepEqual(context, {tenant_id: 7, organization_id: 81, generation: 4, state: 'active', key: '7:81:4', ready: true})
  assert.equal(normalizeCMDBContext({state: 'ready', organization: {id: 81}}, 7).ready, false)

  const preview = normalizeMappingTransitionPreview({
    current_organization: {id: 81}, target_organization: {id: 92}, generation: 4,
    preview_digest: 'a'.repeat(64), confirmation: '切换 81 到 92', external_data_preserved: true,
    impact: {
      assets: 12, asset_counts: {Server: 8}, admissions: 3, monitoring: 2, person: 1, unresolved: 4,
      configuration_scenarios: 5, configuration_tasks: 6, monitoring_provisions: 7,
      samples: {assets: ['Server:1'], configuration_scenarios: ['81:9:Server'], configuration_tasks: ['81:Server:1'], monitoring_provisions: ['71:Server:1']},
    },
  })
  assert.equal(preview.confirmation_phrase, '切换 81 到 92')
  assert.deepEqual(preview.impact, {
    assets: 12, asset_counts: {Server: 8}, admissions: 3, monitoring: 2, person: 1, unresolved: 4,
    configuration_scenarios: 5, configuration_tasks: 6, monitoring_provisions: 7,
    samples: {assets: ['Server:1'], configuration_scenarios: ['81:9:Server'], configuration_tasks: ['81:Server:1'], monitoring_provisions: ['71:Server:1']},
  })
  const page = source('src/pages/cmdb/index.vue')
  for (const marker of [
    "{key: 'person', code: 'PER'", 'Number(impact.person)',
    "{key: 'configuration_scenarios', code: 'SCN'", 'Number(impact.configuration_scenarios)',
    "{key: 'configuration_tasks', code: 'TSK'", 'Number(impact.configuration_tasks)',
    'cmdb-mapping-impact-${item.key}', 'cmdb-mapping-impact-${item.key}-samples',
    'archived_configuration_scenarios', 'archived_configuration_tasks',
  ]) assert.ok(page.includes(marker), `mapping impact UI lost exact field: ${marker}`)
  assert.doesNotMatch(page, /Number\(impact\.people\)/)
  assert.match(page, /监控场景与配置任务/)
  assert.match(mappingTransitionReasonMessage('mapping_context_stale'), /旧预览或旧表单已失效/)
  assert.match(mappingTransitionReasonMessage('organization_assigned'), /其他租户占用/)
})

test('mapping governance detects cross-session identity changes and scopes workspace invalidation to the current tenant', () => {
  const mapping = {tenant_id: 7, itop_organization_id: 81, generation: 4}
  const current = {current_organization: {id: 81}, generation: 4}
  assert.equal(mappingPreviewContextChanged(mapping, current), false)
  assert.equal(mappingPreviewContextChanged(mapping, {...current, current_organization: {id: 82}}), true)
  assert.equal(mappingPreviewContextChanged(mapping, {...current, generation: 5}), true)
  assert.equal(mappingPreviewContextChanged(mapping, {current_organization: {id: 81}}), true)

  for (const reason of ['mapping_context_stale', 'mapping_generation_mismatch', 'mapping_transition_in_progress']) {
    assert.equal(mappingFailureInvalidatesContext(reason), true, `${reason} must invalidate the mapping context`)
  }
  for (const reason of ['mapping_preview_stale', 'mapping_confirmation_invalid', 'mapping_idempotency_conflict']) {
    assert.equal(mappingFailureInvalidatesContext(reason), false, `${reason} must not clear an unrelated CMDB workspace`)
  }
  assert.equal(governanceTenantIsCurrent(7, '7'), true)
  assert.equal(governanceTenantIsCurrent(8, 7), false)
  assert.equal(governanceTenantIsCurrent(0, 0), false)

  const page = source('src/pages/cmdb/index.vue')
  assert.match(page, /mappingPreviewContextChanged\(mapping, preview\)[\s\S]*recoverMappingGovernanceContext\(governanceTenantID/)
  assert.match(page, /mappingFailureInvalidatesContext\(failure\.reason\)[\s\S]*recoverMappingGovernanceContext\(governanceTenantID/)
  assert.match(page, /const affectsCurrentTenant = governanceTenantIsCurrent\(targetTenantID, this\.currentTenantID\)/)
  assert.match(page, /if \(affectsCurrentTenant\) \{[\s\S]*this\.invalidateCMDBContext\(/)
  assert.match(page, /affectsCurrentTenant \? this\.loadOverviewAndAssets\(\) : Promise\.resolve\(\)/)
  assert.match(page, /this\.loadMappingGovernance\(targetTenantID\)/)
})

test('CMDB pages invalidate old tenant and mapping generations before accepting responses or writes', () => {
  const page = source('src/pages/cmdb/index.vue')
  const request = source('src/utils/request.js')
  assert.match(request, /smartops:tenant-context-changing/)
  assert.match(request, /notifyTenantContextChanging\(normalized\)[\s\S]*localStorage\.setItem/, 'old forms must be notified before the stored tenant changes')
  assert.match(page, /activeCMDBContextKey/)
  assert.match(page, /contextKey !== this\.activeCMDBContextKey/)
  assert.match(page, /referencesContextKey === contextKey/)
  assert.match(page, /resetCMDBWorkspaces\(\)[\s\S]*assetFormVisible = false[\s\S]*admissionVisible = false[\s\S]*monitoringBindingVisible = false/)
  assert.match(page, /mapping_transition_in_progress[\s\S]*resetCMDBWorkspaces\(\)/)
  assert.match(page, /writeContext\(\)[\s\S]*organization_id:[\s\S]*generation:/)
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
