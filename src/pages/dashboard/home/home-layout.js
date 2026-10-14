const HOME_WIDGETS = [
  {type: 'alerts', title: '未恢复告警', icon: 'alert', description: '当前告警、发生时间与主机，沿用主页的中文告警。', columns: 6, rows: 6, widths: [6, 12], heights: [3, 4, 6, 8]},
  {type: 'devices', title: '设备统计', icon: 'appstore', description: '按设备类型查看当前租户的监控设备数量。', columns: 6, rows: 3, widths: [4, 6, 12], heights: [3, 4, 6]},
  {type: 'bandwidth', title: '出口带宽', icon: 'swap', description: '已配置出口的实时流入、流出速率。', columns: 6, rows: 3, widths: [4, 6, 12], heights: [3, 4, 6]},
  {type: 'linux', title: 'Linux 主机排行', icon: 'code', description: '按 CPU 或内存使用率查看 Linux 主机。', columns: 6, rows: 4, widths: [6, 12], heights: [3, 4, 6, 8]},
  {type: 'windows', title: 'Windows 主机排行', icon: 'windows', description: '按 CPU 或内存使用率查看 Windows 主机。', columns: 6, rows: 4, widths: [6, 12], heights: [3, 4, 6, 8]},
  {type: 'summary', title: '统计摘要', icon: 'dashboard', description: '监控设备、未恢复告警、严重告警与出口数量。', columns: 12, rows: 2, widths: [6, 12], heights: [2, 3, 4]},
  {type: 'severity', title: '告警级别分布', icon: 'bar-chart', description: '将当前未恢复告警按级别分组，快速查看重点。', columns: 6, rows: 4, widths: [4, 6, 12], heights: [3, 4, 6]},
  {type: 'shortcuts', title: '快捷入口', icon: 'link', description: '快速进入资产、告警与大屏等有访问权限的页面。', columns: 6, rows: 3, widths: [4, 6, 12], heights: [2, 3, 4]},
]

function widgetDefinition(type) { return HOME_WIDGETS.find(widget => widget.type === type) }
function createHomeWidget(type) {
  const definition = widgetDefinition(type)
  return definition ? {type, columns: definition.columns, rows: definition.rows} : null
}
function defaultHomeLayout() { return HOME_WIDGETS.slice(0, 5).map(widget => createHomeWidget(widget.type)) }
function normalizeHomeLayout(input) {
  if (!Array.isArray(input)) return defaultHomeLayout()
  const seen = new Set()
  return input.slice(0, 64).flatMap(value => {
    const definition = value && widgetDefinition(value.type)
    if (!definition || seen.has(value.type)) return []
    seen.add(value.type)
    return [{type: value.type,
      columns: definition.widths.includes(value.columns) ? value.columns : definition.columns,
      rows: definition.heights.includes(value.rows) ? value.rows : definition.rows}]
  })
}
function moveHomeWidget(input, type, offset) {
  const result = normalizeHomeLayout(input)
  const from = result.findIndex(widget => widget.type === type)
  if (from < 0 || !Number.isInteger(offset)) return result
  const to = Math.max(0, Math.min(result.length - 1, from + offset))
  result.splice(to, 0, result.splice(from, 1)[0])
  return result
}
function homeLayoutKey(store) {
  const getters = (store && store.getters) || {}
  const user = getters['account/user'] || {}, tenant = getters['account/currentTenant'] || {}
  const valid = id => /^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id))
  return valid(user.id) && valid(tenant.id) ? `smartops.home.layout:v1:${user.id}:${tenant.id}` : null
}
function homeStorage(browserWindow) {
  try { return browserWindow.localStorage } catch (_) { return null }
}
function readHomeLayout(storage, key) {
  const fallback = status => ({widgets: defaultHomeLayout(), status, raw: null})
  if (!storage || !key) return fallback('unavailable')
  let raw
  try { raw = storage.getItem(key) || null } catch (_) { return fallback('unavailable') }
  if (!raw) return fallback('default')
  try {
    const value = JSON.parse(raw)
    if (value.version !== 1 || !Array.isArray(value.widgets)) throw Error('invalid layout')
    const widgets = normalizeHomeLayout(value.widgets)
    if (value.widgets.length && !widgets.length) throw Error('unknown widgets')
    return {widgets, status: 'saved', raw}
  } catch (_) { return {...fallback('invalid'), raw} }
}
function saveHomeLayout(storage, key, widgets, expectedRaw) {
  if (!storage || !key) return {ok: false, reason: 'unavailable'}
  try {
    if ((storage.getItem(key) || null) !== expectedRaw) return {ok: false, reason: 'conflict'}
    const raw = JSON.stringify({version: 1, widgets: normalizeHomeLayout(widgets)})
    storage.setItem(key, raw)
    return {ok: true, raw}
  } catch (_) { return {ok: false, reason: 'unavailable'} }
}
function alarmSeverityCounts(alarms) {
  const counts = [0, 0, 0, 0, 0, 0]
  for (const alarm of Array.isArray(alarms) ? alarms : []) {
    if (!alarm) continue
    const severity = Number(alarm.severity)
    counts[Number.isInteger(severity) && severity >= 0 && severity <= 5 ? severity : 0]++
  }
  return counts
}

module.exports = {HOME_WIDGETS, widgetDefinition, createHomeWidget, defaultHomeLayout, normalizeHomeLayout,
  moveHomeWidget, homeLayoutKey, homeStorage, readHomeLayout, saveHomeLayout, alarmSeverityCounts}
