const {previewGraphic, darkBackground} = require('./component-preview')
const {OPERATIONS_TYPES, isOperationsType} = require('../../screen/operations-model')
const {SCREEN_FONT, screenTooltip, screenAxis, screenLineStyle, screenGradient, screenPieStyle, screenValueScale, formatScreenValue} = require('../../screen/chart-theme')

const CHART_TYPES = Object.freeze([
  {value: 'line', label: '折线图', icon: 'line-chart'},
  {value: 'bar', label: '柱状图', icon: 'bar-chart'},
  {value: 'pie', label: '饼图', icon: 'pie-chart'},
  {value: 'gauge', label: '仪表盘', icon: 'dashboard'},
  {value: 'table', label: '表格', icon: 'table'},
  {value: 'topology', label: '拓扑', icon: 'share-alt'},
])

const CHART_LABELS = [...CHART_TYPES, ...OPERATIONS_TYPES].reduce((result, item) => {
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

function emptyMessage(data) {
  if (data.loadState === 'loading') return ['正在加载数据', '请稍候']
  if (data.loadState === 'error') return ['数据加载失败', '请检查数据源并刷新重试']
  if (normalizeSeries(data.series).length) return null
  const source = data.data_source || {}
  // Public projections deliberately omit internal source identifiers.
  if (!source.itemid && !source.item_name) return ['待绑定数据源', '在组件配置中选择主机和数值监控项']
  return ['暂无采样数据', '最近 24 小时没有可展示的数据']
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
  const dark = darkBackground(style.background)
  const textColor = dark ? '#cfe8ff' : '#455468'
  const formatValue = (value) => dark ? formatScreenValue(value, units, style.precision) : formatDashboardValue(value, data)
  const scale = screenValueScale(units, Math.max(0, ...values.map(Math.abs)))
  const axisValue = value => String(Number((Number(value) / scale.divisor).toFixed(2)))
  const common = {
    animation: false,
    color: [color],
    backgroundColor: dark ? 'transparent' : style.background || '#ffffff',
    textStyle: {fontFamily: dark ? SCREEN_FONT : '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', color: textColor},
    tooltip: dark ? {...screenTooltip(['pie', 'gauge'].includes(data.chart_type) ? 'item' : 'axis'), renderMode: 'richText', valueFormatter: formatValue}
      : {trigger: data.chart_type === 'pie' ? 'item' : 'axis'},
  }
  if (data.chart_type === 'gauge') {
    let max = units === '%' ? 100 : Math.max(100, Math.ceil(latest * 1.2))
    if (dark && scale.divisor > 1) max = Math.ceil(max / scale.divisor / 5) * 5 * scale.divisor
    return {...common, series: [{type: 'gauge', min: 0, max, axisLabel: {color: textColor},
      ...(dark ? {radius: '84%', center: ['50%', '48%'], splitNumber: 5,
        axisLabel: {...screenAxis().axisLabel, formatter: axisValue, distance: 16},
        axisLine: {lineStyle: {width: 10, color: [[1, 'rgba(0,230,255,.16)']]}},
        progress: {show: true, width: 10, itemStyle: {color}}, pointer: {itemStyle: {color}},
        axisTick: {lineStyle: {color: 'rgba(207,232,255,.5)'}}, splitLine: {lineStyle: {color: 'rgba(207,232,255,.7)'}},
        title: {show: false}} : {}),
      detail: {color: dark ? color : textColor, ...(dark ? {fontSize: 26, offsetCenter: [0, '65%'], fontFamily: SCREEN_FONT} : {}), formatter: formatValue},
      data: [{value: latest, name: source.item_name || ''}]}]}
  }
  if (data.chart_type === 'pie') {
    const max = units === '%' ? 100 : Math.max(latest, 1)
    return {...common,
      ...(dark ? {legend: {bottom: 4, left: 'center', itemWidth: 10, itemHeight: 10,
        textStyle: {color: 'rgba(207,232,255,0.75)', fontSize: 12},
        formatter: name => name.length > 26 ? name.slice(0, 25) + '…' : name}} : {}),
      series: [{type: 'pie', radius: dark ? ['38%', '62%'] : ['38%', '68%'],
      ...(dark ? {...screenPieStyle(color), center: ['50%', '46%'], avoidLabelOverlap: true,
        labelLayout: {hideOverlap: true}} : {}), data: [
      {name: source.item_name || '最新值', value: latest},
      {name: '剩余', value: Math.max(0, max - latest), itemStyle: {color: dark ? 'rgba(0,230,255,.12)' : '#e8edf5'}},
    ], label: {color: textColor, ...(dark ? {fontSize: 11} : {}),
      formatter: (params) => dark ? formatValue(params.value) : `${params.name}\n${formatValue(params.value)}`}}]}
  }
  return {
    ...common,
    grid: dark ? {left: 12, right: 18, top: 30, bottom: 30, containLabel: true} : {left: 52, right: 18, top: 20, bottom: 38},
    xAxis: {type: 'category', data: labels, axisLabel: {fontSize: 10, color: textColor},
      ...(dark ? {boundaryGap: data.chart_type === 'bar', axisLine: screenAxis().axisLine, axisLabel: screenAxis().axisLabel} : {})},
    yAxis: {type: 'value', name: dark ? scale.units : units, nameTextStyle: {color: textColor}, axisLabel: {fontSize: 10, color: textColor},
      ...(dark ? {...screenAxis(), axisLabel: {...screenAxis().axisLabel, margin: 12, formatter: axisValue}} : {})},
    series: [{name: source.item_name || data.title || '', type: data.chart_type === 'bar' ? 'bar' : 'line', data: values,
      ...(dark ? (data.chart_type === 'bar' ? {barMaxWidth: 20, itemStyle: {color: screenGradient(color, 0.95)}} : screenLineStyle(color))
        : {smooth: data.chart_type === 'line', areaStyle: data.chart_type === 'line' ? {opacity: 0.12} : undefined})}],
  }
}

function formatDashboardValue(value, data) {
  const precision = Number(data && data.style && data.style.precision)
  const digits = Number.isInteger(precision) && precision >= 0 && precision <= 4 ? precision : 2
  return `${Number(value || 0).toFixed(digits)}${data && data.data_source && data.data_source.units || ''}`
}

function displayValue(value, data) {
  return darkBackground(data.style && data.style.background)
    ? formatScreenValue(value, data.data_source && data.data_source.units, data.style.precision)
    : formatDashboardValue(value, data)
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
      value.textContent = displayValue(point.value, data)
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
  value.textContent = displayValue(latest, data)
  metric.appendChild(name)
  metric.appendChild(value)
  topology.appendChild(host)
  topology.appendChild(edge)
  topology.appendChild(metric)
  plot.appendChild(topology)
}

function registerDashboardChartNode(Graph, echarts, operationsRenderer) {
  const charts = new WeakMap()
  const resources = new Set()
  const release = resource => { resource.dispose(); resources.delete(resource) }
  const watched = new WeakSet()
  Graph.registerNode('dashboard-chart', {
    inherit: 'html',
    width: 360,
    height: 240,
    html: {
      shouldComponentUpdate: node => node.hasChanged('data') || node.hasChanged('size'),
      render(node) {
        const previous = charts.get(node)
        const data = node.getData() || defaultNodeData('line')
        if (previous && previous.operationsType === data.chart_type) {
          previous.update()
          return previous.element
        }
        if (previous) { release(previous); charts.delete(node) }
        if (!watched.has(node)) {
          watched.add(node)
          node.once('removed', () => {
            const chart = charts.get(node)
            if (chart) release(chart)
            charts.delete(node)
            watched.delete(node)
          })
        }
        if (isOperationsType(data.chart_type) && operationsRenderer) {
          const resource = operationsRenderer(node)
          resource.operationsType = data.chart_type
          charts.set(node, resource)
          resources.add(resource)
          return resource.element
        }
        const wrap = document.createElement('div')
        const style = data.style || defaultNodeData('line').style
        const dark = darkBackground(style.background)
        wrap.className = dark ? 'dashboard-chart-node dashboard-chart-node--screen screen-panel' : 'dashboard-chart-node'
        if (!dark) wrap.style.background = style.background || '#ffffff'
        wrap.style.color = dark ? '#cfe8ff' : '#455468'
        if (!dark) wrap.style.borderColor = '#dfe5ef'
        wrap.style.setProperty('--dashboard-accent', style.color || '#1677ff')
        if (dark) ['tl', 'tr', 'bl', 'br'].forEach(corner => {
          const ornament = document.createElement('div')
          ornament.className = 'corner corner-' + corner
          wrap.appendChild(ornament)
        })
        const header = document.createElement('div')
        header.className = dark ? 'panel-title' : 'dashboard-chart-node__header'
        const title = document.createElement('strong')
        if (dark) title.className = 'title-text'
        title.textContent = data.title || CHART_LABELS[data.chart_type] || '未命名图表'
        title.title = title.textContent
        const source = document.createElement('span')
        if (dark) source.className = 'title-extra'
        source.textContent = data.data_source && data.data_source.item_name || '待绑定监控项'
        source.title = source.textContent
        source.style.color = dark ? '#85a5bd' : '#8c8c8c'
        header.appendChild(title)
        header.appendChild(source)
        const plot = document.createElement('div')
        plot.className = dark ? 'dashboard-chart-node__plot panel-body' : 'dashboard-chart-node__plot'
        wrap.appendChild(header)
        wrap.appendChild(plot)
        const render = () => {
          if (!plot.isConnected) return
          const message = emptyMessage(data)
          if (message) {
            const empty = document.createElement('div')
            empty.className = 'dashboard-chart-node__empty'
            if (data.preview_enabled) {
              empty.classList.add('dashboard-chart-node__empty--preview')
              const graphic = document.createElement('div')
              graphic.className = 'dashboard-chart-node__preview'
              graphic.style.color = style.color || '#1677ff'
              graphic.innerHTML = previewGraphic(data.chart_type)
              empty.appendChild(graphic)
              const badge = document.createElement('strong')
              badge.textContent = '样式预览 · ' + message[0]
              badge.style.color = dark ? '#85a5bd' : '#66788a'
              empty.appendChild(badge)
              plot.appendChild(empty)
              return
            }
            message.forEach(text => {
              const line = document.createElement('div')
              line.textContent = text
              empty.appendChild(line)
            })
            plot.appendChild(empty)
          } else if (data.chart_type === 'table') {
            renderTable(plot, data)
          } else if (data.chart_type === 'topology') {
            renderTopology(plot, data)
          } else {
            const chart = echarts.init(plot)
            charts.set(node, chart)
            resources.add(chart)
            chart.setOption(chartOption(data), true)
          }
        }
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(render)
        else setTimeout(render, 0)
        return wrap
      },
    },
  }, true)
  return () => { resources.forEach(release) }
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
          ...(isOperationsType(data.chart_type) ? {kind: 'operations', metric: source.metric || 'cpu'} : {}),
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
    if (!isOperationsType(node.data.chart_type) && (!source.zid || !source.hostid || !source.itemid || !['0', '3'].includes(source.history))) {
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
  emptyMessage,
  formatDashboardValue,
  normalizeDashboardNodes,
  registerDashboardChartNode,
  validateDashboardNodes,
}
