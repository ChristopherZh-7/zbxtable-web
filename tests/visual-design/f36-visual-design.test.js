const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('F36 uses one constrained SmartOps visual token system', () => {
  const theme = source('src/theme/smartops.less').toLowerCase()
  for (const color of ['#0a1f44', '#163a63', '#f3f6fa', '#1b5a96', '#c68a2b', '#c94b4b']) {
    assert.match(theme, new RegExp(color))
  }
  assert.match(theme, /prefers-reduced-motion/)
  assert.match(source('src/main.js'), /theme\/smartops\.less/)
})

test('F36 keeps the approved brand after persisted user settings load', () => {
  const settings = source('src/config/default/setting.config.js')
  const store = source('src/store/modules/setting.js')
  const login = source('src/pages/login/Login.vue')
  assert.match(settings, /color: '#1b5a96'/)
  assert.match(settings, /hideSetting: true/)
  assert.match(store, /brandSetting/)
  assert.match(store, /pageWidth: 'fluid'/)
  assert.match(login, /brandTheme/)
})

test('F36 first-batch pages share Chinese-first hierarchy and real-data signal rail', () => {
  const overview = source('src/pages/dashboard/overview-redesign.vue')
  const assets = source('src/pages/host/AssetBrowser.vue') + source('src/pages/host/GenericDeviceList.vue')
  const alarms = source('src/pages/alarm/query.vue')
  assert.match(overview, /smartops-signal-rail/)
  assert.match(overview, /受告警影响/)
  assert.match(overview, /Number\(host\.alarm\)/)
  assert.match(overview, /monitoring_health/)
  assert.match(overview, /state === 'healthy'/)
  assert.doesNotMatch(overview, /available\s*==\s*1\s*&&/)
  assert.match(assets, /资产管理/)
  assert.match(assets, /在线/)
  assert.match(alarms, /告警中心/)
  assert.match(alarms, /smartops-filter-panel/)
})

test('F36 route registries both load the redesigned overview', () => {
  const routeConfig = source('src/router/config.js')
  const asyncMap = source('src/router/async/router.map.js')
  assert.match(routeConfig, /dashboard\/overview-redesign/)
  assert.match(asyncMap, /dashboard\/overview-redesign/)
})

test('ISSUE045 keeps compact tenant and account controls in a flowing header', () => {
  const header = source('src/layouts/header/index.less')
  const layout = source('src/layouts/AdminLayout.vue')
  assert.match(header, /\.admin-header-wide\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*min-width:\s*0;/)
  assert.doesNotMatch(header, /float:\s*right/)
  assert.match(header, /@media\s*\(max-width:\s*900px\)[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?\.admin-header-right\s*\{[\s\S]*?flex-basis:\s*100%;[\s\S]*?height:\s*auto;/)
  assert.match(layout, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.admin-header\s*\{[\s\S]*?position:\s*sticky\s*!important;[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;/)
  assert.match(layout, /\.virtual-header\s*\{\s*display:\s*none;/)
})

test('ISSUE046 lets native host buttons activate the same popover by keyboard click', () => {
  const overview = source('src/pages/dashboard/overview-redesign.vue')
  assert.match(overview, /<a-popover[\s\S]*?:trigger="\['hover', 'click'\]"[\s\S]*?<button\s+type="button"[\s\S]*?class="host-node"/)
  assert.match(overview, /:aria-label="[^"\n]*getStatusLabel\(item\)/)
  assert.doesNotMatch(overview, /@keydown[^\n]*prevent/)
})
