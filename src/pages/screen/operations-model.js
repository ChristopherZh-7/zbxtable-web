// Shared module identities, layout and calculations. No sample monitoring values.
const OPERATIONS_TYPES = Object.freeze([
  {value: 'ops-hosts', label: '主机类型分布', icon: 'pie-chart'},
  {value: 'ops-kpi', label: '运维指标卡', icon: 'dashboard'},
  {value: 'ops-egress', label: '出口流量', icon: 'line-chart'},
  {value: 'ops-severity', label: '告警分级', icon: 'radar-chart'},
  {value: 'ops-linux', label: 'Linux 资源排行', icon: 'bar-chart'},
  {value: 'ops-alerts', label: '实时告警动态', icon: 'table'},
  {value: 'ops-windows', label: 'Windows 资源排行', icon: 'bar-chart'},
])
const isOperationsType = type => OPERATIONS_TYPES.some(item => item.value === type)
function operationsKpi(info = {}, triggers = []) {
  const counts = Array.isArray(info.asset_type_counts) ? info.asset_type_counts : []
  const total = counts.length ? counts.reduce((sum, item) => sum + (Number(item && item.count) || 0), 0)
    : ['net_count', 'srv_count', 'win_count', 'lin_count'].reduce((sum, key) => sum + (Number(info[key]) || 0), 0)
  const alarms = triggers.length
  const critical = triggers.filter(t => Number(t && t.severity) >= 4).length
  const online = resourcePercentage(info.online_rate)
  return {total, alarms, critical, online}
}
const OPERATIONS_PRESET = Object.freeze({
  key: 'operations-screen', label: '运维大屏原版', description: '与运维大屏共用真实模块，自动读取当前租户数据', width: 1920, height: 1080,
  nodes: [
    {chart_type: 'ops-hosts', title: '主机类型分布', position: {x: 18, y: 94}, size: {width: 414, height: 479}},
    {chart_type: 'ops-kpi', title: '运维指标', position: {x: 446, y: 94}, size: {width: 1028, height: 201}},
    {chart_type: 'ops-egress', title: '出入口流量监测', position: {x: 446, y: 309}, size: {width: 1028, height: 264}},
    {chart_type: 'ops-severity', title: '告警分级统计', position: {x: 1488, y: 94}, size: {width: 414, height: 479}},
    {chart_type: 'ops-linux', title: 'Linux CPU 排行', position: {x: 18, y: 587}, size: {width: 414, height: 479}},
    {chart_type: 'ops-alerts', title: '实时告警动态', position: {x: 446, y: 587}, size: {width: 1028, height: 479}},
    {chart_type: 'ops-windows', title: 'Windows 内存 排行', position: {x: 1488, y: 587}, size: {width: 414, height: 479}},
  ],
})
function resourcePercentage(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

function resourceTopEmptyLabel(type, metric, payload = {}) {
  const rows = metric === 'mem' ? payload.mem : payload.cpu
  if (Array.isArray(rows) && rows.some(row => row && resourcePercentage(row[metric]) !== null)) return ''
  const platform = type === 'ops-windows' ? 'Windows' : 'Linux'
  if (payload.host_count === 0) return `当前租户暂无 ${platform} 主机`
  const name = metric === 'mem' ? '内存' : 'CPU'
  return `暂无有效的 ${platform} ${name} 采样，请检查监控启用状态和采集情况`
}

module.exports = {resourcePercentage, resourceTopEmptyLabel, OPERATIONS_TYPES, OPERATIONS_PRESET, isOperationsType, operationsKpi}
