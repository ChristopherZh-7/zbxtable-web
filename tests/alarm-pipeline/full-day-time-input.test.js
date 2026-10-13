const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Vue = require('vue')
const compiler = require('vue-template-compiler')
const Input = require('ant-design-vue/lib/input').default
const Button = require('ant-design-vue/lib/button').default

// cwd is the selected smart-ops-web root, so the same external test can run
// against a byte-pristine baseline without adding a file to that baseline.
const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/alarm/query.vue'), 'utf8')
const sfc = compiler.parseComponent(source)
const template = sfc.template.content.trim()
const parsed = compiler.compile(template, {outputSourceRange: true})
assert.deepEqual(parsed.errors, [])
const nodes = []
function visit(node) {
  if (node.type !== 1) return
  nodes.push(node)
  for (const child of node.children || []) visit(child)
}
visit(parsed.ast)
function one(predicate) {
  const matches = nodes.filter(predicate)
  assert.equal(matches.length, 1)
  return matches[0]
}
const startInput = one(node => node.tag === 'a-input' && node.attrsMap['v-model'] === 'shift.start_time')
const endInput = one(node => node.tag === 'a-input' && node.attrsMap['v-model'] === 'shift.end_time')
const saveButton = one(node => node.tag === 'a-button' && node.events && node.events.click && node.events.click.value === 'savePipeline')
const render = compiler.compile(`<div>${[startInput, endInput, saveButton].map(node => template.slice(node.start, node.end)).join('\n')}</div>`)
assert.deepEqual(render.errors, [])

// Execute the literal methods and compile the actual source bindings through
// real Vue2/AntD components. Service promises are controlled test boundaries;
// this is not a browser, server-validation or scheduler acceptance test.
function literalMethod(name, bindings) {
  const script = sfc.script.content.replace(/\r\n/g, '\n')
  const match = new RegExp(`\\n([ \\t]*)${name}\\(`).exec(script)
  assert.ok(match, `literal ${name} exists`)
  const begin = match.index + 1
  const end = script.indexOf(`\n${match[1]}},`, begin)
  assert.ok(end > begin, `literal ${name} ends`)
  return new Function(...Object.keys(bindings), `return ({${script.slice(begin, end + match[1].length + 3)}}).${name}`)(...Object.values(bindings))
}
const tick = () => new Promise(resolve => setImmediate(resolve))
const copy = value => JSON.parse(JSON.stringify(value))
const initial = () => ({
  candidates: [{user_id: 7, username: 'duty-admin'}],
  policy: {enabled: true, delay_minutes: 15, escalation_user_id: 7},
  shifts: [{id: 5, name: 'all-day', weekdays: [1, 2, 3, 4, 5, 6, 7],
    start_minute: 0, end_minute: 1440, duty_user_id: 7, enabled: true}],
})

async function setup(t) {
  let server = initial()
  let result = {code: 200}
  let reads = 0
  const writes = []
  const errors = []
  const successes = []
  const components = []
  const bindings = {
    getAlarmPipeline() { reads++; return Promise.resolve({data: {code: 200, data: copy(server)}}) },
    updateAlarmPipeline(payload) {
      writes.push(copy(payload))
      if (result.code === 200) server = {...server, ...copy(payload)}
      return Promise.resolve({data: copy(result)})
    },
  }
  const names = ['minuteToPipelineTime', 'pipelineTimeToMinute', 'loadPipeline', 'buildPipelinePayload', 'savePipeline']
  const methods = Object.fromEntries(names.map(name => [name, literalMethod(name, bindings)]))
  methods.$t = key => key
  const vm = new Vue({
    components: {'a-input': Input, 'a-button': Button},
    data: () => ({pipelineConfig: {shifts: [], policy: {}}, pipelineLoading: false, pipelineSaving: false}),
    computed: {shift() { return this.pipelineConfig.shifts[0] }},
    methods, render: new Function(render.render),
    staticRenderFns: render.staticRenderFns.map(code => new Function(code)),
  })
  vm.$message = {error: message => errors.push(message), success: message => successes.push(message)}
  t.after(() => { for (const component of components) component.$destroy(); vm.$destroy() })
  function instantiate(vnode) {
    const component = new vnode.componentOptions.Ctor({_isComponent: true, _parentVnode: vnode, parent: vm})
    components.push(component)
    return component
  }
  function input(index) {
    const vnode = vm._render().children.filter(node => node.componentOptions && node.componentOptions.tag === 'a-input')[index]
    assert.equal(vnode.componentOptions.Ctor.options.name, 'AInput')
    const component = instantiate(vnode)
    const native = component._render().componentOptions.propsData.element
    assert.equal(native.tag, 'input')
    return native
  }
  async function enter(index, value) {
    input(index).data.on.input({type: 'input', target: {value}})
    await Vue.nextTick()
  }
  async function save() {
    const vnode = vm._render().children.find(node => node.componentOptions && node.componentOptions.tag === 'a-button')
    assert.equal(vnode.componentOptions.Ctor.options.name, 'AButton')
    instantiate(vnode).handleClick({type: 'click'})
    assert.equal(vm.pipelineSaving, true)
    await tick()
    assert.equal(vm.pipelineSaving, false)
  }
  vm.loadPipeline()
  await tick()
  assert.equal(vm.pipelineLoading, false)
  return {vm, input, enter, save, writes, errors, successes,
    reads: () => reads, reject: message => { result = {code: 400, message} }}
}

test('full-day API readback renders editable 24:00 in the actual end input, not an invalid native time', async t => {
  const f = await setup(t)
  assert.equal(f.input(0).data.attrs.type, 'time', 'start picker remains unchanged')
  assert.equal(f.input(0).data.domProps.value, '00:00')
  const end = f.input(1)
  assert.equal(end.data.domProps.value, '24:00')
  assert.equal(end.data.attrs.type, 'text', '24:00 must not be assigned to a type=time input')
  assert.equal(end.data.attrs.placeholder, 'HH:mm')
  assert.equal(Boolean(end.data.attrs.readonly || end.data.attrs.disabled), false)
})

test('real input events and Save button preserve ordinary windows and full-day minute 1440 after readback', async t => {
  const f = await setup(t)
  for (const [start, end, startMinute, endMinute] of [
    ['00:00', '24:00', 0, 1440], ['09:00', '18:00', 540, 1080],
    ['18:00', '23:59', 1080, 1439], ['00:00', '24:00', 0, 1440],
  ]) {
    await f.enter(0, start)
    await f.enter(1, end)
    await f.save()
    assert.deepEqual(f.writes.at(-1), {
      policy: initial().policy,
      shifts: [{name: 'all-day', weekdays: [1, 2, 3, 4, 5, 6, 7],
        start_minute: startMinute, end_minute: endMinute, duty_user_id: 7, enabled: true}],
    })
    assert.equal(f.input(0).data.domProps.value, start)
    assert.equal(f.input(1).data.domProps.value, end)
  }
  assert.deepEqual(f.errors, [])
  assert.equal(f.successes.length, 4)
  assert.equal(f.reads(), 5)
})

test('invalid or empty end input is not silently clamped to 1439/1440 and existing API rejection stays visible', async t => {
  const f = await setup(t)
  f.reject('班次时间范围无效')
  for (const [value, minute] of [['24:01', 1441], ['', -1]]) {
    await f.enter(1, value)
    await f.save()
    assert.equal(f.writes.at(-1).shifts[0].end_minute, minute)
    assert.equal(f.input(1).data.domProps.value, value)
  }
  assert.deepEqual(f.errors, ['班次时间范围无效', '班次时间范围无效'])
  assert.deepEqual(f.successes, [])
  assert.equal(f.reads(), 1, 'rejected save does not replace unsaved input with a reload')
})
