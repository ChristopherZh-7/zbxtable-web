const CLASS_META = {
  Server: {label: '物理服务器', icon: 'hdd', color: 'blue'},
  VirtualMachine: {label: '虚拟机', icon: 'cloud-server', color: 'purple'},
  NetworkDevice: {label: '网络设备', icon: 'deployment-unit', color: 'cyan'},
  PC: {label: '终端', icon: 'desktop', color: 'geekblue'},
  Printer: {label: '打印机', icon: 'printer', color: 'orange'},
  ApplicationSolution: {label: '应用系统', icon: 'appstore', color: 'magenta'},
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
  if (['production', 'active', 'implementation'].includes(value)) return {status: 'success', label: status || '在用'}
  if (['obsolete', 'inactive', 'stock'].includes(value)) return {status: 'default', label: status || '已停用'}
  return {status: 'processing', label: status || '未知'}
}

module.exports = {
  CLASS_META,
  assetKey,
  classMeta,
  detailRows,
  displayValue,
  isPlatformAdmin,
  mappingForTenant,
  relationBuckets,
  statusMeta,
}
