const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  canPerform,
  normalizeAction,
  normalizePermissionContext,
} = require('../../src/utils/permission-policy')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('viewer permissions remain read-only even if unrelated cached roles claim admin', () => {
  const permissions = [
    {id: 'tenant.assets', operation: ['read']},
    {id: 'tenant.visualizations', operation: ['read']},
  ]
  assert.equal(canPerform(permissions, 'tenant.assets', 'read'), true)
  assert.equal(canPerform(permissions, 'tenant.assets', 'export'), false)
  assert.equal(canPerform(permissions, 'tenant.visualizations', 'update'), false)
  assert.equal(canPerform(permissions, 'platform.system', 'read'), false)
})

test('legacy button names map onto the server action catalog', () => {
  assert.equal(normalizeAction('add'), 'create')
  assert.equal(normalizeAction('edit'), 'update')
  assert.equal(normalizeAction('delete'), 'delete')
  const permissions = [{id: 'tenant.members', operation: ['read', 'create', 'update']}]
  assert.equal(canPerform(permissions, 'tenant.members', 'add'), true)
  assert.equal(canPerform(permissions, 'tenant.members', 'edit'), true)
})

test('normalizes only server permission-context fields', () => {
  const context = normalizePermissionContext({data: {code: 200, data: {
    tenant_id: 7,
    roles: [{id: 'viewer', operation: ['read']}],
    permissions: [{id: 'tenant.assets', operation: ['read']}],
    localStorageRole: 'platform_admin',
  }}})
  assert.equal(context.tenantID, 7)
  assert.deepEqual(context.roles.map((role) => role.id), ['viewer'])
  assert.deepEqual(context.permissions.map((permission) => permission.id), ['tenant.assets'])
})

test('unauthorized controls are hidden and tenant switches refresh server state', () => {
  const directive = source('src/plugins/authority-plugin.js')
  assert.match(directive, /el\.style\.display = 'none'/)
  assert.match(directive, /aria-hidden/)

  const selector = source('src/pages/system/tenants/select.vue')
  assert.match(selector, /await getPermissionContext\(\)/)
  assert.match(selector, /await getRoutesConfig\(\)/)

  const header = source('src/layouts/header/AdminHeader.vue')
  const permissionIndex = header.indexOf('await getPermissionContext()')
  const reloadIndex = header.indexOf('window.location.reload()')
  assert.ok(permissionIndex > -1 && reloadIndex > permissionIndex)
})

test('an authenticated application refreshes server permissions and routes before mounting', () => {
  const bootstrap = source('src/bootstrap.js')
  const main = source('src/main.js')
  assert.match(bootstrap, /async function bootstrap/)
  assert.match(bootstrap, /checkAuthorization\(\)/)
  assert.match(bootstrap, /await getPermissionContext\(\)/)
  assert.match(bootstrap, /await getRoutesConfig\(\)/)
  assert.match(bootstrap, /clearCachedAccess\(store\)[\s\S]*loadRoutes\(routesConfig\)/)
  assert.ok(main.indexOf('await bootstrap') < main.indexOf('.$mount("#app")'))
})

test('viewer-sensitive export and topology write controls declare action checks', () => {
  assert.match(source('src/pages/alarm/query.vue'), /v-auth="'export'"/)
  assert.match(source('src/pages/alarm/analysis.vue'), /\$can\('tenant\.alarms', 'export'\)/)
  assert.match(source('src/pages/topology/index.vue'), /v-auth="'create'"/)
  assert.match(source('src/pages/topology/index.vue'), /v-auth="'delete'"/)
  assert.match(source('src/pages/topology/show.vue'), /v-auth="'export'"/)
})
