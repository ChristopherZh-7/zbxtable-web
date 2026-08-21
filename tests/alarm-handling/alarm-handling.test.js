const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('alarm list exposes the four handling states and assignee', () => {
  const page = source('src/pages/alarm/query.vue')
  for (const status of ['unclaimed', 'processing', 'resolved', 'closed']) {
    assert.match(page, new RegExp(`${status}: this\\.\\$t\\('handling_${status}'\\)`))
  }
  assert.match(page, /dataIndex: "assignee_username"/)
  assert.match(page, /handlingStatusColor\(record\.handling_status\)/)
})

test('handling drawer uses server timeline and unified operate permission', () => {
  const page = source('src/pages/alarm/query.vue')
  assert.match(page, /\$can\('tenant\.alarms', 'operate'\)/)
  assert.match(page, /handlingDetail\.events/)
  assert.match(page, /claimHandling/)
  assert.match(page, /submitHandling\('note'\)/)
  assert.match(page, /submitHandling\('resolve'\)/)
  assert.match(page, /submitHandling\('close'\)/)
})

test('alarm handling services use scoped nested endpoints', () => {
  const service = source('src/services/admin.js')
  assert.match(service, /ALARM \+ '\/' \+ id \+ '\/handling'/)
  assert.match(service, /ALARM \+ '\/' \+ id \+ '\/claim'/)
  assert.match(service, /\{ action, note \}/)
})
