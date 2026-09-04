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
