const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const {arrangeNodes, presentationTransform} = require('../../src/pages/dashboard/custom/designer-layout')
const canvas = {width: 1920, height: 1080}
const nodes = [{id: 'a', x: 20, y: 40, width: 320, height: 200}, {id: 'b', x: 510, y: 90, width: 400, height: 260}, {id: 'c', x: 980, y: 30, width: 300, height: 220}]

test('aligning mixed-size components uses shared edges and centers without changing originals', () => {
  const original = JSON.stringify(nodes)
  for (const [action, value] of [['left', n => n.x], ['right', n => n.x + n.width], ['top', n => n.y], ['bottom', n => n.y + n.height], ['center', n => n.x + n.width / 2], ['middle', n => n.y + n.height / 2]]) {
    const arranged = arrangeNodes(nodes, action, 16, canvas)
    assert.equal(new Set(arranged.map(value)).size, 1)
    assert.deepEqual(arranged.map(n => [n.width, n.height]), nodes.map(n => [n.width, n.height]))
  }
  assert.equal(JSON.stringify(nodes), original)
})

test('explicit spacing handles unequal sizes in visual order, including zero gap', () => {
  for (const gap of [0, 16, 32]) {
    for (const action of ['horizontal-gap', 'vertical-gap']) {
      const arranged = arrangeNodes([...nodes].reverse(), action, gap, canvas)
      const axis = action === 'horizontal-gap' ? 'x' : 'y', size = axis === 'x' ? 'width' : 'height'
      for (let i = 1; i < arranged.length; i++) assert.equal(arranged[i][axis] - arranged[i-1][axis] - arranged[i-1][size], gap)
    }
  }
})

test('invalid selection, spacing, coordinates or canvas overflow rejects the whole arrangement', () => {
  assert.throws(() => arrangeNodes(nodes.slice(0, 1), 'left', 16, canvas), /至少两个/)
  for (const gap of [-1, 201, NaN, null]) assert.throws(() => arrangeNodes(nodes, 'horizontal-gap', gap, canvas), /间距/)
  assert.throws(() => arrangeNodes(nodes, 'horizontal-gap', 100, {width: 1100, height: 1080}), /超出画布/)
  assert.throws(() => arrangeNodes([{...nodes[0], x: NaN}, nodes[1]], 'left', 16, canvas), /尺寸无效/)
})

test('presentation preserves aspect ratio, fits all components and centers in available viewport', () => {
  for (const viewport of [{width: 1920, height: 1024}, {width: 1280, height: 664}, {width: 390, height: 700}]) {
    const view = presentationTransform(canvas, viewport, nodes)
    assert.ok(view.scale > 0)
    assert.ok(view.x >= 16 && view.y >= 16)
    assert.ok(canvas.width * view.scale <= viewport.width - 31.9)
    assert.ok(canvas.height * view.scale <= viewport.height - 31.9)
  }
  const view = presentationTransform(canvas, {width: 1920, height: 1024}, [{x: 1900, y: 1000, width: 400, height: 300}])
  assert.ok(2300 * view.scale <= 1888)
  assert.ok(1300 * view.scale <= 992)
})

test('editing controls are guarded in presentation and view routes retain read-only semantics', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/designer.vue'), 'utf8')
  const list = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/custom/index.vue'), 'utf8')
  assert.match(source, /return this.presenting \|\| this.\$route.query.readonly === '1'/)
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default', 'module.exports =')
  const sandbox = {module: {exports: {}}, registerDashboardChartNode() {}, Graph: {}, echarts: {}, PageLayout: {}, OperationsWidget: {}, HeaderBar: {}, ScreenPanel: {}, previewGraphic() {}, isOperationsType() { return false }}
  vm.runInNewContext(script, sandbox)
  for (const name of ['arrangeSelection', 'selectAllComponents', 'save']) {
    const readonly = {isReadonly: true, get graph() { throw new Error('read-only mode accessed an editing graph') }}
    assert.doesNotThrow(() => sandbox.module.exports.methods[name].call(readonly, 'left'))
  }
  assert.match(source, /snapline: \{enabled: !this.isReadonly, tolerance: 8\}/)
  assert.match(source, /startPresentation\(\)[\s\S]*?this._editorView =/)
  assert.match(source, /this.graph.translate\(view.translation.tx, view.translation.ty\)/)
  assert.match(list, /this\.\$router\.push\(screenLocation\(record\.id\)\)/)
})

test('original screen presentation fills a 16:9 viewport including its reserved heading', () => {
  const {OPERATIONS_PRESET} = require('../../src/pages/screen/operations-model')
  const rectangles = OPERATIONS_PRESET.nodes.map(node => ({...node.position, ...node.size}))
  for (const viewport of [{width: 1280, height: 720}, {width: 1920, height: 1080}]) {
    const view = presentationTransform({width: 1920, height: 1080}, viewport, rectangles, 0)
    assert.equal(view.x, 0)
    assert.equal(view.y, 0)
    assert.equal(view.scale, viewport.width / 1920)
    for (const node of rectangles) assert.ok((node.y + node.height) * view.scale <= viewport.height)
  }
})
