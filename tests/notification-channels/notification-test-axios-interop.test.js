const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {spawnSync} = require('node:child_process')
const test = require('node:test')
const Vue = require('vue')
const compiler = require('vue-template-compiler')
const parser = require('@babel/parser')
const cn = require('../../src/pages/system/config-i18n').messages.CN

const source = fs.readFileSync(path.resolve(__dirname, '../../src/pages/system/config.vue'), 'utf8')
const sfc = compiler.parseComponent(source)
const script = sfc.script.content
const parsedScript = parser.parse(script, {sourceType: 'module'})
const component = parsedScript.program.body.find(n => n.type === 'ExportDefaultDeclaration').declaration
const methods = component.properties.find(n => n.key.name === 'methods').value.properties
const names = ['showTestEmailModal', 'showTestWechatModal', 'handleTestEmail', 'handleTestWechat', 'handleTestDingTalk']
const literalMethods = names.map(name => {
  const node = methods.find(n => n.type === 'ObjectMethod' && n.key.name === name)
  assert.ok(node, `actual ${name} method exists`)
  return script.slice(node.start, node.end)
})
const axiosImports = parsedScript.program.body.filter(n => n.type === 'ImportDeclaration' && n.source.value === 'axios')
  .map(n => script.slice(n.start, n.end))

const template = sfc.template.content.trim()
const parsedTemplate = compiler.compile(template, {outputSourceRange: true})
assert.deepEqual(parsedTemplate.errors, [])
const nodes = []
function visit(node) {
  if (node.type !== 1) return
  nodes.push(node)
  for (const child of node.children || []) visit(child)
}
visit(parsedTemplate.ast)
const controls = [
  ['a-button', 'click', 'showTestEmailModal'], ['a-button', 'click', 'showTestWechatModal'],
  ['a-button', 'click', 'handleTestDingTalk'], ['a-modal', 'ok', 'handleTestEmail'],
  ['a-modal', 'ok', 'handleTestWechat'],
].map(([tag, event, handler]) => {
  const found = nodes.filter(n => n.tag === tag && n.events && n.events[event] && n.events[event].value === handler)
  assert.equal(found.length, 1, `one actual ${handler} binding`)
  return template.slice(found[0].start, found[0].end)
})
const render = compiler.compile(`<div>${controls.join('\n')}</div>`)
assert.deepEqual(render.errors, [])
const LocalVue = Vue.extend()
for (const tag of ['a-button', 'a-modal', 'a-input', 'a-icon']) {
  LocalVue.component(tag, {props: ['loading', 'confirmLoading', 'visible'], render(h) { return h('div', this.$slots.default) }})
}

let bundled, temporary
test.before(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'smartops-channel-interop-'))
  const entry = path.join(temporary, 'entry.js')
  // Keep the component's imports/method bodies verbatim. The control import does
  // not provide an `axios` binding to the baseline's locally shadowed requires.
  fs.writeFileSync(entry, `${axiosImports.join('\n')}\nimport proofAxios from 'axios';\n` +
    `export const methods = {${literalMethods.join(',\n')}};\n` +
    `export const actualAxios = proofAxios;\nexport const interop = {requiredPost: typeof require('axios').post, defaultPost: typeof proofAxios.post};\n`)
  const config = {
    mode: 'development', target: 'web', devtool: false, context: temporary, entry,
    output: {path: temporary, filename: 'bundle.js', libraryTarget: 'commonjs2', globalObject: 'globalThis'},
    resolve: {modules: [path.dirname(path.dirname(require.resolve('axios/package.json'))), 'node_modules'],
      mainFields: ['browser', 'module', 'main']},
    module: {rules: [{test: '\\.m?js$', use: {loader: require.resolve('babel-loader'), options: {
      babelrc: false, configFile: false,
      presets: [[require.resolve('@babel/preset-env'), {modules: false, targets: {chrome: '60'}}]],
    }}}]},
    optimization: {minimize: false}, performance: {hints: false},
  }
  const build = `const config=${JSON.stringify(config)};config.module.rules[0].test=new RegExp(config.module.rules[0].test);` +
    `require(${JSON.stringify(require.resolve('webpack'))})(config,(error,stats)=>{` +
    `if(error){console.error(error);process.exitCode=1;return;}if(stats.hasErrors()){console.error(stats.toString({all:false,errors:true}));process.exitCode=1;}});`
  // Same OpenSSL compatibility flag as scripts/build.js; no dependency/module mock.
  const result = spawnSync(process.execPath, ['--openssl-legacy-provider', '-e', build], {encoding: 'utf8'})
  assert.equal(result.status, 0, result.stderr || result.stdout)
  bundled = require(path.join(temporary, 'bundle.js'))
})
test.after(() => { if (temporary) fs.rmSync(temporary, {recursive: true, force: true}) })

const channels = [
  {name: 'Email', index: 3, open: 0, field: 'testEmailAddress', value: 'test@example.invalid', body: {test_email: 'test@example.invalid'}, path: '/v1/system/test-email', visible: 'testEmailVisible'},
  {name: 'Wechat', index: 4, open: 1, field: 'testWechatUserId', value: 'fixture-user', body: {test_user_id: 'fixture-user'}, path: '/v1/system/test-wechat', visible: 'testWechatVisible'},
  {name: 'DingTalk', index: 2, body: {}, path: '/v1/system/test-dingtalk'},
]
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(t) {
  const requests = [], messages = []
  // Only the HTTP adapter is controlled. Real bundled Axios resolves imports,
  // executes post/JSON transforms and propagates the actual Promise/error path.
  const old = bundled.actualAxios.defaults.adapter
  bundled.actualAxios.defaults.adapter = config => new Promise((resolve, reject) => {
    requests.push({config, url: config.url, method: config.method, body: JSON.parse(config.data), resolve, reject})
  })
  const vm = new LocalVue({
    data: () => ({testEmailVisible: false, testWechatVisible: false, testingEmail: false, testingWechat: false,
      testingDingTalk: false, testEmailAddress: '', testWechatUserId: ''}),
    methods: {...bundled.methods, $t: key => cn[key] || key},
    render: new Function(render.render), staticRenderFns: render.staticRenderFns.map(code => new Function(code)),
  })
  vm.$message = Object.fromEntries(['success', 'error', 'warning'].map(kind => [kind, text => messages.push({kind, text})]))
  function control(index) { return vm._render().children.filter(n => n.componentOptions)[index] }
  function fire(index, event) { return control(index).componentOptions.listeners[event]() }
  function start(spec) {
    if (spec.open !== undefined) {
      fire(spec.open, 'click')
      assert.equal(vm[spec.visible], true)
      vm[spec.field] = spec.value
    }
    return fire(spec.index, spec.index === 2 ? 'click' : 'ok')
  }
  t.after(() => { vm.$destroy(); bundled.actualAxios.defaults.adapter = old })
  return {vm, requests, messages, control, fire, start}
}

test('real webpack4 browser/module resolution exposes Axios default.post but not namespace.post', () => {
  assert.deepEqual({...bundled.interop}, {requiredPost: 'undefined', defaultPost: 'function'})
})

for (const spec of channels) test(`actual ${spec.name} button/modal posts and releases loading on success and both failures`, async t => {
  const f = fixture(t)
  for (const outcome of ['success', 'business-error', 'http-error']) {
    const offset = f.requests.length
    const pending = f.start(spec)
    await tick()
    t.diagnostic(JSON.stringify({channel: spec.name, outcome, calls: f.requests.length - offset, messages: f.messages}))
    assert.equal(f.requests.length, offset + 1, 'actual bundled method reaches Axios adapter')
    const request = f.requests[offset]
    assert.equal(request.url, spec.path)
    assert.equal(request.method, 'post')
    assert.deepEqual(request.body, spec.body)
    assert.equal(f.vm['testing' + spec.name], true)
    assert.equal(f.control(spec.index).componentOptions.propsData[spec.index === 2 ? 'loading' : 'confirmLoading'], true)
    if (outcome === 'http-error') request.reject({message: 'transport failure', response: {data: {message: '接收器拒绝'}}})
    else request.resolve({data: outcome === 'success' ? {code: 200} : {code: 422, message: '渠道未启用'},
      status: 200, statusText: 'OK', headers: {}, config: request.config})
    await pending
    assert.equal(f.vm['testing' + spec.name], false)
    const wanted = outcome === 'success' ? {kind: 'success', text: cn['test' + spec.name + 'Success']} :
      {kind: 'error', text: outcome === 'business-error' ? '渠道未启用' : cn.testFailed + ': 接收器拒绝'}
    assert.deepEqual(f.messages.at(-1), wanted)
    if (spec.visible) assert.equal(f.vm[spec.visible], outcome !== 'success')
  }
})

test('actual modal guards reject empty or invalid targets without requests or stuck loading', async t => {
  const f = fixture(t)
  for (const [spec, value, warning] of [
    [channels[0], '', cn.pleaseInputTestEmail], [channels[0], 'invalid-address', '请输入有效的邮箱地址'],
    [channels[1], '', cn.pleaseInputTestUserId],
  ]) {
    f.fire(spec.open, 'click')
    f.vm[spec.field] = value
    await f.fire(spec.index, 'ok')
    assert.deepEqual(f.messages.at(-1), {kind: 'warning', text: warning})
    assert.equal(f.requests.length, 0)
    assert.equal(f.vm['testing' + spec.name], false)
    assert.equal(f.vm[spec.visible], true)
  }
})
