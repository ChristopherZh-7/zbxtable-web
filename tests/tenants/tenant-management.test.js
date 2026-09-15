const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildTenantPayload,
  normalizeTenantItems,
  selectInitialTenant,
  validateTenantDraft,
} = require('../../src/pages/system/tenant-context')

test('auto-selects only a single authorized tenant and restores a still-authorized choice', () => {
  const tenants = [
    {id: 1, code: 'tenant-a', status: 0},
    {id: 2, code: 'tenant-b', status: 0},
  ]
  assert.equal(selectInitialTenant(tenants, null), null)
  assert.equal(selectInitialTenant(tenants, {id: 2}).id, 2)
  assert.equal(selectInitialTenant([tenants[0]], null).id, 1)
  assert.equal(selectInitialTenant(tenants, {id: 99}), null)
})

test('drops disabled tenants from selectable server responses', () => {
  const response = {data: {code: 200, data: {items: [
    {id: 1, status: 0},
    {id: 2, status: 1},
  ]}}}
  assert.deepEqual(normalizeTenantItems(response).map((item) => item.id), [1])
})

test('builds stable zid and host-group scopes without sending immutable code on edit', () => {
  const draft = {
    code: ' tenant-a ',
    name: ' Tenant A ',
    member_ids: ['7', 9],
    scopes: [{zid: '3', host_group_id: ' 101 ', host_group_name: ' Linux '}],
  }
  assert.equal(validateTenantDraft(draft), '')
  assert.deepEqual(buildTenantPayload(draft, false), {
    code: 'tenant-a',
    name: 'Tenant A',
    member_ids: [7, 9],
    scopes: [{zid: 3, host_group_id: '101', host_group_name: 'Linux'}],
  })
  assert.equal(Object.hasOwn(buildTenantPayload(draft, true), 'code'), false)
})

test('rejects invalid codes and incomplete resource scopes', () => {
  assert.match(validateTenantDraft({code: '1x', name: 'A', scopes: []}), /租户编码/)
  assert.match(validateTenantDraft({code: 'tenant-a', name: 'A', scopes: [{zid: 1}]}), /主机组/)
})
