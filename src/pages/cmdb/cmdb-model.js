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
  healthy: {status: 'success', label: '关联正常', tone: 'healthy'},
  identity_drift: {status: 'warning', label: '身份信息有差异', tone: 'warning'},
  active_ci_host_disabled: {status: 'warning', label: '监控已停用', tone: 'warning'},
  retired_ci_host_enabled: {status: 'warning', label: '退役后仍在监控', tone: 'warning'},
  host_missing: {status: 'error', label: '主机不存在', tone: 'error'},
  host_out_of_scope: {status: 'error', label: '主机已越界', tone: 'error'},
}

const ADMISSION_STATE_META = {
  ready: {status: 'processing', label: '待人工审核', tone: 'ready', step: 1},
  binding_pending: {status: 'warning', label: '监控待关联', tone: 'pending', step: 2},
  completed: {status: 'success', label: '闭环完成', tone: 'completed', step: 3},
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
    .map(([key, label]) => ({key, label, value: displayValue(asset[key])}))
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
  mappingForTenant,
  monitoringHostStatusLabel,
  monitoringStateMeta,
  candidateMatchLabel,
  relationBuckets,
  statusOptions,
  statusMeta,
  validateAssetForm,
}
