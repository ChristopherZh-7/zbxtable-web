const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  buildStandardTagFilters,
  buildStandardTagPayload,
  standardTagState,
} = require('../../src/pages/host/asset-tags')

test('standard tag state accepts the frozen four dimensions', () => {
  const state = standardTagState([
    {tag: 'tenant', value: 'tenant-a'},
    {tag: 'env', value: 'prod'},
    {tag: 'app', value: 'billing-api'},
    {tag: 'level', value: 'core'},
    {tag: 'team', value: 'ops'},
  ], 'tenant-a')
  assert.equal(state.compliant, true)
  assert.deepEqual(state.missing, [])
})

test('missing, forged and invalid dimensions remain visibly noncompliant', () => {
  const state = standardTagState([
    {tag: 'tenant', value: 'tenant-b'},
    {tag: 'env', value: 'production'},
    {tag: 'app', value: 'Billing API'},
  ], 'tenant-a')
  assert.equal(state.compliant, false)
  assert.deepEqual(state.missing, ['tenant', 'env', 'app', 'level'])
})

test('single and combined filters serialize as backend AND conditions', () => {
  assert.equal(buildStandardTagFilters({env: 'prod'}), '[{"tag":"env","value":"prod"}]')
  assert.equal(
    buildStandardTagFilters({env: 'prod', app: '', level: 'core'}),
    '[{"tag":"env","value":"prod"},{"tag":"level","value":"core"}]'
  )
  assert.equal(buildStandardTagFilters({}), undefined)
})

test('tag update payload always carries the current tenant', () => {
  assert.deepEqual(buildStandardTagPayload('tenant-a', {env: 'prod', app: 'billing', level: 'core'}), [
    {tag: 'tenant', value: 'tenant-a'},
    {tag: 'env', value: 'prod'},
    {tag: 'app', value: 'billing'},
    {tag: 'level', value: 'core'},
  ])
})

test('asset page exposes display, combined filters and permission-gated editing', () => {
  const page = fs.readFileSync(path.join(__dirname, '../../src/pages/host/GenericDeviceList.vue'), 'utf8')
  assert.match(page, /buildStandardTagFilters/)
  assert.match(page, /standardTagState/)
  assert.match(page, /\$can\('tenant\.monitoring', 'update'\)/)
  assert.match(page, /待规范/)
  assert.match(page, /编辑标签/)
})
