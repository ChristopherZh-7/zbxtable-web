const DASHBOARD_PRESETS = Object.freeze([
  {
    key: 'operations-overview',
    label: '运行总览',
    description: '趋势、仪表盘、排行和明细同屏查看',
    width: 1600,
    height: 900,
    nodes: [
      {chart_type: 'line', title: '核心指标趋势', position: {x: 32, y: 32}, size: {width: 752, height: 392}},
      {chart_type: 'gauge', title: '当前健康度', position: {x: 816, y: 32}, size: {width: 360, height: 392}},
      {chart_type: 'bar', title: '资源排行', position: {x: 1208, y: 32}, size: {width: 360, height: 392}},
      {chart_type: 'table', title: '最近采集明细', position: {x: 32, y: 456}, size: {width: 1536, height: 392}},
    ],
  },
  {
    key: 'metric-grid',
    label: '指标看板',
    description: '六个等尺寸指标卡，适合值守大屏',
    width: 1600,
    height: 900,
    nodes: [
      {chart_type: 'gauge', title: '指标一', position: {x: 32, y: 32}, size: {width: 496, height: 392}},
      {chart_type: 'gauge', title: '指标二', position: {x: 552, y: 32}, size: {width: 496, height: 392}},
      {chart_type: 'gauge', title: '指标三', position: {x: 1072, y: 32}, size: {width: 496, height: 392}},
      {chart_type: 'line', title: '趋势一', position: {x: 32, y: 456}, size: {width: 496, height: 392}},
      {chart_type: 'bar', title: '趋势二', position: {x: 552, y: 456}, size: {width: 496, height: 392}},
      {chart_type: 'pie', title: '分布一', position: {x: 1072, y: 456}, size: {width: 496, height: 392}},
    ],
  },
  {
    key: 'service-focus',
    label: '服务聚焦',
    description: '左侧主趋势，右侧状态和拓扑辅助判断',
    width: 1600,
    height: 900,
    nodes: [
      {chart_type: 'line', title: '服务核心趋势', position: {x: 32, y: 32}, size: {width: 1000, height: 816}},
      {chart_type: 'gauge', title: '当前状态', position: {x: 1064, y: 32}, size: {width: 504, height: 392}},
      {chart_type: 'topology', title: '服务链路', position: {x: 1064, y: 456}, size: {width: 504, height: 392}},
    ],
  },
])

// The screen templates use the original 1920×1080 heading and 14 px gutters.
// Existing saved layouts and the ordinary dashboard presets are not rewritten.
const screenLayouts = [
  [[18, 94, 936, 479], [968, 94, 460, 479], [1442, 94, 460, 479], [18, 587, 1884, 479]],
  [[18, 94, 618, 479], [650, 94, 620, 479], [1284, 94, 618, 479], [18, 587, 618, 479], [650, 587, 620, 479], [1284, 587, 618, 479]],
  [[18, 94, 1242, 972], [1274, 94, 628, 479], [1274, 587, 628, 479]],
]
const SCREEN_PRESETS = Object.freeze(DASHBOARD_PRESETS.map((preset, index) => ({
  ...preset,
  description: preset.description + ' · 原版运维样式',
  width: 1920,
  height: 1080,
  nodes: preset.nodes.map((node, nodeIndex) => {
    const [x, y, width, height] = screenLayouts[index][nodeIndex]
    return {...node, position: {x, y}, size: {width, height}}
  }),
})))

module.exports = {DASHBOARD_PRESETS, SCREEN_PRESETS}
