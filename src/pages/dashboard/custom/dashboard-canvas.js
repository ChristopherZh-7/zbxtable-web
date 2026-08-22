const CHART_TYPES = Object.freeze([
  {value: 'line', label: '折线图', icon: 'line-chart'},
  {value: 'bar', label: '柱状图', icon: 'bar-chart'},
  {value: 'pie', label: '饼图', icon: 'pie-chart'},
  {value: 'gauge', label: '仪表盘', icon: 'dashboard'},
  {value: 'table', label: '表格', icon: 'table'},
  {value: 'topology', label: '拓扑', icon: 'share-alt'},
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
    style: {
      color: '#1677ff',
      background: '#ffffff',
      precision: 2,
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
  const style = data && data.style || {}
  const color = style.color || '#1677ff'
  const common = {
    animation: false,
    color: [color],
    backgroundColor: style.background || '#ffffff',
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

function formatDashboardValue(value, data) {
  const precision = Number(data && data.style && data.style.precision)
  const digits = Number.isInteger(precision) && precision >= 0 && precision <= 4 ? precision : 2
  return `${Number(value || 0).toFixed(digits)}${data && data.data_source && data.data_source.units || ''}`
}

function renderTable(plot, data) {
  const rows = normalizeSeries(data.series).slice(-8).reverse()
  const table = document.createElement('table')
  table.className = 'dashboard-data-table'
  const head = document.createElement('thead')
  head.innerHTML = '<tr><th>时间</th><th>数值</th></tr>'
  table.appendChild(head)
  const body = document.createElement('tbody')
  if (!rows.length) {
    const row = document.createElement('tr')
    const cell = document.createElement('td')
    cell.colSpan = 2
    cell.textContent = '暂无数据'
    row.appendChild(cell)
    body.appendChild(row)
  } else {
    rows.forEach((point) => {
      const row = document.createElement('tr')
      const time = document.createElement('td')
      const value = document.createElement('td')
      const stamp = Number(point.clock) * 1000
      time.textContent = Number.isFinite(stamp) ? new Date(stamp).toLocaleString() : point.clock
      value.textContent = formatDashboardValue(point.value, data)
      row.appendChild(time)
      row.appendChild(value)
      body.appendChild(row)
    })
  }
  table.appendChild(body)
  plot.appendChild(table)
}

function renderTopology(plot, data) {
  const source = data.data_source || {}
  const series = normalizeSeries(data.series)
  const latest = series.length ? series[series.length - 1].value : 0
  const topology = document.createElement('div')
  topology.className = 'dashboard-mini-topology'
  const host = document.createElement('div')
  host.className = 'dashboard-mini-topology__node'
  host.textContent = source.host_name || '未命名主机'
  const edge = document.createElement('div')
  edge.className = 'dashboard-mini-topology__edge'
  edge.textContent = '实时采集 →'
  const metric = document.createElement('div')
  metric.className = 'dashboard-mini-topology__node dashboard-mini-topology__node--metric'
  const name = document.createElement('span')
  name.textContent = source.item_name || '未绑定监控项'
  const value = document.createElement('strong')
  value.textContent = formatDashboardValue(latest, data)
  metric.appendChild(name)
  metric.appendChild(value)
  topology.appendChild(host)
  topology.appendChild(edge)
  topology.appendChild(metric)
  plot.appendChild(topology)
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
      const style = data.style || defaultNodeData('line').style
      wrap.style.background = style.background || '#ffffff'
      wrap.style.setProperty('--dashboard-accent', style.color || '#1677ff')
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
        if (data.chart_type === 'table') {
          renderTable(plot, data)
        } else if (data.chart_type === 'topology') {
          renderTopology(plot, data)
        } else {
          const chart = echarts.init(plot)
          chart.setOption(chartOption(data), true)
        }
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
    const style = data.style || {}
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
        style: {
          color: String(style.color || '#1677ff').toLowerCase(),
          background: String(style.background || '#ffffff').toLowerCase(),
          precision: Number.isInteger(Number(style.precision)) ? Number(style.precision) : 2,
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
    const style = node.data.style
    if (!/^#[0-9a-f]{6}$/.test(style.color) || !/^#[0-9a-f]{6}$/.test(style.background) || style.precision < 0 || style.precision > 4) {
      return `请检查「${node.data.title}」的组件样式`
    }
  }
  return ''
}

module.exports = {
  CHART_TYPES,
  chartOption,
  defaultNodeData,
  formatDashboardValue,
  normalizeDashboardNodes,
  registerDashboardChartNode,
  validateDashboardNodes,
}
