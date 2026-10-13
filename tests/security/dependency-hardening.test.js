const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')

test('production dependencies pin remediated HTTP, cookie, chart, lodash and SheetJS releases', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.dependencies.axios, '1.20.0')
  assert.equal(pkg.dependencies['js-cookie'], '3.0.8')
  assert.equal(pkg.dependencies.echarts, '6.1.0')
  assert.equal(pkg.dependencies.lodash, '4.18.1')
  assert.equal(pkg.dependencies.xlsx, 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz')
  for (const removed of ['@antv/g2plot', '@antv/x6-vue-shape', 'echarts-liquidfill', 'exceljs', 'viser-vue']) {
    assert.equal(pkg.dependencies[removed], undefined)
  }
  assert.ok(pkg.devDependencies.mockjs)
})

test('legacy charts are rendered by ECharts without Viser or liquid-fill runtime imports', () => {
  const plugin = read('src/plugins/legacy-charts.js')
  assert.match(plugin, /import \* as echarts from 'echarts'/)
  assert.match(plugin, /Vue\.component\('v-chart', LegacyChart\)/)
  assert.doesNotMatch(plugin, /viser|@antv\/g2/i)
  for (const file of ['src/pages/host/linuxDetail.vue', 'src/pages/host/winDetail.vue', 'src/pages/host/netDetail.vue']) {
    const source = read(file)
    assert.doesNotMatch(source, /liquidFill|echarts-liquidfill/)
    assert.match(source, /type: 'gauge'/)
  }
})

test('Excel export loads the integrity-pinned official SheetJS build lazily', () => {
  const source = read('src/utils/exportXlsx.js')
  const lock = JSON.parse(read('package-lock.json'))
  assert.match(source, /webpackChunkName: "vendor-xlsx"/)
  assert.match(source, /xlsx\/dist\/xlsx\.mini\.min\.js/)
  const entry = lock.packages['node_modules/xlsx']
  assert.equal(entry.version, '0.20.3')
  assert.equal(entry.resolved, 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz')
  assert.match(entry.integrity, /^sha512-/)
})

test('new advisories have exact compatible fixes in every resolved production copy', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  assert.equal(pkg.dependencies.dompurify, '3.4.16')
  assert.equal(pkg.devDependencies.moment, '2.31.0')
  assert.equal(pkg.overrides['source-map-js'], '1.2.2')
  assert.equal(pkg.dependencies.vue, '2.7.16')
  assert.equal(pkg.dependencies['ant-design-vue'], '1.7.8')
  for (const [name, version] of Object.entries({ dompurify: '3.4.16', moment: '2.31.0', 'source-map-js': '1.2.2' })) {
    const entries = Object.entries(lock.packages).filter(([key]) => key === 'node_modules/' + name || key.endsWith('/node_modules/' + name))
    assert.ok(entries.length > 0, name + ' is missing')
    for (const [, entry] of entries) {
      assert.equal(entry.version, version)
      assert.match(entry.integrity, /^sha512-/)
    }
  }
})
