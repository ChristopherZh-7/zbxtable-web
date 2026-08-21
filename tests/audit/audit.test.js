const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  ACTION_LABELS,
  MAX_AUDIT_RANGE_MS,
  RESULT_LABELS,
  buildAuditQuery,
  validateAuditRange,
} = require('../../src/pages/system/audit/audit-policy')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')
const instant = (value) => ({valueOf: () => value, toISOString: () => new Date(value).toISOString()})

test('audit query defaults stay paginated and metadata-only', () => {
  const end = Date.UTC(2026, 7, 21, 8)
  const query = buildAuditQuery({range: [instant(end - 86400000), instant(end)], actor: 'admin'}, 2, 20)
  assert.equal(query.page, 2)
  assert.equal(query.limit, 20)
  assert.equal(query.actor, 'admin')
  assert.equal(Object.hasOwn(query, 'body'), false)
  assert.equal(Object.hasOwn(query, 'password'), false)
  assert.equal(Object.hasOwn(query, 'token'), false)
})

test('audit query rejects ranges beyond 31 days', () => {
  const end = Date.UTC(2026, 7, 21, 8)
  assert.equal(validateAuditRange([instant(end - MAX_AUDIT_RANGE_MS), instant(end)]), '')
  assert.match(validateAuditRange([instant(end - MAX_AUDIT_RANGE_MS - 1), instant(end)]), /31 天/)
})

test('audit result and action labels cover required states', () => {
  assert.deepEqual(Object.keys(RESULT_LABELS).sort(), ['denied', 'failed', 'pending', 'success'])
  assert.equal(ACTION_LABELS.export, '导出')
  assert.equal(ACTION_LABELS.login, '登录')
})

test('audit page is platform route with filters and no mutation controls', () => {
  const page = source('src/pages/system/audit/index.vue')
  const routeMap = source('src/router/async/router.map.js')
  const service = source('src/services/audit.js')
  assert.match(routeMap, /systemAudit[\s\S]*pages\/system\/audit/)
  assert.match(page, /操作人/)
  assert.match(page, /租户/)
  assert.match(page, /来源 IP/)
  assert.match(page, /request_id/)
  assert.match(service, /\/v1\/audit.*METHOD\.GET/)
  assert.doesNotMatch(service, /METHOD\.(POST|PUT|DELETE)/)
  assert.doesNotMatch(page, /删除审计|导出审计/)
})
