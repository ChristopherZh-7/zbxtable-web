const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

// Source-only dependency mocks execute the actual component methods; never browser/API proof.
const inlineInputs = {
  "schema": "p031-session-recovery-fixed-inputs-v1",
  "success": {
    "username": "ACTOR",
    "password": "PASSWORD",
    "response": {
      "data": {
        "code": 200,
        "message": "登录成功",
        "data": {
          "token": "SERIAL_TOKEN",
          "user": {
            "id": 31,
            "name": "ACTOR",
            "role": "admin"
          }
        }
      }
    }
  },
  "empty": [
    {
      "username": "",
      "password": "PASSWORD"
    },
    {
      "username": "ACTOR",
      "password": ""
    }
  ],
  "wrong_password": {
    "data": {
      "code": 400,
      "message": "用户名或密码错误"
    }
  },
  "unauthorized": {
    "message": "401 Unauthorized",
    "response": {
      "status": 401,
      "data": {
        "code": 50014,
        "message": "账号已停用或不存在"
      }
    }
  },
  "missing_token": [
    null,
    {},
    {
      "data": {
        "code": 200
      }
    },
    {
      "data": {
        "code": 200,
        "data": {}
      }
    }
  ],
  "restoration": {
    "captured_tenant": {
      "id": 11,
      "code": "TENANT_A",
      "name": "Original tenant",
      "status": 0
    },
    "captured_user": {
      "id": 31,
      "name": "ACTOR",
      "role": "admin"
    },
    "tenants": [
      {
        "id": 12,
        "code": "TENANT_B",
        "name": "Other tenant",
        "status": 0
      },
      {
        "id": 11,
        "code": "TENANT_A",
        "name": "Fresh original tenant",
        "status": 0
      }
    ],
    "current_tenant": {
      "id": 11,
      "code": "TENANT_A",
      "name": "Fresh original tenant",
      "status": 0
    },
    "permissions": {
      "roles": [
        {
          "id": "tenant_admin"
        }
      ],
      "permissions": [
        {
          "id": "tenant.dashboard",
          "operation": [
            "read"
          ]
        }
      ],
      "tenant_id": 11
    },
    "routes": [
      "dashboard",
      "screen/dashboard"
    ],
    "rejected_cases": [
      {
        "name": "missing_tenant_hint",
        "scenario": {
          "hintTenant": null
        }
      },
      {
        "name": "missing_user_hint",
        "scenario": {
          "hintUser": null
        }
      },
      {
        "name": "changed_user_id",
        "scenario": {
          "loginUser": {
            "id": 32,
            "name": "ACTOR",
            "role": "admin"
          }
        }
      },
      {
        "name": "changed_username",
        "scenario": {
          "loginUser": {
            "id": 31,
            "name": "OTHER_ACTOR",
            "role": "admin"
          }
        }
      },
      {
        "name": "membership_revoked",
        "scenario": {
          "tenantItems": [
            {
              "id": 12,
              "code": "TENANT_B",
              "name": "Other tenant",
              "status": 0
            }
          ]
        }
      },
      {
        "name": "tenant_disabled",
        "scenario": {
          "tenantItems": [
            {
              "id": 12,
              "code": "TENANT_B",
              "name": "Other tenant",
              "status": 0
            },
            {
              "id": 11,
              "code": "TENANT_A",
              "name": "Fresh original tenant",
              "status": 1
            }
          ]
        }
      },
      {
        "name": "tenant_list_rejected",
        "scenario": {
          "tenantCode": 403
        }
      },
      {
        "name": "wrong_confirmed_tenant",
        "scenario": {
          "currentTenant": {
            "id": 12,
            "code": "TENANT_B",
            "name": "Other tenant",
            "status": 0
          }
        }
      },
      {
        "name": "disabled_confirmed_tenant",
        "scenario": {
          "currentTenant": {
            "id": 11,
            "code": "TENANT_A",
            "name": "Fresh original tenant",
            "status": 1
          }
        }
      },
      {
        "name": "tenant_confirmation_rejected",
        "scenario": {
          "currentCode": 403
        }
      },
      {
        "name": "dashboard_permission_denied",
        "scenario": {
          "permissions": [
            {
              "id": "tenant.dashboard",
              "operation": []
            }
          ]
        }
      },
      {
        "name": "wrong_permission_tenant",
        "scenario": {
          "permissionTenant": 12
        }
      },
      {
        "name": "permission_envelope_rejected",
        "scenario": {
          "permissionCode": 403
        }
      },
      {
        "name": "malformed_routes",
        "scenario": {
          "routesData": {}
        }
      },
      {
        "name": "routes_envelope_rejected",
        "scenario": {
          "routesCode": 403
        }
      },
      {
        "name": "tenant_list_network_failure",
        "scenario": {
          "rejectAt": "tenants"
        }
      },
      {
        "name": "tenant_confirmation_network_failure",
        "scenario": {
          "rejectAt": "current"
        }
      },
      {
        "name": "permission_network_failure",
        "scenario": {
          "rejectAt": "permissions"
        }
      },
      {
        "name": "routes_network_failure",
        "scenario": {
          "rejectAt": "routes"
        }
      },
      {
        "name": "missing_login_user",
        "scenario": {
          "loginUser": null
        }
      },
      {
        "name": "login_rejected_even_with_token",
        "scenario": {
          "loginCode": 403
        }
      }
    ]
  }
}
const inputs = process.env.FIXED_INPUT ? JSON.parse(fs.readFileSync(process.env.FIXED_INPUT, 'utf8')) : inlineInputs
assert.deepEqual(inputs, inlineInputs, 'fixed inputs must not change across baseline/modified/rollback')
const root = process.env.TARGET_ROOT || path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'src/pages/screen/components/SessionOverlay.vue'), 'utf8')
const block = source.match(/<script>([\s\S]*?)<\/script>/)
assert.ok(block, 'real SessionOverlay script required')
const code = block[1].replace(/^import[^\n]*\n/gm, '').replace('export default', 'module.exports =')
const { businessPayload, normalizePermissionContext, canPerform } = require(path.join(root, 'src/utils/permission-policy.js'))
const { normalizeTenantItems } = require(path.join(root, 'src/pages/system/tenant-context.js'))
const clone = value => JSON.parse(JSON.stringify(value))
function harness(response, rejected, scenario = {}) {
  const calls = []; const authorizations = []; const emitted = []; const order = []; const contexts = []; const commits = []; const redirects = []; const loaded = []
  let tenant = clone(Object.prototype.hasOwnProperty.call(scenario, 'hintTenant') ? scenario.hintTenant : inputs.restoration.captured_tenant)
  const user = clone(Object.prototype.hasOwnProperty.call(scenario, 'hintUser') ? scenario.hintUser : inputs.restoration.captured_user)
  const state = { user, roles: [{ id: 'stale_admin' }], permissions: [{ id: 'tenant.dashboard', operation: ['read', 'operate'] }],
    tenants: [inputs.restoration.captured_tenant], currentTenant: inputs.restoration.captured_tenant, routesConfig: ['stale'] }
  const store = { getters: { 'account/user': user }, commit: (key, value) => {
    commits.push([key, clone(value)]); const name = key.split('/')[1]; const field = name.slice(3); const lower = field[0].toLowerCase()+field.slice(1)
    state[lower] = clone(value); if (name === 'setUser') store.getters['account/user'] = value
  } }
  const step = name => { order.push(name); if (scenario.rejectAt === name) throw new Error('fixed network failure') }
  const envelope = (code, data) => ({ data: { code, data } })
  const sandbox = { module: { exports: {} }, businessPayload, normalizePermissionContext, canPerform, normalizeTenantItems,
    login: async (...args) => { order.push('login'); calls.push(args); if (rejected) throw rejected; const value = clone(response)
      if (value && value.data && value.data.data) {
        if (Object.prototype.hasOwnProperty.call(scenario, 'loginUser')) value.data.data.user = scenario.loginUser
        if (scenario.loginCode !== undefined) value.data.code = scenario.loginCode
      } return value },
    setAuthorization: ({ token }) => { authorizations.push(token); order.push('setAuthorization') },
    removeAuthorization: () => { tenant = null; contexts.push(null); order.push('removeAuthorization') },
    getTenantContext: () => tenant,
    setTenantContext: value => { tenant = clone(value); contexts.push(tenant); order.push('setTenantContext') },
    listTenantContexts: async () => { step('tenants'); return envelope(scenario.tenantCode ?? 200, { items: scenario.tenantItems ?? inputs.restoration.tenants }) },
    getCurrentTenant: async () => { step('current'); assert.equal(tenant.id, inputs.restoration.captured_tenant.id, 'must request exact original tenant'); return envelope(scenario.currentCode ?? 200, { tenant: scenario.currentTenant ?? inputs.restoration.current_tenant }) },
    getPermissionContext: async () => { step('permissions'); assert.equal(tenant.id, inputs.restoration.captured_tenant.id); const access = clone(inputs.restoration.permissions)
      if (scenario.permissionTenant !== undefined) access.tenant_id = scenario.permissionTenant
      if (scenario.permissions !== undefined) access.permissions = scenario.permissions
      return envelope(scenario.permissionCode ?? 200, access) },
    getRoutesConfig: async () => { step('routes'); return envelope(scenario.routesCode ?? 200, scenario.routesData ?? inputs.restoration.routes) },
    loadRoutes: value => { step('loadRoutes'); loaded.push(clone(value)) } }
  vm.runInNewContext(code, sandbox, { filename: 'SessionOverlay.vue', timeout: 1000 })
  const component = sandbox.module.exports
  const context = { ...component.data(), username: inputs.success.username, password: inputs.success.password, $store: store,
    $router: { replace: async target => { redirects.push(target); order.push('redirect') } },
    $emit: event => { emitted.push(event); order.push('emit') } }
  Object.assign(context, component.methods)
  if (component.created) component.created.call(context)
  // Model the production 401: storage/cookie tenant are already gone, but old Vuex values may remain.
  tenant = null
  return { context, component, calls, authorizations, emitted, order, contexts, commits, redirects, loaded, state,
    currentTenant: () => tenant, submit: () => component.methods.submit.call(context) }
}
function rejectedResult(h) {
  assert.equal(h.context.error, '登录失败，请检查用户名或密码')
  assert.equal(h.context.loading, false)
  assert.deepEqual(h.authorizations, [])
  assert.deepEqual(h.emitted, [])
}
test('ISSUE033 submit accepts the real nested login response and emits success', async () => {
  const h = harness(inputs.success.response)
  await h.submit()
  assert.deepEqual(h.calls, [[inputs.success.username, inputs.success.password]])
  assert.deepEqual(h.authorizations, [inputs.success.response.data.data.token])
  assert.deepEqual(h.emitted, ['success'])
  assert.equal(h.context.error, '')
  assert.equal(h.context.loading, false)
})

test('ISSUE033 submit refuses missing username or password before login', async () => {
  for (const input of inputs.empty) {
    const h = harness(inputs.success.response)
    Object.assign(h.context, input)
    await h.submit()
    assert.equal(h.context.error, '请输入用户名和密码')
    assert.equal(h.context.loading, false)
    assert.deepEqual(h.calls, [])
    assert.deepEqual(h.authorizations, [])
    assert.deepEqual(h.emitted, [])
  }
})

test('ISSUE033 submit retains wrong-password envelope rejection', async () => {
  const h = harness(inputs.wrong_password)
  await h.submit()
  assert.equal(h.calls.length, 1)
  rejectedResult(h)
})

test('ISSUE033 submit retains HTTP401 rejection and releases loading', async () => {
  const h = harness(null, inputs.unauthorized)
  await h.submit()
  assert.equal(h.calls.length, 1)
  rejectedResult(h)
})

test('ISSUE033 submit rejects malformed or tokenless envelopes', async () => {
  for (const response of inputs.missing_token) {
    const h = harness(response)
    await h.submit()
    assert.equal(h.calls.length, 1)
    rejectedResult(h)
  }
})

test('ISSUE033 recovery snapshots original tenant and user before 401 clears storage', () => {
  const screen = fs.readFileSync(path.join(root, 'src/pages/screen/index.vue'), 'utf8')
  const mount = screen.match(/<session-overlay\b[^>]*\/>/)
  assert.ok(mount && !/\bv-if\s*=/.test(mount[0]), 'component is created before visible401, not only when overlay appears')
  const h = harness(inputs.success.response)
  assert.deepEqual(JSON.parse(JSON.stringify(h.context.restoreHint)), { tenantID: 11, userID: 31, username: 'ACTOR' })
  assert.equal(h.currentTenant(), null, 'production401 cleared tenant after captured created hook')
})

test('ISSUE033 recovery confirms original tenant and fresh access before resuming once', async () => {
  const h = harness(inputs.success.response)
  await h.submit()
  assert.deepEqual(h.order, ['login', 'setAuthorization', 'tenants', 'setTenantContext', 'current', 'permissions', 'routes', 'loadRoutes', 'emit'])
  assert.deepEqual(h.emitted, ['success'])
  assert.deepEqual(h.redirects, [])
  assert.equal(h.currentTenant().id, 11, 'never auto-pick the first other tenant12')
  assert.equal(h.currentTenant().name, 'Fresh original tenant', 'use fresh API tenant, not cached object')
  assert.deepEqual(h.state.user, inputs.success.response.data.data.user)
  assert.deepEqual(h.state.permissions, inputs.restoration.permissions.permissions)
  assert.deepEqual(h.state.roles, inputs.restoration.permissions.roles)
  assert.deepEqual(h.loaded, [inputs.restoration.routes])
  assert.ok(!h.state.permissions.some(p => p.operation.includes('operate')), 'stale elevated permissions removed')
})

for (const item of inputs.restoration.rejected_cases) {
  test(`ISSUE033 recovery rejects ${item.name} without resuming or switching tenant`, async () => {
    const h = harness(inputs.success.response, null, item.scenario)
    await h.submit()
    assert.deepEqual(h.emitted, [], 'no token-only success or parent refresh')
    assert.deepEqual(h.redirects, ['/login'], 'existing normal login/tenant-select flow')
    assert.equal(h.currentTenant(), null)
    assert.equal(h.state.user, null)
    assert.equal(h.state.currentTenant, null)
    assert.deepEqual(h.state.roles, [])
    assert.deepEqual(h.state.permissions, [])
    assert.deepEqual(h.state.routesConfig, [])
    assert.deepEqual(h.state.tenants, [])
    assert.equal(h.context.loading, false)
    assert.ok(h.context.error)
    assert.ok(h.order.includes('removeAuthorization'))
    assert.deepEqual(h.loaded, [], 'unconfirmed access never installs stale/other routes')
    assert.ok(h.contexts.every(t => !t || t.id === 11), 'no fallback to any other tenant')
    assert.equal(h.calls.length, 1)
  })
}
