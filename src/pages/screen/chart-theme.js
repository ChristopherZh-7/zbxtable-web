// One visual language for built-in operations charts and custom screen charts.
const SCREEN_FONT = "'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif"
const SCREEN_COLORS = Object.freeze(['#00e6ff', '#1f7bff', '#7c3cff', '#ff9248', '#19d27c', '#ffd166', '#ef476f', '#8d99ae'])

function screenTooltip(trigger = 'item') {
  return {trigger, backgroundColor: 'rgba(2,6,13,0.85)', borderColor: 'rgba(0,230,255,0.4)', textStyle: {color: '#cfe8ff'}}
}

function screenAxis() {
  return {
    axisLine: {lineStyle: {color: 'rgba(0,230,255,0.3)'}},
    axisLabel: {color: 'rgba(207,232,255,0.6)', fontSize: 11},
    splitLine: {lineStyle: {color: 'rgba(0,230,255,.08)'}},
  }
}

function colorAlpha(color, alpha) {
  const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color : SCREEN_COLORS[0]
  return `rgba(${[1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(',')},${alpha})`
}

function screenGradient(color, opacity = 0.55) {
  return {type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
    {offset: 0, color: colorAlpha(color, opacity)},
    {offset: 1, color: colorAlpha(color, 0.02)},
  ]}
}

function screenLineStyle(color = SCREEN_COLORS[0], opacity = 0.55) {
  return {smooth: true, showSymbol: false, lineStyle: {color, width: 2}, itemStyle: {color}, areaStyle: {color: screenGradient(color, opacity)}}
}

function screenPieStyle(color = SCREEN_COLORS[0]) {
  return {
    itemStyle: {borderColor: 'rgba(2,6,13,0.85)', borderWidth: 2, shadowBlur: 14, shadowColor: colorAlpha(color, 0.45)},
    labelLine: {lineStyle: {color: colorAlpha(color, 0.4)}},
  }
}

// Convert labels only. ECharts series, alarm thresholds and saved data stay raw.
function screenValueScale(units, magnitude) {
  if (!['B', 'Bps', 'B/s'].includes(units)) return {divisor: 1, units: units || ''}
  const names = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let index = 0
  while (Math.abs(Number(magnitude)) >= 1024 ** (index + 1) && index < names.length - 1) index++
  return {divisor: 1024 ** index, units: names[index] + (units === 'B' ? '' : '/s')}
}

function formatScreenValue(value, units, precision = 2) {
  const digits = Number.isInteger(Number(precision)) && Number(precision) >= 0 && Number(precision) <= 4 ? Number(precision) : 2
  const scale = screenValueScale(units, value)
  const suffix = scale.units && ['B', 'Bps', 'B/s'].includes(units) ? ' ' + scale.units : scale.units
  return (Number(value || 0) / scale.divisor).toFixed(digits) + suffix
}

module.exports = {SCREEN_FONT, SCREEN_COLORS, screenTooltip, screenAxis, screenLineStyle, screenGradient, screenPieStyle, screenValueScale, formatScreenValue}
