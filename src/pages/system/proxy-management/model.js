const EMPTY_SUMMARY = Object.freeze({
  instance_count: 0,
  available_instance_count: 0,
  group_count: 0,
  proxy_count: 0,
  online_proxy_count: 0,
  offline_proxy_count: 0,
})

function emptySnapshot() {
  return {generated_at: '', summary: {...EMPTY_SUMMARY}, instances: []}
}

function normalizeSnapshot(value) {
  const snapshot = value && typeof value === 'object' ? value : {}
  return {
    generated_at: snapshot.generated_at || '',
    summary: {...EMPTY_SUMMARY, ...(snapshot.summary || {})},
    instances: Array.isArray(snapshot.instances) ? snapshot.instances.map((instance) => ({
      ...instance,
      warnings: Array.isArray(instance.warnings) ? instance.warnings : [],
      groups: Array.isArray(instance.groups) ? instance.groups : [],
      proxies: Array.isArray(instance.proxies) ? instance.proxies : [],
    })) : [],
  }
}

function readBusinessSnapshot(response) {
  const business = response && response.data && response.data.code !== undefined ? response.data : response
  if (!business || Number(business.code) !== 200) {
    throw new Error((business && business.message) || '加载代理管理数据失败')
  }
  return normalizeSnapshot(business.data)
}

function flattenGroups(snapshot) {
  return normalizeSnapshot(snapshot).instances.flatMap((instance) => instance.groups.map((group) => ({
    ...group,
    zid: instance.zid,
    instance: instance.instance,
    instance_name: instance.name,
  })))
}

function flattenProxies(snapshot) {
  return normalizeSnapshot(snapshot).instances.flatMap((instance) => instance.proxies.map((proxy) => ({
    ...proxy,
    zid: instance.zid,
    instance: instance.instance,
    instance_name: instance.name,
  })))
}

function matchesKeyword(record, keyword) {
  const target = String(keyword || '').trim().toLowerCase()
  if (!target) return true
  return [record.name, record.instance, record.instance_name, record.proxy_group_name]
    .some((value) => String(value || '').toLowerCase().includes(target))
}

function filterProxyRows(rows, filters) {
  const values = filters || {}
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (values.zid && Number(row.zid) !== Number(values.zid)) return false
    if (values.proxy_group_key && `${row.zid}:${row.proxy_groupid}` !== values.proxy_group_key) return false
    if (values.state && row.state_name !== values.state) return false
    return matchesKeyword(row, values.keyword)
  })
}

function filterGroupRows(rows, filters) {
  const values = filters || {}
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (values.zid && Number(row.zid) !== Number(values.zid)) return false
    if (values.proxy_group_key && `${row.zid}:${row.proxy_groupid}` !== values.proxy_group_key) return false
    if (values.state && row.state_name !== values.state) return false
    return matchesKeyword(row, values.keyword)
  })
}

function formatDeviation(value) {
  const number = Number(value || 0)
  if (Math.abs(number) < 0.005) return '0'
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}`
}

module.exports = {
  EMPTY_SUMMARY,
  emptySnapshot,
  filterGroupRows,
  filterProxyRows,
  flattenGroups,
  flattenProxies,
  formatDeviation,
  normalizeSnapshot,
  readBusinessSnapshot,
}
