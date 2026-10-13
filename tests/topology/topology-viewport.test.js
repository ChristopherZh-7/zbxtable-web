const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {createRequire} = require('node:module')
const requireX6 = createRequire(require.resolve('@antv/x6/package.json'))
const {ObjectExt} = requireX6('./lib/util/object')
const {NumberExt} = requireX6('./lib/util/number')
const geometry = requireX6('./lib/geometry')
const globalX6 = requireX6('./lib/global')
assert.equal(requireX6('./package.json').version, '1.32.8')

// Run the pinned library modules verbatim. Only unused renderer/base wiring is
// isolated: no DOM/browser renderer or production Graph instance is claimed.
function library(relative, links) {
  const filename = requireX6.resolve(relative)
  const exports = {}
  new Function('exports', 'require', fs.readFileSync(filename, 'utf8'))(exports, id => {
    assert.ok(Object.hasOwn(links, id), `unexpected X6 linkage ${id}`)
    return links[id]
  })
  return exports
}
const {Options} = library('./lib/graph/options.js', {
  '../global': globalX6, '../util': {ObjectExt},
  '../shape/standard/edge': {Edge: class {constructor() {throw new Error('renderer is outside this unit test')}}}
})
const {Base} = library('./lib/graph/base.js', {
  '../common': {Disposable: class {static dispose() {return () => {}}}}
})
const {TransformManager} = library('./lib/graph/transform.js', {
  '../util': {NumberExt}, '../geometry': geometry, './base': {Base}
})
const source = fs.readFileSync(path.join(process.cwd(), 'src/pages/topology/show.vue'), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .+$/gm, '').replace('export default {', 'return {')

function page(width, height, mount = false, observerSupported = true) {
  const parent = {clientWidth: width}
  const container = {clientWidth: width, clientHeight: height, parentElement: parent, style: {}, querySelectorAll: () => []}
  const listeners = new Set()
  const resizeEvents = []
  const ticks = []
  let deferred = false
  const lifecycle = []
  const observers = []
  // Notification ordering/ownership is a boundary fixture, not native RO proof.
  class ResizeObserverBoundary {
    constructor(callback) {this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this)}
    observe(target) {assert.equal(target, parent); this.targets.add(target)}
    disconnect() {this.disconnected = true; this.targets.clear(); lifecycle.push('ResizeObserver.disconnect')}
  }
  const browserWindow = {innerHeight: height + 80,
    ResizeObserver: observerSupported ? ResizeObserverBoundary : undefined,
    addEventListener: (name, fn) => {assert.equal(name, 'resize'); listeners.add(fn)},
    removeEventListener: (name, fn) => {assert.equal(name, 'resize'); listeners.delete(fn)}}
  let sx = 1, sy = 1, tx = 0, ty = 0, fits = 0
  class GraphBoundary {
    static registerNode() {}
    constructor(options) {
      this.options = Options.get(options)
      this.history = {redo() {}, undo() {}}
      this.nodes = []
      this.area = new geometry.Rectangle()
      this.view = {container}
      this.localToGraph = value => value
      this.graphToLocal = value => value
      const manager = this.transform = Object.create(TransformManager.prototype)
      manager.graph = this
      manager.getContentArea = () => this.area.clone()
      manager.getScale = () => ({sx, sy})
      manager.getTranslation = () => ({tx, ty})
      manager.scale = (x, y) => {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `locked X6 supplied non-finite scale: ${x},${y}`)
        sx = x; sy = y
      }
      manager.translate = (x, y) => {tx = x; ty = y}
    }
    trigger(name, value) {resizeEvents.push({name, value})}
    dispose() {lifecycle.push('graph.dispose')}
    resize(width, height) {this.transform.resize(width, height)}
    enablePanning() {}
    enableMouseWheel() {}
    centerContent() {this.transform.centerContent()}
    getContentArea() {return this.area.clone()}
    fromJSON(data) {
      this.nodes = data.nodes.map(node => ({attr: () => node.attrs.label.text}))
      this.area = new geometry.Rectangle(0, 0, 900, 260)
    }
    getNodes() {return this.nodes}
    getEdges() {return []}
    zoomToFit(options) {fits++; this.transform.zoomToFit(options)}
  }
  const payload = {topology: 'fixture', nodes: JSON.stringify([
    {id: 'n1', shape: 'text-node', x: 0, y: 0, width: 200, height: 60, attrs: {label: {text: 'A'}}},
    {id: 'n2', shape: 'text-node', x: 700, y: 200, width: 200, height: 60, attrs: {label: {text: 'B'}}}
  ]), edges: '[]'}
  const component = new Function('Graph', 'Shape', 'DataUri', 'topologyDetail', 'API_WS',
    'PageLayout', 'insertCss', 'document', 'window', 'require', script)(
    GraphBoundary, {}, {}, () => Promise.resolve({data: {code: 200, data: payload}}), '', {}, () => {},
    {getElementById: id => {assert.equal(id, 'containerChart'); return container}},
    browserWindow, () => ({}))
  const instance = {...component.data(), ...component.methods, id: 'fixture',
    $nextTick: fn => deferred ? ticks.push(fn) : fn(), $t: key => key,
    $message: {error: value => {throw new Error(value)}}}
  // Vue binds component methods to its instance; no real browser/renderer here.
  for (const key of Object.keys(component.methods)) instance[key] = component.methods[key].bind(instance)
  instance.initWebSocket = () => {} // lifecycle registration only; never open a socket
  if (mount) component.mounted.call(instance)
  else instance.initX6()
  return {instance, payload, component, browserWindow, parent, listeners, resizeEvents, lifecycle, observers,
    deferTicks: () => {deferred = true},
    flushTicks: () => {for (const fn of ticks.splice(0)) fn()},
    dispatch: () => {for (const fn of [...listeners]) fn()},
    notifyParent: () => {for (const o of observers) if (!o.disconnected) o.callback([{target: parent}], o)},
    observe: () => ({sx, sy, tx, ty, fits})}
}

for (const [name, width, height] of [['desktop', 1100, 760], ['narrow', 356, 764]]) {
  test(`topology ${name}: actual init and both detail/message paths pass numeric viewport to locked X6 fit`, async () => {
    const {instance, payload, observe} = page(width, height)
    await instance.renderTopologyMessage({data: JSON.stringify(payload)})
    instance.tuopuDetail()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(instance.graph.options.width, width)
    assert.equal(instance.graph.options.height, height)
    const fitted = observe()
    assert.equal(fitted.fits, 2)
    assert.ok(fitted.sx > 0 && fitted.sx <= 1 && fitted.sx === fitted.sy)
    assert.ok([fitted.tx, fitted.ty].every(Number.isFinite))
  })
}

// New lifecycle cases supplement, not replace, the original two fit cases.
test('same topology view resizes from desktop to narrow and back using parent size and numeric X6 resize', async () => {
  const p = page(1100, 760, true)
  assert.equal(p.listeners.size, 1, 'mounted owns exactly one viewport listener')
  assert.equal(p.observers.length, 1, 'mounted owns one parent ResizeObserver')
  assert.equal(p.instance.resizeObserver, p.observers[0])
  assert.deepEqual([...p.observers[0].targets], [p.parent])
  await p.instance.renderTopologyMessage({data: JSON.stringify(p.payload)})
  p.deferTicks()
  for (const [width, innerHeight] of [[356, 844], [1100, 840]]) {
    p.parent.clientWidth = 100 // responsive CSS still transitioning during Vue flush
    p.browserWindow.innerHeight = innerHeight
    const count = p.resizeEvents.length
    p.dispatch()
    assert.equal(p.resizeEvents.length, count, 'window resize waits for Vue flush')
    p.flushTicks()
    assert.equal(p.instance.graph.options.width, 100, 'Vue flush alone precedes the final CSS width')
    p.notifyParent() // RO may first observe the intermediate 100px layout
    p.flushTicks()
    assert.equal(p.instance.graph.options.width, 100)
    p.parent.clientWidth = width // CSS transition finishes after the first Vue flush
    const intermediateCount = p.resizeEvents.length
    p.notifyParent() // later native-style notification, no new window resize
    assert.equal(p.resizeEvents.length, intermediateCount, 'RO callback queues numeric resize')
    p.flushTicks()
    assert.equal(p.instance.canvasHeight, innerHeight - 80)
    assert.equal(p.instance.graph.options.width, width)
    assert.equal(p.instance.graph.options.height, innerHeight - 80)
    assert.equal(p.resizeEvents.at(-1).name, 'resize')
    assert.deepEqual(p.resizeEvents.at(-1).value, {width, height: innerHeight - 80})
    const fitted = p.observe()
    assert.ok(fitted.sx > 0 && fitted.sx <= 1 && fitted.sx === fitted.sy)
    assert.ok([fitted.tx, fitted.ty].every(Number.isFinite))
  }
  assert.equal(p.observe().fits, 7, 'initial content plus window/intermediate/final notification fits')
  // The owned window listener remains useful for height changes and browsers
  // without ResizeObserver; it is not proof of late CSS changes in those browsers.
  const fallback = page(1100, 760, true, false)
  assert.equal(fallback.observers.length, 0)
  assert.equal(fallback.listeners.size, 1)
  await fallback.instance.renderTopologyMessage({data: JSON.stringify(fallback.payload)})
  fallback.deferTicks()
  fallback.parent.clientWidth = 356
  fallback.browserWindow.innerHeight = 844
  fallback.dispatch()
  fallback.flushTicks()
  assert.equal(fallback.instance.graph.options.width, 356)
  assert.equal(fallback.instance.graph.options.height, 764)
  fallback.component.beforeDestroy.call(fallback.instance)
})

test('destroy removes the owned viewport listener, closes websocket and disposes graph once', () => {
  const p = page(1100, 760, true)
  const callback = [...p.listeners][0]
  assert.equal(p.observers.length, 1, 'mounted observes its owned parent')
  const observer = p.observers[0]
  const notification = observer.callback
  const before = p.observe()
  p.deferTicks()
  p.parent.clientWidth = 100
  p.dispatch() // queue window callback while graph is alive
  p.notifyParent() // queue RO callback while graph is alive
  const socket = {onclose: () => {}, close() {
    assert.equal(this.onclose, null)
    assert.equal(p.instance.wsManualClose, true)
    p.lifecycle.push('websocket.close')
  }}
  p.instance.websock = socket
  p.component.beforeDestroy.call(p.instance)
  assert.deepEqual(p.lifecycle, ['ResizeObserver.disconnect', 'websocket.close', 'graph.dispose'])
  assert.equal(observer.disconnected, true)
  assert.equal(observer.targets.size, 0)
  assert.equal(p.instance.resizeObserver, null)
  assert.equal(p.listeners.size, 0)
  assert.equal(p.instance.graph, null)
  assert.equal(p.instance.websock, null)
  assert.equal(p.instance.wsManualClose, true)
  p.parent.clientWidth = 356
  p.browserWindow.innerHeight = 844
  p.flushTicks() // queued callbacks must recheck destruction inside nextTick
  p.dispatch()
  callback()
  notification([{target: p.parent}], observer) // already-delivered stale RO callback
  p.flushTicks()
  p.component.beforeDestroy.call(p.instance)
  assert.deepEqual(p.lifecycle, ['ResizeObserver.disconnect', 'websocket.close', 'graph.dispose'])
  assert.equal(p.resizeEvents.length, 0)
  assert.deepEqual(p.observe(), before)
})
