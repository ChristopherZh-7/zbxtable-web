const SEVERITIES = Object.freeze([
  {value: 1, label: '信息', color: 'blue'},
  {value: 2, label: '警告', color: 'orange'},
  {value: 3, label: '一般严重', color: 'gold'},
  {value: 4, label: '严重', color: 'red'},
  {value: 5, label: '灾难', color: 'magenta'},
])

function severityMeta(value) {
  return SEVERITIES.find(item => item.value === Number(value)) || {value: Number(value), label: '未知', color: 'default'}
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

function baselineChartOption(points, units) {
  const values = Array.isArray(points) ? points : []
  return {
    animation: false,
    tooltip: {trigger: 'axis'},
    legend: {data: ['实际值', '加权基线']},
    grid: {left: 58, right: 20, top: 44, bottom: 44},
    xAxis: {type: 'category', data: values.map(point => new Date(Number(point.clock) * 1000).toLocaleString())},
    yAxis: {type: 'value', name: units || ''},
    series: [
      {name: '实际值', type: 'line', smooth: true, symbol: 'circle', data: values.map(point => Number(point.actual))},
      {name: '加权基线', type: 'line', smooth: true, symbol: 'none', lineStyle: {type: 'dashed'}, data: values.map(point => point.baseline == null ? null : Number(point.baseline))},
    ],
  }
}

function numericTrendItems(items) {
  return (Array.isArray(items) ? items : []).filter(item =>
    ['0', '3'].includes(String(item.value_type)) && String(item.trends) !== '0' && String(item.status || '0') === '0')
}

module.exports = {SEVERITIES, baselineChartOption, defaultBaselineForm, numericTrendItems, severityMeta, validateBaselineForm}
