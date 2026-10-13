const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Vue = require('vue')
const VueRouter = require('vue-router')
const compiler = require('vue-template-compiler')
const Button = require('ant-design-vue/lib/button').default

Vue.use(VueRouter)

// Exercise the source template's compiled click through the real AntD button
// and VueRouter. This is a route contract test, not browser/RBAC acceptance.
test('domain history alarm button resolves the existing alarmList menu route', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/pages/dashboard/domains/index.vue'), 'utf8')
  const template = compiler.parseComponent(source).template.content.trim()
  const parsed = compiler.compile(template, {outputSourceRange: true})
  assert.deepEqual(parsed.errors, [])
  const buttons = []
  function visit(node) {
    if (node.tag === 'a-button' && node.children.map(child => child.text || '').join('').trim() === '查看集中告警') buttons.push(node)
    for (const child of node.children || []) visit(child)
  }
  visit(parsed.ast)
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].parent.tag, 'a-drawer')
  const compiled = compiler.compile(template.slice(buttons[0].start, buttons[0].end))
  assert.deepEqual(compiled.errors, [])
  // These are the deployed menu paths from internal/model/menu.go; no alias
  // for the obsolete /alarm/query is registered to hide a broken navigation.
  const router = new VueRouter({mode: 'abstract', routes: [
    {path: '/dashboard/domains', name: 'domainMonitoring'},
    {path: '/alarm/list', name: 'alarmList'}
  ]})
  await router.push('/dashboard/domains')
  const vm = new Vue({router, components: {'a-button': Button},
    render: new Function(compiled.render),
    staticRenderFns: compiled.staticRenderFns.map(code => new Function(code))})
  let button
  try {
    const vnode = vm._render()
    assert.equal(vnode.componentOptions.Ctor.options.name, 'AButton')
    assert.equal(typeof vnode.componentOptions.listeners.click, 'function')
    button = new vnode.componentOptions.Ctor({_isComponent: true, _parentVnode: vnode, parent: vm})
    assert.equal(router.currentRoute.path, '/dashboard/domains', 'render must not navigate')
    button.handleClick({type: 'click'})
    await Vue.nextTick()
    assert.equal(router.currentRoute.path, '/alarm/list')
    assert.equal(router.currentRoute.name, 'alarmList')
    assert.equal(router.currentRoute.matched.length, 1)
    assert.deepEqual(router.currentRoute.query, {})
  } finally {
    if (button) button.$destroy()
    vm.$destroy()
  }
})
