const SEVERITIES = Object.freeze([
  {value: 1, label: '信息', color: 'blue'},
  {value: 2, label: '警告', color: 'orange'},
  {value: 3, label: '一般严重', color: 'gold'},
  {value: 4, label: '严重', color: 'red'},
  {value: 5, label: '灾难', color: 'magenta'},
])

function severityMeta(value) {
  return SEVERITIES.find(item => item.value === Number(value)) || {value: Number(value), label: '未知', color: undefined}
}

function defaultBaselineForm() {
  return {zid: 0, itemid: '', name: '', season_unit: 'd', seasons: 7, deviation: 3, severity: 3, enabled: true}
}

function validateBaselineForm(form) {
  if (!form || String(form.name || '').trim().length < 2) return '请填写 2-100 字的规则名称'
  if (!Number(form.zid) || !/^\d+$/.test(String(form.itemid || ''))) return '请选择当前租户的数值监控项'
  if (!['d', 'w'].includes(form.season_unit)) return '请选择日或周周期'
  if (Number(form.seasons) < 3 || Number(form.seasons) > 30) return '同期样本数必须为 3-30'
  if (Number(form.deviation) < 1 || Number(form.deviation) > 10) return '偏差阈值必须为 1-10'
  if (!SEVERITIES.some(item => item.value === Number(form.severity))) return '请选择有效告警级别'
  return ''
}

function finiteSample(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatDeviation(value) {
  const number = finiteSample(value)
  return number == null ? '无数据（数据不足）' : `${number}σ`
}

function latestBaselinePoint(points) {
  return Array.isArray(points) && points.length ? points[points.length - 1] : null
}

function baselineChartOption(points, units) {
  const values = Array.isArray(points) ? points : []
  return {
    animation: false,
    tooltip: {trigger: 'axis', formatter(params) {
      const first = Array.isArray(params) ? params[0] : params
      const point = values[first && first.dataIndex] || {}
      const clock = finiteSample(point.clock)
      const time = clock == null ? '时间未知' : new Date(clock * 1000).toLocaleString()
      const actual = finiteSample(point.actual)
      const baseline = finiteSample(point.baseline)
      return `${time}<br/>实际值：${actual == null ? '无数据' : actual}<br/>加权基线：${baseline == null ? '无数据' : baseline}<br/>实际偏离度：${formatDeviation(point.deviation)}`
    }},
    legend: {data: ['实际值', '加权基线']},
    grid: {left: 58, right: 20, top: 44, bottom: 44},
    xAxis: {type: 'category', data: values.map(point => new Date(Number(point.clock) * 1000).toLocaleString())},
    yAxis: {type: 'value', name: units || ''},
    series: [
      {name: '实际值', type: 'line', smooth: true, symbol: 'circle', data: values.map(point => finiteSample(point.actual))},
      {name: '加权基线', type: 'line', smooth: true, symbol: 'none', lineStyle: {type: 'dashed'}, data: values.map(point => finiteSample(point.baseline))},
    ],
  }
}

function numericTrendItems(items) {
  return (Array.isArray(items) ? items : []).filter(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    return ['0', '3', 0, 3].includes(item.value_type) &&
      typeof item.trends === 'string' && item.trends.trim() !== '' && item.trends.trim() !== '0' &&
      ['0', 0].includes(item.status) && !['1', 1].includes(item.state)
  })
}

module.exports = {SEVERITIES, baselineChartOption, defaultBaselineForm, formatDeviation, latestBaselinePoint, numericTrendItems, severityMeta, validateBaselineForm}
