const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = process.env.ISSUE068_SOURCE || path.resolve(__dirname, '../..')
const policy = require(path.join(root, 'src/pages/system/tenant-context.js'))
const login = fs.readFileSync(path.join(root, 'src/pages/login/Login.vue'), 'utf8')
const match = login.match(/async prepareTenantContext\(user\) \{([\s\S]*?)\n    \},\n    async refreshAccessContext/)
assert.ok(match, 'the real Login.prepareTenantContext method must be loaded')
const tenants = [{id: 49, code: 'harness-f03-a', status: 0}]

async function prepare(role, stored, items = tenants) {
  let selected = null
  const context = {
    listTenantContexts: async () => ({data: {code: 200, data: {items}}}),
    normalizeTenantItems: policy.normalizeTenantItems,
    selectInitialTenant: policy.selectInitialTenant,
    getTenantContext: () => stored,
    setTenantContext: value => { selected = value },
    removeTenantContext: () => { selected = null }
  }
  const method = vm.runInNewContext(`({async prepareTenantContext(user) {${match[1]}\n}})`, context).prepareTenantContext
  const target = await method.call({setTenants() {}, setCurrentTenant() {}}, {role})
  return {target, selected}
}

test('platform admin with one authorized tenant is never selected implicitly', async () => {
  assert.equal(policy.selectInitialTenant(tenants, null, false), null)
  assert.deepEqual(await prepare('admin', null), {target: '/tenant-select', selected: null})
})
test('platform admin stale stored choice cannot fall back to the sole tenant', async () => {
  assert.equal(policy.selectInitialTenant(tenants, {id: 999999}, false), null)
  assert.deepEqual(await prepare('admin', {id: 999999}), {target: '/tenant-select', selected: null})
})
test('an existing explicit and still-authorized choice is preserved for admin', async () => {
  const result = await prepare('admin', {id: 49})
  assert.equal(result.target, '/dashboard/workplace')
  assert.equal(result.selected.id, 49)
})
test('ordinary single-tenant user retains the agreed automatic entry', async () => {
  const result = await prepare('user', null)
  assert.equal(result.target, '/dashboard/workplace')
  assert.equal(result.selected.id, 49)
})
test('ordinary multiple-tenant member still must choose', async () => {
  assert.deepEqual(await prepare('user', null, [...tenants, {id: 50, status: 0}]), {target: '/tenant-select', selected: null})
})
test('platform admin without enabled tenants opens management, never business', async () => {
  assert.deepEqual(await prepare('admin', null, []), {target: '/system/tenants', selected: null})
})
test('disabled stored tenant is not reused', async () => {
  assert.deepEqual(await prepare('admin', {id: 49}, [{...tenants[0], status: 1}]), {target: '/system/tenants', selected: null})
})
