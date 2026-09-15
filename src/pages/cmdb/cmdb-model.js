const CLASS_META = {
  Server: {label: '物理服务器', icon: 'hdd', color: 'blue'},
  VirtualMachine: {label: '虚拟机', icon: 'cloud-server', color: 'purple'},
  NetworkDevice: {label: '网络设备', icon: 'deployment-unit', color: 'cyan'},
  PC: {label: '终端', icon: 'desktop', color: 'geekblue'},
  Printer: {label: '打印机', icon: 'printer', color: 'orange'},
  ApplicationSolution: {label: '应用系统', icon: 'appstore', color: 'magenta'},
}

const COMMON_FIELDS = [
  {key: 'name', label: '资产名称', kind: 'string', required: true},
  {key: 'status', label: '生命周期状态', kind: 'status'},
  {key: 'business_criticity', label: '业务关键度', kind: 'criticality'},
  {key: 'move2production', label: '上线日期', kind: 'date'},
  {key: 'description', label: '说明', kind: 'text', wide: true},
]

const CLASS_FIELDS = {
  Server: [
    {key: 'managementip', label: '管理 IP', kind: 'ip'},
    {key: 'location_id', label: '位置', kind: 'location'},
    {key: 'serialnumber', label: '序列号', kind: 'string'},
    {key: 'asset_number', label: '资产编号', kind: 'string'},
    {key: 'cpu', label: 'CPU', kind: 'string'},
    {key: 'ram', label: '内存', kind: 'string'},
    {key: 'purchase_date', label: '采购日期', kind: 'date'},
    {key: 'end_of_warranty', label: '保修到期', kind: 'date'},
  ],
  VirtualMachine: [
    {key: 'managementip', label: '管理 IP', kind: 'ip'},
    {key: 'cpu', label: 'CPU', kind: 'string'},
    {key: 'ram', label: '内存', kind: 'string'},
  ],
  NetworkDevice: [
    {key: 'managementip', label: '管理 IP', kind: 'ip'},
    {key: 'location_id', label: '位置', kind: 'location'},
    {key: 'networkdevicetype_id', label: '网络设备类型', kind: 'networkType', required: true},
    {key: 'serialnumber', label: '序列号', kind: 'string'},
    {key: 'asset_number', label: '资产编号', kind: 'string'},
    {key: 'ram', label: '内存', kind: 'string'},
    {key: 'purchase_date', label: '采购日期', kind: 'date'},
    {key: 'end_of_warranty', label: '保修到期', kind: 'date'},
  ],
  PC: [
    {key: 'location_id', label: '位置', kind: 'location'},
    {key: 'serialnumber', label: '序列号', kind: 'string'},
    {key: 'asset_number', label: '资产编号', kind: 'string'},
    {key: 'cpu', label: 'CPU', kind: 'string'},
    {key: 'ram', label: '内存', kind: 'string'},
    {key: 'purchase_date', label: '采购日期', kind: 'date'},
    {key: 'end_of_warranty', label: '保修到期', kind: 'date'},
  ],
  Printer: [
    {key: 'location_id', label: '位置', kind: 'location'},
    {key: 'serialnumber', label: '序列号', kind: 'string'},
    {key: 'asset_number', label: '资产编号', kind: 'string'},
    {key: 'purchase_date', label: '采购日期', kind: 'date'},
    {key: 'end_of_warranty', label: '保修到期', kind: 'date'},
  ],
  ApplicationSolution: [],
}

const RESPONSIBILITY_FIELDS = [
  {key: 'smartops_operations_team_id', label: '运维团队', kind: 'team', required: true, wide: true},
  {key: 'smartops_primary_owner_id', label: '主负责人', kind: 'person'},
  {key: 'smartops_backup_owner_id', label: '备份负责人', kind: 'person'},
]

const DETAIL_FIELDS = [
  ['status', '状态'],
  ['organization_name', '所属组织'],
  ['smartops_operations_team_name', '运维团队'],
  ['smartops_primary_owner_name', '主负责人'],
  ['smartops_backup_owner_name', '备份负责人'],
  ['managementip', '管理 IP'],
  ['location_name', '位置'],
  ['serialnumber', '序列号'],
  ['asset_number', '资产编号'],
  ['brand_name', '品牌'],
  ['model_name', '型号'],
  ['cpu', 'CPU'],
  ['ram', '内存'],
  ['osfamily_name', '操作系统'],
  ['osversion_name', '系统版本'],
  ['business_criticity', '业务关键度'],
  ['move2production', '上线日期'],
  ['purchase_date', '采购日期'],
  ['end_of_warranty', '保修到期'],
  ['obsolescence_flag', '淘汰标记'],
  ['obsolescence_date', '淘汰日期'],
  ['description', '说明'],
]

const MONITORING_STATE_META = {
  unbound: {status: 'default', label: '未关联', tone: 'neutral'},
  healthy: {status: 'success', label: '绑定对账正常', tone: 'healthy'},
  identity_drift: {status: 'warning', label: '身份信息有差异', tone: 'warning'},
  active_ci_host_disabled: {status: 'warning', label: '监控已停用', tone: 'warning'},
  retired_ci_host_enabled: {status: 'warning', label: '退役后仍在监控', tone: 'warning'},
  host_missing: {status: 'error', label: '主机不存在', tone: 'error'},
  host_out_of_scope: {status: 'error', label: '主机已越界', tone: 'error'},
}

const ADMISSION_STATE_META = {
  ready: {status: 'processing', label: '待人工审核', tone: 'ready', step: 1},
  binding_pending: {status: 'warning', label: '监控待关联', tone: 'pending', step: 2},
  completed: {status: 'success', label: '建档并绑定完成', tone: 'completed', step: 3},
  conflict: {status: 'error', label: '身份冲突', tone: 'conflict', step: 2},
}

const REFERENCE_FIELD_KINDS = new Set(['location', 'networkType', 'team', 'person'])

function classMeta(assetClass) {
  return CLASS_META[assetClass] || {label: assetClass || '未知类型', icon: 'database', color: 'default'}
}

function assetKey(asset) {
  return asset && asset.key ? String(asset.key) : `${asset && asset.class || 'unknown'}:${asset && asset.id || 0}`
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return '—'
  if (value === true || value === 'yes') return '是'
  if (value === false || value === 'no') return '否'
  return String(value)
}

function detailRows(asset) {
  if (!asset) return []
  return DETAIL_FIELDS
    .filter(([key]) => asset[key] !== undefined && asset[key] !== null && asset[key] !== '')
    .map(([key, label]) => ({key, label, value: key === 'status'
      ? statusMeta(asset[key]).label
      : key === 'business_criticity'
        ? ({low: '低', medium: '中', high: '高'}[asset[key]] || displayValue(asset[key]))
        : displayValue(asset[key])}))
}

function relationBuckets(relations, origin) {
  const nodes = relations && Array.isArray(relations.nodes) ? relations.nodes : []
  const edges = relations && Array.isArray(relations.edges) ? relations.edges : []
  const originKey = assetKey(origin)
  const byKey = new Map(nodes.map((node) => [assetKey(node), node]))
  const upstream = []
  const downstream = []
  edges.forEach((edge) => {
    if (edge.to === originKey && byKey.has(edge.from)) upstream.push({...byKey.get(edge.from), relation: edge.relation})
    if (edge.from === originKey && byKey.has(edge.to)) downstream.push({...byKey.get(edge.to), relation: edge.relation})
  })
  return {upstream, downstream}
}

function isPlatformAdmin(user) {
  const role = String(user && user.role || '').toLowerCase()
  return role === 'admin' || role === 'platform_admin'
}

function mappingForTenant(mappings, tenantID) {
  return (Array.isArray(mappings) ? mappings : []).find((item) => Number(item.tenant_id) === Number(tenantID)) || null
}

function mappingPreviewContextChanged(mapping, preview) {
  const source = mapping || {}
  const result = preview || {}
  const current = result.current_organization || {}
  const mappedOrganizationID = Number(source.itop_organization_id || source.organization_id) || 0
  const mappedGeneration = Number(source.generation) || 0
  const previewOrganizationID = Number(current.id || current.organization_id) || 0
  const previewGeneration = Number(result.generation) || 0
  return !mappedOrganizationID || !mappedGeneration || !previewOrganizationID || !previewGeneration
    || mappedOrganizationID !== previewOrganizationID
    || mappedGeneration !== previewGeneration
}

function mappingFailureInvalidatesContext(reason) {
  return [
    'mapping_context_stale',
    'mapping_generation_mismatch',
    'mapping_transition_in_progress',
  ].includes(String(reason || ''))
}

function governanceTenantIsCurrent(governanceTenantID, currentTenantID) {
  const target = Number(governanceTenantID) || 0
  const current = Number(currentTenantID) || 0
  return target > 0 && current > 0 && target === current
}

function normalizedPositiveNumber(...values) {
  const value = values.find((item) => Number(item) > 0)
  return Number(value) > 0 ? Number(value) : 0
}

function normalizeCMDBContext(data, tenantID) {
  const source = data || {}
  const mapping = source.mapping || source.mapping_context || {}
  const organization = source.organization || mapping.organization || {}
  const normalizedTenantID = normalizedPositiveNumber(tenantID, mapping.tenant_id, source.tenant_id)
  const mappedTenantID = normalizedPositiveNumber(mapping.tenant_id, source.tenant_id)
  const organizationID = normalizedPositiveNumber(
    organization.id,
    organization.organization_id,
    mapping.itop_organization_id,
    mapping.organization_id,
    source.organization_id,
  )
  const generation = normalizedPositiveNumber(mapping.generation, source.mapping_generation, source.generation)
  const state = String(mapping.state || source.mapping_state || source.state || '')
  const mappedOrganizationID = normalizedPositiveNumber(mapping.itop_organization_id, mapping.organization_id)
  const identityConsistent = (!mappedTenantID || mappedTenantID === normalizedTenantID)
    && (!mappedOrganizationID || !organizationID || mappedOrganizationID === organizationID)
  const key = normalizedTenantID > 0 && organizationID > 0 && generation > 0
    ? `${normalizedTenantID}:${organizationID}:${generation}`
    : ''
  return {
    tenant_id: normalizedTenantID,
    organization_id: organizationID,
    generation,
    state,
    key,
    ready: Boolean(key) && source.state === 'ready' && state === 'active' && identityConsistent,
  }
}

function normalizedImpactCount(value) {
  if (value && typeof value === 'object') return Math.max(0, Number(value.total || value.count) || 0)
  return Math.max(0, Number(value) || 0)
}

function normalizeMappingTransitionPreview(data) {
  const source = data || {}
  const impact = source.impact || source.impacts || {}
  const count = (...keys) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(impact, key)) return normalizedImpactCount(impact[key])
      if (Object.prototype.hasOwnProperty.call(source, key)) return normalizedImpactCount(source[key])
    }
    return 0
  }
  const current = source.current_organization || source.current || {}
  const target = source.target_organization || source.target || {}
  return {
    ...source,
    current_organization: current,
    target_organization: target,
    generation: normalizedPositiveNumber(source.generation, source.current_generation),
    preview_digest: String(source.preview_digest || source.digest || ''),
    confirmation_phrase: String(source.confirmation_phrase || source.required_confirmation || source.confirmation || ''),
    impact: {
      assets: count('assets', 'asset_count', 'assets_count'),
      asset_counts: impact.asset_counts && typeof impact.asset_counts === 'object' ? impact.asset_counts : {},
      admissions: count('admissions', 'admission_count', 'admissions_count', 'discovery_admissions'),
      monitoring: count('monitoring', 'monitoring_count', 'monitoring_bindings', 'monitoring_binding_count'),
      person: count('person', 'people', 'person_count', 'person_bindings', 'person_binding_count'),
      unresolved: count('unresolved', 'unresolved_count', 'legacy_unresolved'),
      configuration_scenarios: count('configuration_scenarios', 'configuration_scenario_count'),
      configuration_tasks: count('configuration_tasks', 'configuration_task_count'),
      monitoring_provisions: count('monitoring_provisions'),
      samples: impact.samples || source.samples || {},
    },
    samples: source.samples || impact.samples || {},
  }
}

function mappingTransitionReasonMessage(reason, fallback) {
  const messages = {
    mapping_transition_required: '当前租户已绑定配置组织，请通过显式切换流程操作。',
    mapping_context_stale: '映射上下文已变化，旧预览或旧表单已失效，请刷新后重试。',
    mapping_generation_mismatch: '映射版本已变化，旧预览或旧表单已失效，请刷新后重试。',
    cmdb_context_mismatch: 'CMDB 配置组织上下文已变化，当前写入已拒绝。',
    mapping_preview_stale: '预览后影响范围已变化，请重新预览并确认。',
    mapping_transition_in_progress: '该租户的配置组织切换正在执行，请等待完成后刷新。',
    preview_digest_mismatch: '预览摘要已失效，请重新预览。',
    organization_inactive: '目标配置组织不是可绑定状态，请选择活动组织。',
    organization_already_assigned: '目标配置组织已被其他租户占用。',
    organization_assigned: '目标配置组织已被其他租户占用。',
    organization_reserved: '目标配置组织仍为原租户保留，不能绑定给其他租户。',
    confirmation_mismatch: '确认短语不匹配，请按预览结果精确输入。',
    mapping_confirmation_invalid: '确认短语不匹配，请按预览结果精确输入。',
    idempotency_conflict: '幂等键已用于不同请求，请刷新后重试。',
    mapping_idempotency_conflict: '幂等键已用于不同请求，请刷新后重试。',
  }
  return messages[String(reason || '')] || fallback || '请求失败，请刷新后重试。'
}

function statusMeta(status) {
  const value = String(status || '').toLowerCase()
  const labels = {production: '生产', active: '启用', implementation: '实施中', stock: '库存', obsolete: '已退役', inactive: '已停用'}
  if (['production', 'active', 'implementation'].includes(value)) return {status: 'success', label: labels[value]}
  if (['obsolete', 'inactive', 'stock'].includes(value)) return {status: 'default', label: labels[value]}
  return {status: 'processing', label: status || '未知'}
}

function lifecycleMeta(asset) {
  const status = String(asset && asset.status || '').toLowerCase()
  const retired = status === 'obsolete' || status === 'inactive'
  return {retired, action: retired ? 'activate' : 'retire', label: retired ? '重新启用' : '退役'}
}

function statusOptions(assetClass) {
  if (assetClass === 'ApplicationSolution') return [{value: 'active', label: '启用'}]
  return [
    {value: 'stock', label: '库存'},
    {value: 'implementation', label: '实施中'},
    {value: 'production', label: '生产'},
  ]
}

function monitoringStateMeta(reconciliation) {
  const state = String(reconciliation && reconciliation.state || 'unbound')
  return MONITORING_STATE_META[state] || {status: 'processing', label: '状态未知', tone: 'neutral'}
}

function monitoringHostStatusLabel(status) {
  if (status === 'enabled') return '启用'
  if (status === 'disabled') return '停用'
  return '未知'
}

function candidateMatchLabel(candidate) {
  const reasons = candidate && Array.isArray(candidate.match_reasons) ? candidate.match_reasons : []
  if (reasons.length) return reasons.join(' · ')
  return '无自动匹配依据，需人工确认'
}

function admissionStateMeta(candidate) {
  const state = String(candidate && candidate.state || 'ready')
  return ADMISSION_STATE_META[state] || {status: 'default', label: '状态未知', tone: 'neutral', step: 0}
}

function admissionEvidenceLabel(candidate) {
  const classifications = candidate && Array.isArray(candidate.classifications) ? candidate.classifications : []
  if (!classifications.length) return '无可用模板证据'
  return classifications.map((item) => item.template_name || item.product || item.category).filter(Boolean).join(' · ')
}

function editableFields(assetClass) {
  if (!CLASS_META[assetClass]) return []
  return [
    ...COMMON_FIELDS,
    ...(assetClass === 'ApplicationSolution' ? [] : RESPONSIBILITY_FIELDS),
    ...(CLASS_FIELDS[assetClass] || []),
  ]
}

function createAssetForm(assetClass, asset) {
  const source = asset || {}
  const form = {}
  editableFields(assetClass).forEach((field) => {
    if (REFERENCE_FIELD_KINDS.has(field.kind)) {
      const value = Number(source[field.key])
      form[field.key] = value > 0 ? value : undefined
    } else {
      form[field.key] = source[field.key] === undefined || source[field.key] === null ? '' : String(source[field.key])
    }
  })
  if (!asset && !form.status) form.status = assetClass === 'ApplicationSolution' ? 'active' : 'production'
  return form
}

function buildAssetFields(assetClass, form, creating) {
  const fields = {}
  editableFields(assetClass).forEach((field) => {
    const value = form ? form[field.key] : undefined
    if (REFERENCE_FIELD_KINDS.has(field.kind)) {
      if (!creating || value !== undefined && value !== null && value !== '') fields[field.key] = Number(value) || 0
      return
    }
    const normalized = value === undefined || value === null ? '' : String(value).trim()
    if (!creating || normalized !== '' || field.required || field.key === 'status') fields[field.key] = normalized
  })
  return fields
}

function validateAssetForm(assetClass, form) {
  if (!CLASS_META[assetClass]) return '请选择资产类型'
  if (!String(form && form.name || '').trim()) return '请输入资产名称'
  if (assetClass !== 'ApplicationSolution' && !(Number(form && form.smartops_operations_team_id) > 0)) return '请选择运维团队'
  if (assetClass !== 'ApplicationSolution' && String(form && form.status || '') === 'production' && !(Number(form && form.smartops_primary_owner_id) > 0)) return '生产/在用资产必须选择主负责人'
  if (Number(form && form.smartops_primary_owner_id) > 0 && Number(form && form.smartops_primary_owner_id) === Number(form && form.smartops_backup_owner_id)) return '备份负责人不能与主负责人相同'
  if (assetClass === 'NetworkDevice' && !(Number(form && form.networkdevicetype_id) > 0)) return '请选择网络设备类型'
  return ''
}

function createAdmissionForm(candidate) {
  const assetClass = candidate && CLASS_META[candidate.suggested_class] ? candidate.suggested_class : 'Server'
  const form = createAssetForm(assetClass)
  form.name = String(candidate && candidate.host_name || '').trim()
  if (Object.prototype.hasOwnProperty.call(form, 'managementip')) form.managementip = String(candidate && candidate.address || '').trim()
  form.description = admissionEvidenceLabel(candidate)
  return {class: assetClass, fields: form, application_id: undefined}
}

module.exports = {
  CLASS_META,
  assetKey,
  admissionEvidenceLabel,
  admissionStateMeta,
  buildAssetFields,
  classMeta,
  createAssetForm,
  createAdmissionForm,
  detailRows,
  displayValue,
  editableFields,
  isPlatformAdmin,
  lifecycleMeta,
  governanceTenantIsCurrent,
  mappingFailureInvalidatesContext,
  mappingForTenant,
  mappingPreviewContextChanged,
  mappingTransitionReasonMessage,
  monitoringHostStatusLabel,
  monitoringStateMeta,
  normalizeCMDBContext,
  normalizeMappingTransitionPreview,
  candidateMatchLabel,
  relationBuckets,
  statusOptions,
  statusMeta,
  validateAssetForm,
}
