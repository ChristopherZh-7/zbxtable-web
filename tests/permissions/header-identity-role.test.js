const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Vue = require('vue')
const Vuex = require('vuex')

Vue.use(Vuex)
Vue.config.productionTip = false
Vue.config.devtools = false

const sourceRoot = path.resolve(__dirname, '../..')
const headerSource = fs.readFileSync(path.join(sourceRoot, 'src/layouts/header/HeaderAvatar.vue'), 'utf8')
const accountSource = fs.readFileSync(path.join(sourceRoot, 'src/store/modules/account.js'), 'utf8')
const headerScript = headerSource.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*\r?\n/gm, '')
  .replace('export default {', 'return {')

// Real component computed properties, Vue reactivity, Vuex helpers and account
// mutations are executed. This is not a browser, API or authentication test.
function fixture(t, {user = {username: 'fixture-user', role: 'user'}, roles} = {}) {
  const storage = {getItem: () => null, setItem() {}}
  const account = new Function('localStorage', 'process', accountSource.replace('export default {', 'return {'))(storage, process)
  account.state.user = user
  account.state.roles = roles
  const store = new Vuex.Store({modules: {account}})
  const definition = new Function('mapGetters', 'logout', 'stopTokenRefresher', 'ChangePasswordForm', 'require', headerScript)(
    Vuex.mapGetters,
    () => { throw new Error('Unexpected logout service call in identity-only test') },
    () => { throw new Error('Unexpected token mutation in identity-only test') },
    {},
    name => {
      assert.equal(name, '@/pages/system/i18n')
      return {}
    }
  )
  const vm = new Vue({...definition, store})
  t.after(() => vm.$destroy())
  return {vm, store}
}

function identity(vm) {
  return {normalizedRole: vm.normalizedRole, label: vm.roleLabel, mark: vm.roleMark, name: vm.displayName}
}

const canonical = {
  viewer: {label: '只读用户', mark: '读'},
  tenant_admin: {label: '租户管理员', mark: '租'},
  platform_admin: {label: '平台管理员', mark: '管'},
}

for (const role of Object.keys(canonical)) {
  test(`header uses the current account role: ${role}`, t => {
    const {vm} = fixture(t, {user: {name: '真实账号名', role: role === 'platform_admin' ? 'admin' : 'user'}, roles: [{id: role, operation: ['read']}]})
    t.diagnostic(JSON.stringify(identity(vm)))
    assert.equal(vm.normalizedRole, role)
    assert.equal(vm.roleLabel, canonical[role].label)
    assert.equal(vm.roleMark, canonical[role].mark)
    assert.equal(vm.displayName, '真实账号名')
  })
}

test('current viewer role wins over a stale global administrator role', t => {
  const {vm} = fixture(t, {user: {username: 'fixture-stale-admin', role: 'admin'}, roles: [{id: 'viewer'}]})
  t.diagnostic(JSON.stringify(identity(vm)))
  assert.equal(vm.normalizedRole, 'viewer')
  assert.equal(vm.roleLabel, '只读用户')
  assert.equal(vm.roleMark, '读')
})

test('embedded user roles do not override the current account role', t => {
  const {vm} = fixture(t, {user: {username: 'fixture-member', role: 'user', roles: [{id: 'platform_admin'}]}, roles: [{id: 'tenant_admin'}]})
  t.diagnostic(JSON.stringify(identity(vm)))
  assert.equal(vm.normalizedRole, 'tenant_admin')
  assert.equal(vm.roleLabel, '租户管理员')
  assert.equal(vm.roleMark, '租')
})

const unknownRoles = [
  ['empty', []],
  ['null', null],
  ['missing', undefined],
  ['non-array', {id: 'platform_admin'}],
  ['unknown identifier', [{id: 'operator'}]],
  ['legacy global identifier', [{id: 'admin'}]],
  ['name without identifier', [{name: 'platform_admin'}]],
  ['string instead of effective-role object', ['platform_admin']],
  ['null entry', [null]],
]

for (const [name, roles] of unknownRoles) {
  test(`unknown current role does not claim administrator identity: ${name}`, t => {
    const {vm} = fixture(t, {user: {username: 'fixture-cached-admin', role: 'admin', roles: [{id: 'platform_admin'}]}, roles})
    t.diagnostic(JSON.stringify(identity(vm)))
    assert.equal(vm.normalizedRole, '')
    assert.equal(vm.roleLabel, '授权用户')
    assert.equal(vm.roleMark, '用')
  })
}

test('tenant-role replacement and clear reactively update one existing component instance', async t => {
  const {vm, store} = fixture(t, {roles: [{id: 'tenant_admin'}]})
  const user = store.getters['account/user']
  const observed = [identity(vm)]
  for (const roles of [[{id: 'viewer'}], [{id: 'tenant_admin'}], [], [{id: 'viewer'}]]) {
    store.commit('account/setRoles', roles)
    await Vue.nextTick()
    observed.push(identity(vm))
  }
  t.diagnostic(JSON.stringify(observed))
  assert.deepEqual(observed.map(item => item.normalizedRole), ['tenant_admin', 'viewer', 'tenant_admin', '', 'viewer'])
  assert.deepEqual(observed.map(item => item.label), ['租户管理员', '只读用户', '租户管理员', '授权用户', '只读用户'])
  assert.deepEqual(observed.map(item => item.mark), ['租', '读', '租', '用', '读'])
  assert.equal(store.getters['account/user'], user)
})

test('permission refresh can establish platform identity without changing global user data', async t => {
  const {vm, store} = fixture(t, {roles: []})
  const observed = [identity(vm)]
  store.commit('account/setRoles', [{id: 'platform_admin'}])
  await Vue.nextTick()
  observed.push(identity(vm))
  t.diagnostic(JSON.stringify(observed))
  assert.equal(observed[0].label, '授权用户')
  assert.equal(observed[1].normalizedRole, 'platform_admin')
  assert.equal(observed[1].label, '平台管理员')
  assert.equal(observed[1].mark, '管')
  assert.equal(store.getters['account/user'].role, 'user')
})

test('existing account-name fallback remains unchanged', t => {
  const {vm, store} = fixture(t, {user: {username: 'fixture-username', role: 'user'}, roles: []})
  assert.equal(vm.displayName, 'fixture-username')
  store.commit('account/setUser', {})
  assert.equal(vm.displayName, '用户')
})

test('identity display leaves the existing menu action dispatch unchanged', t => {
  const {vm} = fixture(t, {roles: [{id: 'viewer'}]})
  const actions = []
  vm.openChangePassword = () => actions.push('change-password')
  vm.logout = () => actions.push('logout')
  vm.handleMenuClick({key: 'change-password'})
  vm.handleMenuClick({key: 'logout'})
  vm.handleMenuClick({key: 'identity'})
  assert.deepEqual(actions, ['change-password', 'logout'])
})
