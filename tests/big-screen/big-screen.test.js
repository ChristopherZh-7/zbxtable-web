const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const page = fs.readFileSync(path.join(root, 'src/pages/screen/index.vue'), 'utf8')
const header = fs.readFileSync(path.join(root, 'src/pages/screen/components/HeaderBar.vue'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'src/pages/screen/style.less'), 'utf8')

test('big screen uses a proportional 1920 by 1080 design stage', () => {
  assert.match(styles, /\.screen-stage\s*\{[\s\S]*width:\s*1920px;[\s\S]*height:\s*1080px;/)
  assert.match(page, /Math\.min\(this\.viewportWidth \/ 1920, this\.viewportHeight \/ 1080\)/)
  assert.match(page, /translate\(-50%, -50%\) scale\(/)
  assert.match(page, /window\.addEventListener\('resize', this\.syncViewport\)/)
  assert.match(page, /window\.removeEventListener\('resize', this\.syncViewport\)/)
})

test('full screen and five automatic refresh intervals remain operator controlled', () => {
  assert.match(header, /document\.documentElement/)
  assert.match(header, /requestFullscreen/)
  assert.match(header, /document\.exitFullscreen/)
  for (const seconds of [10, 30, 60, 300, 600]) {
    assert.match(header, new RegExp(`value: ${seconds}(?:[, }])`))
  }
  assert.match(header, /screen_refresh_interval/)
  assert.match(page, /this\.fetchAll\(\)[\s\S]*this\.startTimers\(\)/)
})

test('refresh completion is visible and all screen data is settled together', () => {
  assert.match(page, /await Promise\.allSettled\(/)
  assert.match(page, /this\.lastUpdated = parseTimeFun\(new Date\(\)\)/)
  assert.match(header, /screen_last_refresh/)
  for (const source of ['indexInfo', 'indexTrigger', 'indexEgress', 'indexRestop']) {
    assert.match(page, new RegExp(source))
  }
})

test('fixed big screen exposes permission-aware custom screen entry points', () => {
  assert.match(page, /\$can\('tenant\.dashboard', 'read'\)/)
  assert.match(page, /\$can\('tenant\.dashboard', 'create'\)/)
  assert.match(page, /@manage-screens="openScreenManagement"/)
  assert.match(page, /@create-screen="createCustomScreen"/)
  assert.match(page, /this\.\$router\.push\('\/topology\/custom-screens'\)/)
  assert.match(page, /this\.\$router\.push\('\/topology\/custom-screen-designer'\)/)
  assert.match(header, /v-if="canManageScreens"/)
  assert.match(header, /v-if="canCreateScreen"/)
  assert.match(header, /screen_manage/)
  assert.match(header, /screen_create/)
})
