import * as echarts from 'echarts'

const CHILDREN = [
  'v-tooltip', 'v-axis', 'v-legend', 'v-line', 'v-point', 'v-bar',
  'v-interval', 'v-pie', 'v-coord', 'v-guide', 'v-series',
  'v-stack-area', 'v-smooth-area'
]

function vnodeTag(node) {
  return node && node.componentOptions && node.componentOptions.tag || ''
}

function vnodeProps(node) {
  if (!node) return {}
  if (node.componentOptions && node.componentOptions.propsData) return node.componentOptions.propsData
  return node.data && node.data.attrs || {}
}

function descendants(nodes, result) {
  ;(nodes || []).forEach((node) => {
    if (!node) return
    const tag = vnodeTag(node)
    if (tag) result.push({tag, props: vnodeProps(node)})
    const children = node.componentOptions && node.componentOptions.children || node.children
    if (children) descendants(children, result)
  })
  return result
}

function fields(position) {
  return String(position || '').split('*').filter(Boolean)
}

function scaleFor(scales, key) {
  return (Array.isArray(scales) ? scales : []).find((item) => item && item.dataKey === key) || {}
}

function formatterFor(scales, key) {
  const scale = scaleFor(scales, key)
  if (typeof scale.formatter === 'function') return scale.formatter
  if (scale.formatter === '.0%') return (value) => `${Math.round(Number(value || 0) * 100)}%`
  return undefined
}

function cartesianOption(data, scales, geometry, axes, coord) {
  const pair = fields(geometry.props.position)
  const xKey = pair[0] || Object.keys(data[0] || {})[0]
  const yKey = pair[1] || Object.keys(data[0] || {})[1]
  const horizontal = geometry.tag === 'v-bar' || geometry.tag === 'v-interval'
    ? Boolean(coord && /L[TB]/.test(coord.props.direction || ''))
    : false
  const categories = data.map((item) => item[xKey])
  const colorField = typeof geometry.props.color === 'string' && data.some((item) => item[geometry.props.color] !== undefined)
    ? geometry.props.color
    : ''
  const groups = colorField ? Array.from(new Set(data.map((item) => item[colorField]))) : ['']
  const type = geometry.tag === 'v-bar' || geometry.tag === 'v-interval' ? 'bar' : 'line'
  const series = groups.map((group) => ({
    name: group,
    type,
    smooth: geometry.tag === 'v-smooth-area',
    stack: geometry.props.adjust === 'stack' || geometry.tag === 'v-stack-area' ? 'total' : undefined,
    areaStyle: geometry.tag === 'v-stack-area' || geometry.tag === 'v-smooth-area' ? {} : undefined,
    symbolSize: Number(geometry.props.size || 3),
    itemStyle: !colorField && typeof geometry.props.color === 'string' ? {color: geometry.props.color} : undefined,
    data: categories.map((category) => {
      const row = data.find((item) => item[xKey] === category && (!colorField || item[colorField] === group))
      return row ? Number(row[yKey]) || 0 : null
    })
  }))
  const xFormatter = formatterFor(scales, xKey)
  const yFormatter = formatterFor(scales, yKey)
  const axisByKey = (key) => axes.find((axis) => axis.props.dataKey === key) || {props: {}}
  const axisLabel = (axis, fallback) => ({
    formatter: axis.props.label && axis.props.label.formatter || fallback,
    color: axis.props.label && axis.props.label.textStyle && axis.props.label.textStyle.fill
  })
  const categoryAxis = {type: 'category', data: categories, axisLabel: axisLabel(axisByKey(xKey), xFormatter)}
  const valueScale = scaleFor(scales, yKey)
  const valueAxis = {
    type: 'value',
    min: valueScale.min,
    max: valueScale.max,
    name: valueScale.alias || valueScale.title,
    axisLabel: axisLabel(axisByKey(yKey), yFormatter)
  }
  return {
    tooltip: {trigger: 'axis'},
    legend: colorField ? {} : undefined,
    grid: {containLabel: true, left: 20, right: 20, top: 20, bottom: 20},
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series
  }
}

function pieOption(data, geometry, guide) {
  const valueKey = fields(geometry.props.position)[0] || 'percent'
  const color = geometry.props.color
  const nameKey = Array.isArray(color) ? color[0] : typeof color === 'string' && color !== 'item' ? color : 'item'
  const colors = Array.isArray(color) && Array.isArray(color[1]) ? color[1] : undefined
  return {
    color: colors,
    tooltip: {trigger: 'item', formatter: '{b}: {d}%'},
    legend: {type: 'scroll', orient: 'vertical', left: 0},
    title: guide && guide.props.type === 'text' ? {
      text: String(guide.props.content || ''), left: 'center', top: 'middle',
      textStyle: {fontSize: 12, color: guide.props.vStyle && guide.props.vStyle.fill}
    } : undefined,
    series: [{
      type: 'pie',
      radius: guide ? ['58%', '82%'] : ['0%', '72%'],
      center: ['55%', '50%'],
      data: data.map((item) => ({name: item[nameKey], value: Number(item[valueKey]) || 0})),
      label: {formatter: '{b}: {d}%'}
    }]
  }
}

function gaugeOption(data, scales, geometry) {
  const value = Number(data[0] && data[0].value || 0)
  const scale = scaleFor(scales, 'value')
  return {
    series: [{
      type: 'gauge', min: scale.min || 0, max: scale.max || 100,
      itemStyle: {color: geometry.props.color},
      detail: {formatter: '{value}'}, data: [{value}]
    }]
  }
}

function radarOption(data, scales, geometry) {
  const pair = fields(geometry.props.position)
  const itemKey = pair[0] || 'item'
  const valueKey = pair[1] || 'score'
  const groupKey = geometry.props.color || 'user'
  const categories = Array.from(new Set(data.map((item) => item[itemKey])))
  const groups = Array.from(new Set(data.map((item) => item[groupKey])))
  const scale = scaleFor(scales, valueKey)
  return {
    tooltip: {}, legend: {data: groups},
    radar: {indicator: categories.map((name) => ({name, max: scale.max || 100}))},
    series: [{type: 'radar', data: groups.map((group) => ({
      name: group,
      value: categories.map((category) => Number((data.find((item) => item[itemKey] === category && item[groupKey] === group) || {})[valueKey]) || 0)
    }))}]
  }
}

function buildOption(data, scales, slotNodes) {
  const nodes = descendants(slotNodes, [])
  const coord = nodes.find((item) => item.tag === 'v-coord')
  const geometry = nodes.find((item) => ['v-line', 'v-bar', 'v-interval', 'v-pie', 'v-series', 'v-stack-area', 'v-smooth-area'].includes(item.tag))
  const axes = nodes.filter((item) => item.tag === 'v-axis')
  const guide = nodes.find((item) => item.tag === 'v-guide')
  if (!geometry) return {series: []}
  if (coord && coord.props.type === 'theta' || geometry.tag === 'v-pie') return pieOption(data, geometry, guide)
  if (geometry.tag === 'v-series') return gaugeOption(data, scales, geometry)
  if (coord && coord.props.type === 'polar') return radarOption(data, scales, geometry)
  return cartesianOption(data, scales, geometry, axes, coord)
}

const LegacyChart = {
  name: 'LegacyChart',
  props: {
    data: {type: [Array, Object, String], default: () => []},
    scale: {type: [Array, Object], default: () => []},
    height: {type: [Number, String], default: 300},
    forceFit: {type: Boolean, default: true}
  },
  render(h) {
    return h('div', {style: {width: '100%', height: `${Number(this.height) || 300}px`}})
  },
  mounted() {
    this.chart = echarts.init(this.$el)
    this.renderChart()
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.chart && this.chart.resize())
      this.resizeObserver.observe(this.$el)
    }
  },
  updated() { this.renderChart() },
  beforeDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect()
    if (this.chart) this.chart.dispose()
  },
  watch: {
    data: {deep: true, handler() { this.$nextTick(this.renderChart) }},
    scale: {deep: true, handler() { this.$nextTick(this.renderChart) }}
  },
  methods: {
    renderChart() {
      if (!this.chart) return
      const rows = Array.isArray(this.data) ? this.data : []
      this.chart.setOption(buildOption(rows, this.scale, this.$slots.default), true)
    }
  }
}

const Stub = (name) => ({name, render: () => null})

export default {
  install(Vue) {
    Vue.component('v-chart', LegacyChart)
    CHILDREN.forEach((name) => Vue.component(name, Stub(name)))
  }
}

export {buildOption}
