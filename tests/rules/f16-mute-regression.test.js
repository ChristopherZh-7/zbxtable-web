const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const test = require('node:test')
const moment = require('moment')
const compiler = require('vue-template-compiler')

// Load the real component methods, not a second implementation of the rule.
// Service doubles only capture requests; this suite makes no network calls.
const webRoot = process.env.MUTES_TARGET || path.resolve(__dirname, '../..')
const filename = path.join(webRoot, 'src/pages/alarm/mutes.vue')
const source = fs.readFileSync(filename, 'utf8')
const template = compiler.parseComponent(source).template.content
moment.now = () => new Date(2026, 9, 9, 12, 1, 0).valueOf()
const clone = value => JSON.parse(JSON.stringify(value))
const record = () => ({
  id: 12, name: 'F16 mute regression', z_ids: '1',
  conditions: JSON.stringify([{ r_type: 'trigger', r_func: 'contains', r_value: 'F16' }]),
  s_week: '0,1,2,3,4,5,6', s_time: '00:00', e_time: '23:59',
  channel: 'mail', user_ids: '', group_ids: '', m_type: '3', status: '1',
  note: 'Only this fixture', created: '2026-10-09T12:00:00+08:00',
})

function loadPage() {
  const calls = []
  const service = name => (...args) => {
    calls.push({ name, args: clone(args) })
    return Promise.resolve({ data: { code: 200, message: 'fixture', data: { items: [], total: 0 } } })
  }
  const script = compiler.parseComponent(source).script.content
    .replace(/^import[^\n]*\n/gm, '')
    .replace('export default', 'module.exports =')
  const context = {
    module: { exports: {} }, moment,
    require: request => require(path.resolve(path.dirname(filename), request)),
    mapGetters: () => ({}), PageLayout: {}, themeMixin: {},
    parseTimeFun: require(path.join(webRoot, 'src/utils/formatter.js')).parseTimeFun,
    ruleList: service('ruleList'), ruleAdd: service('ruleAdd'), rulePut: service('rulePut'),
    ruleStatusPut: service('ruleStatusPut'), ruleDelete: service('ruleDelete'),
    listZabbixInstance: () => Promise.resolve({ data: { code: 200, data: [] } }),
  }
  vm.runInNewContext(script, context, { filename })
  const component = context.module.exports
  const messages = component.i18n.messages.CN
  const page = { $t: key => messages[key] || key, $message: { success() {}, error() {} } }
  Object.assign(page, component.data.call(page))
  for (const [key, method] of Object.entries(component.methods)) page[key] = method.bind(page)
  page.initOptions()
  return { page, component, calls }
}

function display(column, value, row, page) {
  if (column.customRender) {
    const rendered = column.customRender(value, row)
    return rendered && typeof rendered === 'object' ? rendered.children : rendered
  }
  return value
}

function observations() {
  const { page, component } = loadPage()
  page.seeEdit(record())
  page.changeDuration('86400')
  const permanent = clone(page.buildRulePayload())
  page.seeEdit(record())
  page.rule.note = 'Only the note changed'
  const disabledEdit = clone(page.buildRulePayload())
  page.seeEdit({ ...record(), status: '0', s_week: '1,3', s_time: '23:00', e_time: '01:00' })
  const crossMidnight = clone(page.buildRulePayload())
  page.changeDuration('86400')
  const selectedWeekdays = clone(page.buildRulePayload())
  const created = loadPage()
  created.page.showModal()
  Object.assign(created.page.rule, { name: 'F16 permanent create fixture', zid: ['1'], channel: ['mail'], conditions: JSON.parse(record().conditions) })
  created.page.changeDuration('86400')
  created.page.createRule()
  const permanentCreate = created.calls.find(item => item.name === 'ruleAdd').args[0]
  const durationColumn = page.columns.find(item => item.dataIndex === 'duration')
  const conditionColumn = page.columns.find(item => item.dataIndex === 'conditions')
  const duration = display(durationColumn, null, record(), page)
  const conditions = display(conditionColumn, record().conditions, record(), page)
  const time = page.formatRuleTime ? page.formatRuleTime('12:01') : component.filters.parsetime('12:01')
  const presets = page.tOptions.map(option => {
    page.changeDuration(option.value)
    const payload = page.buildRulePayload()
    return { value: option.value, label: option.label, s_time: payload.s_time, e_time: payload.e_time, s_week: payload.s_week }
  })
  return {
    source: filename, source_sha256: crypto.createHash('sha256').update(source).digest('hex'),
    fixed_now_local: '2026-10-09 12:01:00', scope: 'actual component methods with captured service calls; not native acceptance',
    permanent, permanent_create: permanentCreate, disabled_edit: disabledEdit, cross_midnight: crossMidnight, selected_weekdays: selectedWeekdays,
    display: { duration_title: durationColumn.title, duration, conditions, time }, presets,
  }
}

test('F16 mute observable original component payloads and display', () => {
  const result = observations()
  console.log('OBSERVED_MUTES=' + JSON.stringify(result))
  if (process.env.MUTES_PAYLOAD_OUTPUT) fs.writeFileSync(process.env.MUTES_PAYLOAD_OUTPUT, JSON.stringify(result, null, 2) + '\n')
  assert.equal(result.permanent.s_time, '00:00')
  assert.equal(result.permanent.e_time, '23:59')
  assert.equal(result.disabled_edit.status, '1')
  assert.equal(result.display.duration, '24小时')
  assert.equal(result.display.time, '12:01')
})

test('F16 permanent preserves selected weekdays, status, conditions and mute-only payload boundary', () => {
  const { page } = loadPage()
  page.seeEdit({ ...record(), s_week: '1,3' })
  page.rule.user_ids = 'must-not-become-a-recipient'
  page.rule.group_ids = 'must-not-become-a-recipient'
  const before = clone(page.rule.conditions)
  page.changeDuration('86400')
  const payload = page.buildRulePayload()
  assert.equal(payload.s_time, '00:00')
  assert.equal(payload.e_time, '23:59')
  assert.equal(payload.s_week, '1,3')
  assert.equal(payload.status, '1')
  assert.deepEqual(JSON.parse(payload.conditions), before)
  assert.equal(payload.z_ids, '1')
  assert.equal(payload.channel, 'mail')
  assert.equal(payload.m_type, '3')
  assert.equal(payload.user_ids, '')
  assert.equal(payload.group_ids, '')
})

for (const status of ['0', '1', 0, 1]) {
  test(`F16 note-only edit preserves returned status ${JSON.stringify(status)}`, () => {
    const { page, calls } = loadPage()
    const input = { ...record(), status }
    page.seeEdit(input)
    page.rule.note = 'Only the note changed'
    page.updateRule()
    const call = calls.find(item => item.name === 'rulePut')
    assert.equal(call.args[0], input.id)
    assert.equal(call.args[1].status, String(status))
    assert.equal(call.args[1].note, 'Only the note changed')
    for (const field of ['conditions', 's_time', 'e_time', 's_week', 'z_ids', 'channel', 'm_type']) assert.equal(call.args[1][field], input[field])
    assert.equal(input.status, status)
  })
}

test('F16 missing or invalid readback status is not silently enabled during edit', () => {
  const { page } = loadPage()
  for (const status of [null, undefined, '', '2', 'invalid']) {
    page.seeEdit({ ...record(), status })
    assert.notEqual(page.buildRulePayload().status, '0', String(status))
  }
})

test('F16 explicit enable and disable still use the existing status-only service contract', async () => {
  const { page, calls } = loadPage()
  const input = record()
  page.onStatusChange(true, input)
  page.onStatusChange(false, input)
  await Promise.resolve()
  const changes = calls.filter(item => item.name === 'ruleStatusPut')
  assert.deepEqual(changes.map(item => item.args), [[12, { status: '0' }], [12, { status: '1' }]])
})

test('F16 permanent create and readback/edit serialize the same HH:mm fields without deriving expiry', () => {
  const { page, calls } = loadPage()
  page.showModal()
  Object.assign(page.rule, { name: 'create fixture', zid: ['1'], channel: ['mail'], conditions: JSON.parse(record().conditions) })
  page.changeDuration('86400')
  page.createRule()
  const created = calls.find(item => item.name === 'ruleAdd').args[0]
  assert.equal(created.s_time, '00:00')
  assert.equal(created.e_time, '23:59')
  assert.equal(created.status, '0')
  page.seeEdit({ ...created, id: 123 })
  const edited = page.buildRulePayload()
  for (const field of ['conditions', 's_time', 'e_time', 's_week', 'status', 'z_ids', 'channel', 'm_type']) assert.equal(edited[field], created[field])
})

test('F16 duration describes daily inclusive minute coverage, including cross-midnight and equal endpoints', () => {
  const { page } = loadPage()
  const column = page.columns.find(item => item.dataIndex === 'duration')
  assert.match(column.title, /每日.*窗口.*起止分钟/)
  for (const [s_time, e_time, expected] of [
    ['00:00', '23:59', '24小时'], ['12:01', '12:01', '1分钟'],
    ['23:00', '01:00', '2小时1分钟'], ['09:00', '18:00', '9小时1分钟'],
    ['23:59', '00:00', '2分钟'], ['00:01', '00:00', '24小时'],
  ]) assert.equal(display(column, null, { s_time, e_time }, page), expected)
})

test('F16 invalid or empty time windows have no fabricated duration', () => {
  const { page } = loadPage()
  const column = page.columns.find(item => item.dataIndex === 'duration')
  for (const value of [null, undefined, '', ' ', 0, '24:00', '9:05', '12:60', '2026-10-09T12:00:00Z', 'x']) {
    assert.equal(display(column, null, { s_time: value, e_time: '23:59' }, page), '-')
    assert.equal(display(column, null, { s_time: '00:00', e_time: value }, page), '-')
  }
})

test('F16 HH:mm time slots do not pass recurring windows through a calendar-date filter', () => {
  const { page, component } = loadPage()
  for (const value of ['00:00', '12:01', '23:59']) assert.equal(page.formatRuleTime(value), value)
  for (const value of [null, undefined, '', ' ', 0, false, '24:00', '9:01', '12:60']) assert.equal(page.formatRuleTime(value), '-')
  assert.match(template, /slot="s_time"[^>]*>\{\{ formatRuleTime\(text\) \}\}/)
  assert.match(template, /slot="e_time"[^>]*>\{\{ formatRuleTime\(text\) \}\}/)
  assert.match(template, /slot="created"[^>]*>\{\{ text \| parsetime \}\}/)
  assert.equal(component.filters.parsetime(record().created), require(path.join(webRoot, 'src/utils/formatter.js')).parseTimeFun(record().created))
})

test('F16 invalid readback times stay empty for validation rather than becoming midnight/all-day', () => {
  const { page } = loadPage()
  for (const value of [null, undefined, '', ' ', '24:00', '9:01', '12:60', 'invalid']) {
    page.seeEdit({ ...record(), s_time: value, e_time: value })
    const payload = page.buildRulePayload()
    assert.equal(payload.s_time, '')
    assert.equal(payload.e_time, '')
  }
  page.changeStime(null)
  page.changeEtime(null)
  assert.equal(page.buildRulePayload().s_time, '')
  assert.equal(page.buildRulePayload().e_time, '')
})

test('F16 cross-midnight edit keeps exact recurring start/end/weekday values', () => {
  const { page } = loadPage()
  const input = { ...record(), s_time: '23:00', e_time: '01:00', s_week: '1,3', status: '0' }
  page.seeEdit(input)
  for (const field of ['s_time', 'e_time', 's_week', 'status']) assert.equal(page.buildRulePayload()[field], input[field])
})

test('F16 readable AND summary translates all supported fields and operators without raw JSON', () => {
  const { page } = loadPage()
  const column = page.columns.find(item => item.dataIndex === 'conditions')
  const fields = ['host', 'group', 'item', 'key', 'trigger', 'severity']
  const operators = ['==', 'contains', '!=', '=~']
  const values = fields.map((r_type, index) => ({ r_type, r_func: operators[index % 4], r_value: r_type === 'severity' ? '0' : `value-${index}` }))
  const output = display(column, JSON.stringify(values), {}, page)
  for (const field of page.rTypeOptions) assert.ok(output.includes(field.label))
  for (const operator of page.rFuncOptions) assert.ok(output.includes(operator.label))
  assert.equal(output.split(' AND ').length, values.length)
  assert.doesNotMatch(output, /r_type|r_func|r_value/)
  assert.equal(display(column, values, {}, page), output)
})

test('F16 empty conditions are distinct from malformed input and summaries never throw', () => {
  const { page } = loadPage()
  const column = page.columns.find(item => item.dataIndex === 'conditions')
  for (const value of [null, undefined, '', [], '[]']) assert.equal(display(column, value, {}, page), '-')
  for (const value of ['not-json', '{}', 'null', '[null]', [{ r_type: 'host' }], 0, false]) {
    assert.equal(display(column, value, {}, page), '条件格式无效')
  }
})

test('F16 conditions remain text, including HTML-looking values, and the real template compiles', () => {
  const { page } = loadPage()
  const column = page.columns.find(item => item.dataIndex === 'conditions')
  const hostileText = '<img src=x onerror="window.__fixtureXss=true">'
  const output = display(column, [{ r_type: 'trigger', r_func: 'contains', r_value: hostileText }], {}, page)
  assert.ok(output.includes(hostileText))
  assert.equal(typeof output, 'string')
  assert.doesNotMatch(template, /v-html/)
  const compiled = compiler.compile(template)
  assert.deepEqual(compiled.errors, [])
})

test('F16 empty/invalid duration selections do not reset the configured time window', () => {
  const { page } = loadPage()
  page.seeEdit(record())
  const before = page.buildRulePayload()
  for (const value of [null, undefined, '', ' ', 'NaN', 'Infinity', '-1', '0', {}, ['1']]) {
    page.changeDuration(value)
    const payload = page.buildRulePayload()
    assert.equal(payload.s_time, before.s_time)
    assert.equal(payload.e_time, before.e_time)
  }
})

test('F16 existing non-permanent presets remain observable, not silently redefined', () => {
  const { page } = loadPage()
  const cases = [['1', '13:01'], ['2', '14:01'], ['3', '15:01'], ['6', '18:01'], ['12', '00:01'], ['24', '12:01'], ['48', '12:01']]
  for (const [value, end] of cases) {
    page.changeDuration(value)
    assert.equal(page.buildRulePayload().s_time, '12:01')
    assert.equal(page.buildRulePayload().e_time, end)
  }
})
