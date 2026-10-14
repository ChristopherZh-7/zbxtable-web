const EMPTY_VALUES = new Set(['', '-', '--', '—', 'n/a', 'null', 'undefined', 'unknown'])

function metricText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  if (typeof value === 'number' && !Number.isFinite(value)) return ''
  const text = String(value).trim()
  return EMPTY_VALUES.has(text.toLowerCase()) ? '' : text
}

function utilization(value) {
  const text = metricText(value)
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(text)) return null
  const number = Number(text.replace('%', '').trim())
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

function utilizationLabel(value) {
  const number = utilization(value)
  if (number === null) return '暂无数据'
  if (number > 0 && number < 0.1) return '<0.1'
  if (number < 100 && number > 99.9) return '>99.9'
  return number.toFixed(1)
}

function uptimeLabel(value) {
  const text = metricText(value)
  if (!text || /^(?:nan|[+-]?infinity)$/i.test(text)) return '暂无数据'
  // Inventory may already contain a formatted duration. Preserve it verbatim.
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return text
  const seconds = Number(text)
  if (!Number.isSafeInteger(Math.floor(seconds)) || seconds < 0) return '暂无数据'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds % 86400 / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  if (days) return `${days}天 ${hours}小时 ${minutes}分钟`
  if (hours) return `${hours}小时 ${minutes}分钟`
  if (minutes) return `${minutes}分钟`
  return `${Math.floor(seconds)}秒`
}

const COLUMN_WIDTHS = {
  name: 180, instance_name: 120, interfaces: 128, os: 190,
  uptime: 152, cpu_utilization: 132, memory_utilization: 132,
  available: 124, ping: 96,
}

function deviceColumnWidth(field) {
  const configured = Number(field.width)
  const minimum = ['uptime', 'cpu_utilization', 'memory_utilization'].includes(field.key)
    ? COLUMN_WIDTHS[field.key] : 96
  return Number.isFinite(configured) && configured > 0
    ? Math.max(minimum, configured)
    : COLUMN_WIDTHS[field.key] || 160
}

module.exports = {metricText, utilization, utilizationLabel, uptimeLabel, deviceColumnWidth}
