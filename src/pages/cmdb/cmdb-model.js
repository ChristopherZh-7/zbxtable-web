const CLASS_META = {
  Server: {label: '物理服务器', icon: 'hdd', color: 'blue'},
  VirtualMachine: {label: '虚拟机', icon: 'cloud-server', color: 'purple'},
  NetworkDevice: {label: '网络设备', icon: 'deployment-unit', color: 'cyan'},
  PC: {label: '终端', icon: 'desktop', color: 'geekblue'},
  Printer: {label: '打印机', icon: 'printer', color: 'orange'},
  ApplicationSolution: {label: '应用系统', icon: 'appstore', color: 'magenta'},
}

const COMMON_FIELDS = [
  {key: 'name', label: '资产名称', kind: 'string', required: true, wide: true},
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

const DETAIL_FIELDS = [
  ['status', '状态'],
  ['organization_name', '所属组织'],
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

function editableFields(assetClass) {
  if (!CLASS_META[assetClass]) return []
  return [...COMMON_FIELDS, ...(CLASS_FIELDS[assetClass] || [])]
}

function createAssetForm(assetClass, asset) {
  const source = asset || {}
  const form = {}
  editableFields(assetClass).forEach((field) => {
    if (field.kind === 'location' || field.kind === 'networkType') {
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
    if (field.kind === 'location' || field.kind === 'networkType') {
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
  if (assetClass === 'NetworkDevice' && !(Number(form && form.networkdevicetype_id) > 0)) return '请选择网络设备类型'
  return ''
}

module.exports = {
  CLASS_META,
  assetKey,
  buildAssetFields,
  classMeta,
  createAssetForm,
  detailRows,
  displayValue,
  editableFields,
  isPlatformAdmin,
  lifecycleMeta,
  mappingForTenant,
  relationBuckets,
  statusOptions,
  statusMeta,
  validateAssetForm,
}
