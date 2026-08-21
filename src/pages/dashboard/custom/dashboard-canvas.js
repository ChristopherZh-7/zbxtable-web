const CHART_TYPES = Object.freeze([
  {value: 'line', label: '折线图', icon: 'line-chart'},
  {value: 'bar', label: '柱状图', icon: 'bar-chart'},
  {value: 'pie', label: '饼图', icon: 'pie-chart'},
  {value: 'gauge', label: '仪表盘', icon: 'dashboard'},
])

const CHART_LABELS = CHART_TYPES.reduce((result, item) => {
  result[item.value] = item.label
  return result
}, {})

function defaultNodeData(chartType) {
  return {
    chart_type: chartType,
    title: CHART_LABELS[chartType] || '未命名图表',
    data_source: {
      zid: 0,
      hostid: '',
      host_name: '',
      itemid: '',
      item_name: '',
      history: '',
      units: '',
    },
    series: [],
  }
}

function normalizeSeries(series) {
  return (Array.isArray(series) ? series : []).map((point) => ({
    clock: String(point && point.clock || ''),
    value: Number(point && point.value || 0),
  })).filter((point) => point.clock)
}

function chartOption(data) {
  const source = data && data.data_source || {}
  const series = normalizeSeries(data && data.series)
  const values = series.map((point) => point.value)
  const labels = series.map((point) => {
    const stamp = Number(point.clock) * 1000
    return Number.isFinite(stamp) ? new Date(stamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : point.clock
  })
  const latest = values.length ? values[values.length - 1] : 0
  const units = source.units || ''
  const common = {
    animation: false,
    textStyle: {fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'},
    tooltip: {trigger: data.chart_type === 'pie' ? 'item' : 'axis'},
  }
  if (data.chart_type === 'gauge') {
    const max = units === '%' ? 100 : Math.max(100, Math.ceil(latest * 1.2))
    return {...common, series: [{type: 'gauge', min: 0, max, detail: {formatter: `{value}${units}`}, data: [{value: latest, name: source.item_name || ''}]}]}
  }
  if (data.chart_type === 'pie') {
    const max = units === '%' ? 100 : Math.max(latest, 1)
    return {...common, series: [{type: 'pie', radius: ['38%', '68%'], data: [
      {name: source.item_name || '最新值', value: latest},
      {name: '剩余', value: Math.max(0, max - latest), itemStyle: {color: '#e8edf5'}},
    ], label: {formatter: `{b}\n{c}${units}`}}]}
  }
  return {
    ...common,
    grid: {left: 52, right: 18, top: 20, bottom: 38},
    xAxis: {type: 'category', data: labels, axisLabel: {fontSize: 10}},
    yAxis: {type: 'value', name: units, axisLabel: {fontSize: 10}},
    series: [{type: data.chart_type === 'bar' ? 'bar' : 'line', data: values, smooth: data.chart_type === 'line', areaStyle: data.chart_type === 'line' ? {opacity: 0.12} : undefined}],
  }
}

function registerDashboardChartNode(Graph, echarts) {
  Graph.registerNode('dashboard-chart', {
    inherit: 'html',
    width: 360,
    height: 240,
    html(node) {
      const data = node.getData() || defaultNodeData('line')
      const wrap = document.createElement('div')
      wrap.className = 'dashboard-chart-node'
      const header = document.createElement('div')
      header.className = 'dashboard-chart-node__header'
      const title = document.createElement('strong')
      title.textContent = data.title || CHART_LABELS[data.chart_type] || '未命名图表'
      const source = document.createElement('span')
      source.textContent = data.data_source && data.data_source.item_name || '待绑定监控项'
      header.appendChild(title)
      header.appendChild(source)
      const plot = document.createElement('div')
      plot.className = 'dashboard-chart-node__plot'
      wrap.appendChild(header)
      wrap.appendChild(plot)
      const render = () => {
        if (!plot.isConnected) return
        const chart = echarts.init(plot)
        chart.setOption(chartOption(data), true)
      }
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(render)
      else setTimeout(render, 0)
      return wrap
    },
  }, true)
}

function nodeJSON(node) {
  return node && typeof node.toJSON === 'function' ? node.toJSON() : node || {}
}

function normalizeDashboardNodes(nodes) {
  return (Array.isArray(nodes) ? nodes : []).map((candidate) => {
    const node = nodeJSON(candidate)
    const data = node.data || {}
    const source = data.data_source || {}
    const position = node.position || {x: node.x || 0, y: node.y || 0}
    const size = node.size || {width: node.width || 360, height: node.height || 240}
    return {
      id: String(node.id || ''),
      shape: 'dashboard-chart',
      position: {x: Number(position.x || 0), y: Number(position.y || 0)},
      size: {width: Number(size.width || 360), height: Number(size.height || 240)},
      data: {
        chart_type: String(data.chart_type || ''),
        title: String(data.title || '').trim(),
        data_source: {
          zid: Number(source.zid || 0),
          hostid: String(source.hostid || ''),
          host_name: String(source.host_name || ''),
          itemid: String(source.itemid || ''),
          item_name: String(source.item_name || ''),
          history: String(source.history || ''),
          units: String(source.units || ''),
        },
      },
    }
  })
}

function validateDashboardNodes(nodes) {
  const normalized = normalizeDashboardNodes(nodes)
  if (!normalized.length) return '请至少添加一个图表'
  if (normalized.length > 50) return '图表数量不能超过 50 个'
  for (const node of normalized) {
    if (!CHART_LABELS[node.data.chart_type]) return '存在不支持的图表类型'
    if (!node.data.title) return '请填写图表标题'
    const source = node.data.data_source
    if (!source.zid || !source.hostid || !source.itemid || !['0', '3'].includes(source.history)) {
      return `请为「${node.data.title}」绑定数值监控项`
    }
  }
  return ''
}

module.exports = {
  CHART_TYPES,
  chartOption,
  defaultNodeData,
  normalizeDashboardNodes,
  registerDashboardChartNode,
  validateDashboardNodes,
}
