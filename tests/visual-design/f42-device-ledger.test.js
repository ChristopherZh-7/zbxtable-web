const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const page = fs.readFileSync(path.join(root, 'src/pages/dashboard/index.vue'), 'utf8')

test('F42 presents device statistics as a compact operational card grid', () => {
  assert.match(page, /class="device-stat-grid"/)
  assert.match(page, /class="device-stat-card"/)
  assert.match(page, /class="device-stat-icon"[\s\S]*?<a-icon :type="item\.icon"/)
  assert.match(page, /class="device-stat-unit">台</)
  assert.doesNotMatch(page, /class="homeHItem"/)
})

test('F42 keeps API counts intact while adding consistent category icons', () => {
  assert.match(page, /count:\s*item\.count \|\| 0/)
  assert.match(page, /icon:\s*this\.getDeviceIcon\(item\.type_code, item\.name\)/)
  assert.match(page, /getDeviceIcon\(typeCode, name\)/)
  assert.match(page, /VM_LIN:[\s\S]*?VM_WIN:[\s\S]*?HW_NET:[\s\S]*?HW_SRV:/)
})

test('F42 uses normal numerals and responsive three-two column geometry', () => {
  assert.match(page, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(page, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(page, /:bodyStyle="\{minHeight: '194px', height: 'auto', padding: '14px'\}"/)
  assert.match(page, /font-family:\s*-apple-system/)
  assert.doesNotMatch(page, /font-family:\s*"SFMono-Regular"/)
  assert.doesNotMatch(page, /transform:\s*translateY\(-4px\)/)
  assert.doesNotMatch(page, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/)
})

test('ISSUE051 keeps full device names and counts within compact two-column cards', () => {
  assert.match(page, /class="device-name"\s+:title="item\.name"/)
  const nameRules = page.match(/\.device-name\s*\{([^}]+)\}/)[1]
  assert.match(nameRules, /white-space:\s*normal/)
  assert.match(nameRules, /overflow-wrap:\s*anywhere/)
  assert.doesNotMatch(nameRules, /text-overflow:\s*ellipsis/)
  assert.match(page, /\.device-stat-value\s*\{\s*display:\s*flex;\s*flex-wrap:\s*wrap;/)
  assert.match(page, /@media\s*\(max-width:\s*720px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?\.device-stat-card\s*\{\s*flex-direction:\s*column;/)
  assert.match(page, /class="device-count">\{\{ item\.count \}\}/)
})
