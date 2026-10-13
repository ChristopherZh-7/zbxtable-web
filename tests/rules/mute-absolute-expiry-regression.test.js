const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const moment = require('moment')
const compiler = require('vue-template-compiler')
moment.now = () => Date.parse('2026-10-10T23:59:30+08:00')

// Execute actual component methods. Service doubles capture writes, not server acceptance.
const webRoot = process.env.MUTE_EXPIRY_TARGET || path.resolve(__dirname, '../..')
const filename = path.join(webRoot, 'src/pages/alarm/mutes.vue')
const source = fs.readFileSync(filename, 'utf8')
const parsed = compiler.parseComponent(source)
const clone = value => JSON.parse(JSON.stringify(value))
const presets = [[3600, '1小时'], [7200, '2小时'], [18000, '5小时'], [28800, '8小时'], [43200, '12小时'], [86400, '1天'], [172800, '2天'], [432000, '5天'], [604800, '7天'], [1209600, '14天'], [2592000, '30天'], [5184000, '60天'], [7776000, '90天']]
const legacy = () => ({ id: 41, name: 'legacy', m_type: '3', z_ids: '1', channel: 'mail', status: '1', conditions: '[{"r_type":"trigger","r_func":"contains","r_value":"fixture"}]', s_week: '1,3', s_time: '23:00', e_time: '01:00', created: '2026-10-10T23:59:30+08:00', note: 'fixture' })
const absolute = () => ({ ...legacy(), time_mode: 'absolute', s_week: '', s_time: '', e_time: '', expires_at: '2026-10-11T00:59:30+08:00', server_now: '2026-10-11T00:59:30+08:00' })

function loadPage(locale = 'CN') {
  const calls = [], errors = []
  const service = name => (...args) => {
    calls.push({ name, args: clone(args) })
    return Promise.resolve({ data: { code: 200, message: 'fixture', data: { items: [], total: 0 } } })
  }
  const context = { module: { exports: {} }, moment, mapGetters: () => ({}), PageLayout: {}, themeMixin: {},
    require: name => require(path.resolve(path.dirname(filename), name)),
    parseTimeFun: require(path.join(webRoot, 'src/utils/formatter.js')).parseTimeFun,
    ruleList: service('ruleList'), ruleAdd: service('ruleAdd'), rulePut: service('rulePut'), ruleStatusPut: service('ruleStatusPut'), ruleDelete: service('ruleDelete'),
    listZabbixInstance: () => Promise.resolve({ data: { code: 200, data: [] } }),
  }
  vm.runInNewContext(parsed.script.content.replace(/^import[^\n]*\n/gm, '').replace('export default', 'module.exports ='), context, { filename })
  const component = context.module.exports
  const page = { $t: key => component.i18n.messages[locale][key] || key, $message: { success() {}, error(value) { errors.push(value) } } }
  Object.assign(page, component.data.call(page))
  for (const [key, method] of Object.entries(component.methods)) page[key] = method.bind(page)
  page.initOptions()
  return { page, calls, errors, component }
}
function newPage() {
  const result = loadPage()
  result.page.showModal()
  Object.assign(result.page.rule, { name: 'absolute fixture', zid: ['1'], channel: ['mail'], conditions: JSON.parse(legacy().conditions), status: '1' })
  return result
}
function assertNoAuthority(payload) {
  for (const key of ['created', 'expires_at', 'server_now', 'duration']) assert.equal(Object.hasOwn(payload, key), false, key)
}

test('absolute create sends a server-duration request, not a browser deadline or recurring window', () => {
  const { page, calls } = newPage()
  page.createRule()
  const payload = calls.find(row => row.name === 'ruleAdd').args[0]
  console.log('OBSERVED_ABSOLUTE_CREATE=' + JSON.stringify(payload))
  assert.equal(payload.time_mode, 'absolute')
  assert.equal(payload.duration_seconds, 3600)
  assertNoAuthority(payload)
  for (const key of ['s_week', 's_time', 'e_time']) assert.equal(payload[key], '')
  assert.equal(payload.status, '1')
  assert.equal(payload.m_type, '3')
  assert.equal(payload.user_ids, '')
  assert.equal(payload.group_ids, '')
  assert.equal(payload.conditions, legacy().conditions)
})

for (const [seconds, label] of presets) {
  test(`temporary preset ${label} submits exactly ${seconds} seconds including multi-day choices`, () => {
    const { page } = newPage()
    const option = page.absoluteDurationOptions.find(item => item.label === label)
    assert.equal(option.value, seconds)
    page.absoluteDuration = option.value
    const payload = page.buildRulePayload()
    assert.equal(payload.time_mode, 'absolute')
    assert.equal(payload.duration_seconds, seconds)
    assert.equal(typeof payload.duration_seconds, 'number')
    assertNoAuthority(payload)
    assert.equal(payload.s_week + payload.s_time + payload.e_time, '')
  })
}

test('invalid absolute duration does not submit or silently become permanent', () => {
  const { page, calls, errors } = newPage()
  for (const value of [null, undefined, '', '3600', ' ', 0, -1, 3600.5, NaN, Infinity, 9007199254740991, 7776001, {}, [3600]]) {
    page.absoluteDuration = value
    page.createRule()
    assert.equal(calls.filter(call => call.name === 'ruleAdd').length, 0, String(value))
  }
  assert.equal(errors.length, 14)
})

for (const status of ['0', '1', 0, 1]) {
  test(`ordinary absolute edit preserves status ${status} and never renews or converts`, () => {
    const { page, calls } = loadPage()
    const input = { ...absolute(), status }
    page.seeEdit(input)
    page.rule.note = 'note-only'
    page.updateRule()
    const payload = calls.find(row => row.name === 'rulePut').args[1]
    assert.equal(payload.note, 'note-only')
    assert.equal(payload.status, String(status))
    assert.equal(page.rule.created, input.created)
    assert.equal(page.rule.expires_at, input.expires_at)
    assert.equal(page.rule.time_mode, 'absolute')
    assert.equal(page.expiryState(page.rule), 'expired')
    assertNoAuthority(payload)
    assert.equal(Object.hasOwn(payload, 'time_mode'), false)
    assert.equal(Object.hasOwn(payload, 'duration_seconds'), false)
    for (const key of ['s_week', 's_time', 'e_time', 'conditions', 'channel', 'z_ids']) assert.equal(payload[key], input[key])
    assert.equal(input.note, 'fixture')
  })
}

test('legacy weekday and cross-midnight edit is not converted and keeps exact fields', () => {
  const { page } = loadPage()
  for (const time_mode of [undefined, null, '', 'weekly']) {
    const input = { ...legacy(), time_mode }
    page.seeEdit(input)
    const payload = page.buildRulePayload()
    for (const key of ['status', 's_week', 's_time', 'e_time', 'conditions']) assert.equal(payload[key], input[key])
    for (const key of ['time_mode', 'duration_seconds', 'expires_at', 'created', 'server_now']) assert.equal(Object.hasOwn(payload, key), false)
  }
})

test('permanent mode keeps the existing sentinel, all-day and selected-weekday meaning', () => {
  const { page } = newPage()
  page.rule.s_week = ['1', '3']
  page.changeTimeMode('permanent')
  const payload = page.buildRulePayload()
  assert.equal(payload.s_week, '1,3')
  assert.equal(payload.s_time, '00:00')
  assert.equal(payload.e_time, '23:59')
  assert.equal(Object.hasOwn(payload, 'time_mode'), false)
  assert.equal(Object.hasOwn(payload, 'duration_seconds'), false)
  assertNoAuthority(payload)
  page.changeTimeMode('absolute')
  assert.equal(page.buildRulePayload().duration_seconds, 3600)
  page.changeTimeMode('weekly')
  assert.equal(page.buildRulePayload().s_week, '1,3')
  assert.equal(Object.hasOwn(page.buildRulePayload(), 'duration_seconds'), false)
})

test('expired rules stay expired with server reference despite browser clock offsets and policy enable', async () => {
  const { page, calls } = loadPage()
  const now = moment.now
  try {
    for (const shift of [-48, 0, 48]) {
      moment.now = () => Date.parse('2026-10-11T00:00:00Z') + shift * 3600000
      for (const status of ['0', '1']) assert.equal(page.expiryState({ ...absolute(), status }), 'expired')
    }
    page.onStatusChange(true, absolute())
    page.onStatusChange(false, absolute())
    await Promise.resolve()
    assert.deepEqual(calls.filter(call => call.name === 'ruleStatusPut').map(call => call.args), [[41, { status: '0' }], [41, { status: '1' }]])
  } finally { moment.now = now }
})

test('server validity uses half-open absolute interval with equivalent timezone offsets', () => {
  const { page } = loadPage()
  const row = absolute()
  for (const [server_now, expected] of [
    ['2026-10-10T23:59:29+08:00', 'pending'], ['2026-10-10T23:59:30+08:00', 'active'],
    ['2026-10-11T00:59:29+08:00', 'active'], ['2026-10-11T00:59:30+08:00', 'expired'],
    ['2026-10-10T16:59:30Z', 'expired'], ['2026-10-11T00:59:31+08:00', 'expired'],
  ]) assert.equal(page.expiryState({ ...row, server_now }), expected)
})

test('missing server time is explicitly unconfirmed, never a browser-clock fallback', () => {
  const { page } = loadPage()
  for (const server_now of [null, undefined, '', ' ', 'not-time', 0, '2026-10-11T00:59:30']) {
    const row = { ...absolute(), server_now }
    assert.equal(page.expiryState(row), 'unconfirmed')
    assert.match(page.expiryLabel(row), /服务端确认/)
  }
})

test('missing corrupt or inconsistent deadlines never look permanent or valid', () => {
  const { page } = loadPage()
  for (const expires_at of [null, undefined, '', ' ', false, 0, 'invalid', '2026-02-30T00:00:00Z', '2026-10-11T00:59:30', legacy().created, '2026-10-10T22:59:30+08:00']) {
    assert.equal(page.expiryState({ ...absolute(), expires_at }), 'invalid', String(expires_at))
  }
  assert.equal(page.expiryState({ ...absolute(), time_mode: 'unknown' }), 'invalid')
  assert.equal(page.expiryState({ ...absolute(), time_mode: 'weekly' }), 'invalid')
  assert.equal(page.expiryState(legacy()), 'weekly')
})

test('malformed legacy expiry and mixed absolute windows are not labelled valid', () => {
  const { page } = loadPage()
  for (const expires_at of [false, 0, 'invalid', '2026-10-11T00:59:30Z']) assert.equal(page.expiryState({ ...legacy(), expires_at }), 'invalid')
  for (const key of ['s_week', 's_time', 'e_time']) assert.equal(page.expiryState({ ...absolute(), [key]: key === 's_week' ? '1,3' : '00:00' }), 'invalid')
})

test('invalid creation mode cannot silently submit a permanent or weekly rule', () => {
  const { page, calls } = newPage()
  for (const value of [null, undefined, '', 'future', 'Absolute', {}, 0]) {
    page.timeMode = value
    page.createRule()
    assert.equal(calls.filter(call => call.name === 'ruleAdd').length, 0)
  }
})

test('host quick-mute route also defaults to server-anchored absolute creation', () => {
  const { page, component } = loadPage()
  page.$route = { query: { hostid: '101', host: 'Fixture host', message: 'Fixture alarm', tenantid: '1' } }
  page.$store = { state: { account: { user: { name: 'Fixture admin' } } } }
  component.created.call(page)
  const payload = page.buildRulePayload()
  assert.equal(payload.time_mode, 'absolute')
  assert.equal(payload.duration_seconds, 3600)
  assert.equal(payload.conditions, '[{"r_type":"host","r_func":"==","r_value":"Fixture host"},{"r_type":"trigger","r_func":"==","r_value":"Fixture alarm"}]')
  assert.equal(payload.s_week + payload.s_time + payload.e_time, '')
  assertNoAuthority(payload)
})

test('server timestamp display keeps date and explicit timezone and has no fabricated zero', () => {
  const { page } = loadPage()
  assert.equal(page.formatServerTimestamp(absolute().created), '2026-10-10 23:59:30 +08:00')
  assert.equal(page.formatServerTimestamp(absolute().expires_at), '2026-10-11 00:59:30 +08:00')
  for (const value of [null, undefined, '', ' ', 0, false, 'invalid', '2026-02-30T00:00:00Z']) assert.equal(page.formatServerTimestamp(value), '-')
})

test('editing mode cannot be converted using the creation-mode handler', () => {
  const { page } = loadPage()
  page.seeEdit(absolute())
  const before = clone(page.rule)
  for (const value of ['weekly', 'permanent', 'absolute', 'unknown']) page.changeTimeMode(value)
  assert.deepEqual(clone(page.rule), before)
})

test('payload strips read-only server fields even if injected into form state', () => {
  const { page } = newPage()
  Object.assign(page.rule, { created: 'forged', expires_at: 'forged', server_now: 'forged', duration_seconds: 7776000, time_mode: 'weekly', user_ids: 'unsafe', group_ids: 'unsafe' })
  const payload = page.buildRulePayload()
  assertNoAuthority(payload)
  assert.equal(payload.duration_seconds, 3600)
  assert.equal(payload.time_mode, 'absolute')
  assert.equal(payload.user_ids, '')
  assert.equal(payload.group_ids, '')
})

test('all three locales provide separate mode, server validity, expired and no-renewal copy', () => {
  for (const locale of ['CN', 'US', 'HK']) {
    const { page, component } = loadPage(locale)
    for (const key of ['mutes_time_mode', 'mutes_time_absolute', 'mutes_time_permanent', 'mutes_time_weekly', 'mutes_expires_at', 'mutes_expiry_expired', 'mutes_expiry_unconfirmed', 'mutes_expiry_edit_hint', 'mutes_server_reference_hint']) assert.notEqual(component.i18n.messages[locale][key], undefined, locale + ':' + key)
    assert.equal(page.absoluteDurationOptions.length, 13)
  }
})

test('real template compiles and routes new durations separately from the legacy hour adapter', () => {
  assert.deepEqual(compiler.compile(parsed.template.content).errors, [])
  assert.match(parsed.template.content, /data-testid="mute-time-mode"/)
  assert.match(parsed.template.content, /data-testid="mute-absolute-duration"/)
  assert.match(parsed.template.content, /v-model="absoluteDuration"/)
  assert.doesNotMatch(parsed.template.content, /v-for="\(item, index\) in tOptions"/)
  assert.match(parsed.template.content, /slot="expires_at"/)
  assert.match(parsed.template.content, /slot="validity"/)
  assert.doesNotMatch(parsed.template.content, /v-html/)
})

test('actual payload observation is reproducible and source-hash bound', () => {
  const { page } = newPage()
  const created = clone(page.buildRulePayload())
  page.seeEdit(absolute())
  const edited = clone(page.buildRulePayload())
  const result = { source: filename, source_sha256: crypto.createHash('sha256').update(source).digest('hex'), created, edited, scope: 'actual component methods/local service doubles;not native API acceptance' }
  console.log('OBSERVED_MUTE_EXPIRY=' + JSON.stringify(result))
  if (process.env.MUTE_EXPIRY_PAYLOAD_OUTPUT) fs.writeFileSync(process.env.MUTE_EXPIRY_PAYLOAD_OUTPUT, JSON.stringify(result, null, 2) + '\n')
  assert.equal(created.time_mode, 'absolute')
  assert.equal(Object.hasOwn(edited, 'duration_seconds'), false)
})
