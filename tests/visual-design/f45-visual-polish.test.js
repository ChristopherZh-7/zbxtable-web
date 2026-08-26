const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('F45 uses three-by-two device cards without changing live count bindings', () => {
  const page = read('src/pages/dashboard/index.vue')
  assert.match(page, /class="device-stat-grid"/)
  assert.match(page, /class="device-stat-card"/)
  assert.match(page, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(page, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(page, /count:\s*item\.count \|\| 0/)
  assert.doesNotMatch(page, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(page, /class="device-ledger"/)
})

test('F45 prevents content headers from inheriting the global negative margin', () => {
  const pages = [
    'src/pages/visualization/Templates.vue',
    'src/pages/host/NetworkDiscovery.vue',
    'src/pages/host/ResourceDiscovery.vue',
    'src/pages/host/ScriptDiscovery.vue',
  ]
  for (const relative of pages) {
    const page = read(relative)
    assert.match(page, /class="content-page-header"/, `${relative} lacks the content header class`)
    assert.doesNotMatch(page, /class="page-header"/, `${relative} still collides with the global page header`)
  }

  const reference = read('src/pages/host/ConfigConsumption.vue')
  assert.match(reference, /class="config-consumption__header"/)
})
