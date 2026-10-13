const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(process.env.TARGET_ROOT || path.join(__dirname, '../..'))
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


// Execute the real screen component data and methods against per-tab storage/timer boundaries.
// This is source logic evidence only, never real API/browser evidence.
const vm = require('node:vm')
const intervalInlineInputs = {
  "schema": "p032-screen-refresh-interval-fixed-inputs-v1",
  "user_id": 31,
  "other_user_id": 32,
  "tenant_id": 41,
  "other_tenant_id": 42,
  "default_interval": 30,
  "allowed_intervals": [
    10,
    30,
    60,
    300,
    600
  ],
  "storage_key_prefix": "smartops.screen.refresh:",
  "invalid_stored_values": [
    "",
    "0",
    "-1",
    "11",
    "999",
    "NaN",
    "Infinity",
    "010",
    "10.0",
    "1e1",
    " 10 ",
    "[]",
    "null"
  ],
  "invalid_identity_cases": [
    {
      "user_id": null,
      "tenant_id": 41
    },
    {
      "user_id": 31,
      "tenant_id": null
    },
    {
      "user_id": 0,
      "tenant_id": 41
    },
    {
      "user_id": 31,
      "tenant_id": -1
    },
    {
      "user_id": 1.5,
      "tenant_id": 41
    },
    {
      "user_id": 31,
      "tenant_id": "NaN"
    }
  ]
}
const intervalInputs = process.env.FIXED_INPUT ? JSON.parse(fs.readFileSync(process.env.FIXED_INPUT, 'utf8')) : intervalInlineInputs
assert.deepEqual(intervalInputs, intervalInlineInputs, 'exact same fixed inputs, not a weaker environment fixture')

function intervalHarness(options = {}) {
  const values = new Map(Object.entries(options.initial || {}))
  const writes = [], reads = [], calls = [], timerDelays = [], clears = []
  let timerID = 0, tenant = null
  const sandbox = {
    module: {exports: {}}, HeaderBar: {}, OperationsWidget: {}, SessionOverlay: {},
    require(name) { assert.equal(name, './i18n'); return {} },
    getTenantContext() { return tenant },
    operationsKpi() { throw new Error('not an interval dependency') },
    startTokenRefresher() { calls.push('tokenRefresher') },
    indexInfo() { throw new Error('no API mock result') },
    indexTrigger() { throw new Error('no API mock result') },
    indexRestop() { throw new Error('no API mock result') },
    indexEgress() { throw new Error('no API mock result') },
    parseTimeFun() { throw new Error('not a timestamp test') },
    setInterval(fn, delay) { assert.equal(typeof fn, 'function'); timerDelays.push(delay); return ++timerID },
    clearInterval(id) { clears.push(id) },
  }
  if (!options.noStorage) sandbox.sessionStorage = {
    getItem(key) { reads.push(key); if (options.readThrows) throw new Error('storage unavailable'); return values.has(key) ? values.get(key) : null },
    setItem(key, value) { writes.push([key, value]); if (options.writeThrows) throw new Error('storage unavailable'); values.set(key, value) },
  }
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1].replace(/^import .+$/gm, '').replace('export default', 'module.exports =')
  vm.runInNewContext(script, sandbox, {filename: 'production-screen-index.vue'})
  const component = sandbox.module.exports
  function mount(userID = intervalInputs.user_id, tenantID = intervalInputs.tenant_id) {
    tenant = tenantID === null ? null : {id: tenantID}
    const store = {getters: {'account/user': userID === null ? null : {id: userID, name: 'ACTOR'}}}
    const state = {$store: store}
    Object.assign(state, component.data.call(state))
    for (const [name, method] of Object.entries(component.methods)) state[name] = method.bind(state)
    state.fetchAll = () => calls.push('fetchAll')
    state.fetchAlarms = () => calls.push('fetchAlarms')
    return state
  }
  return {mount, values, writes, reads, calls, timerDelays, clears}
}

const intervalKey = (user = intervalInputs.user_id, tenant = intervalInputs.tenant_id) => `${intervalInputs.storage_key_prefix}${user}:${tenant}`

test('screen remembers every allowed interval across same-account same-tenant component reconstruction', () => {
  for (const seconds of intervalInputs.allowed_intervals) {
    const h = intervalHarness(), first = h.mount()
    assert.equal(first.refreshInterval, intervalInputs.default_interval)
    first.onIntervalChange(seconds)
    assert.equal(first.refreshInterval, seconds)
    assert.deepEqual(h.calls, ['fetchAll'])
    assert.deepEqual(h.timerDelays, [seconds * 1000, Math.min(seconds * 1000, 10000)])
    assert.equal(h.values.get(intervalKey()), String(seconds))
    const reconstructed = h.mount()
    assert.equal(reconstructed.refreshInterval, seconds)
    reconstructed.startTimers()
    assert.deepEqual(h.timerDelays.slice(-2), [seconds * 1000, Math.min(seconds * 1000, 10000)])
  }
})

test('screen refresh preference is isolated by account and tenant within one tab', () => {
  const h = intervalHarness()
  h.mount().onIntervalChange(10)
  assert.equal(h.mount(intervalInputs.other_user_id).refreshInterval, 30)
  assert.equal(h.mount(intervalInputs.user_id, intervalInputs.other_tenant_id).refreshInterval, 30)
  h.mount(intervalInputs.user_id, intervalInputs.other_tenant_id).onIntervalChange(60)
  assert.equal(h.mount().refreshInterval, 10)
  assert.equal(h.mount(intervalInputs.user_id, intervalInputs.other_tenant_id).refreshInterval, 60)
  assert.deepEqual([...h.values.keys()].sort(), [intervalKey(), intervalKey(intervalInputs.user_id, intervalInputs.other_tenant_id)].sort())
  const anotherTab = intervalHarness()
  assert.equal(anotherTab.mount().refreshInterval, 30)
})

test('screen rejects absent and malformed per-tab interval values with default30', () => {
  assert.equal(intervalHarness().mount().refreshInterval, 30)
  for (const value of intervalInputs.invalid_stored_values) {
    const h = intervalHarness({initial: {[intervalKey()]: value}})
    assert.equal(h.mount().refreshInterval, 30, `invalid value ${JSON.stringify(value)}`)
    assert.equal(h.values.get(intervalKey()), value, 'invalid stored value is not silently rewritten')
  }
})

test('screen storage failure defaults new components without changing live selected10 timers', () => {
  const h = intervalHarness({readThrows: true, writeThrows: true}), state = h.mount()
  assert.equal(state.refreshInterval, 30)
  state.onIntervalChange(10)
  assert.equal(state.refreshInterval, 10)
  assert.deepEqual(h.writes, [[intervalKey(), '10']])
  assert.deepEqual(h.calls, ['fetchAll'])
  assert.deepEqual(h.timerDelays, [10000, 10000])
  assert.equal(h.mount().refreshInterval, 30)
  const unavailable = intervalHarness({noStorage: true}), live = unavailable.mount()
  assert.equal(live.refreshInterval, 30)
  assert.doesNotThrow(() => live.onIntervalChange(10))
  assert.equal(live.refreshInterval, 10)
  assert.deepEqual(unavailable.timerDelays, [10000, 10000])
})

test('screen never shares refresh preferences when account or tenant identity is unavailable', () => {
  for (const {user_id, tenant_id} of intervalInputs.invalid_identity_cases) {
    const h = intervalHarness({initial: {[intervalKey()]: '10'}}), state = h.mount(user_id, tenant_id)
    assert.equal(state.refreshInterval, 30)
    state.onIntervalChange(10)
    assert.equal(state.refreshInterval, 10)
    assert.deepEqual(h.writes, [])
    assert.deepEqual(h.timerDelays, [10000, 10000])
  }
})

test('screen reconstruction restores selected10 before existing session refresh and timer callbacks', () => {
  const h = intervalHarness()
  h.mount().onIntervalChange(10)
  const reconstructed = h.mount()
  reconstructed.sessionExpired = true
  h.calls.length = 0
  reconstructed.onSessionRestored()
  assert.equal(reconstructed.refreshInterval, 10)
  assert.equal(reconstructed.sessionExpired, false)
  assert.deepEqual(h.calls, ['tokenRefresher', 'fetchAll'])
  assert.deepEqual(h.timerDelays.slice(-2), [10000, 10000])
})
