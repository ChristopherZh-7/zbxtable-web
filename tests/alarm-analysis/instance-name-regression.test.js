const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {canPerform} = require('../../src/utils/permission-policy')

const query = fs.readFileSync(path.join(__dirname, '../../src/pages/alarm/query.vue'), 'utf8')
const viewer = [{id: 'tenant.alarms', operation: ['read']}]
const tenantAdmin = [{id: 'tenant.alarms', operation: ['read', 'export', 'operate']}]
const platformAdmin = [...tenantAdmin, {id: 'platform.zabbix', operation: ['read']}]
const unknown = 'msg_unknown'

// Run the real component methods, with explicit local service fixtures. These
// are source/logic tests, not a browser, API authorization, or ingestion proof.
function componentMethod(name, bindings = {}, indentation = '    ') {
  const start = query.indexOf(`${indentation}${name}(`)
  assert.notEqual(start, -1, `missing component method: ${name}`)
  const end = query.indexOf(`\n${indentation}},`, start)
  assert.notEqual(end, -1, `missing component method end: ${name}`)
  const method = query.slice(start, end + indentation.length + 2).trim()
  return new Function(...Object.keys(bindings), `return ({${method}}).${name}`)(...Object.values(bindings))
}

const settle = () => new Promise(resolve => setImmediate(resolve))
function fixture(permissions = viewer) {
  const observations = {instanceRequests: 0, configRequests: 0, alarmRequests: [], errors: []}
  const requests = []
  const vm = {
    $t: value => value,
    $can: (resource, action) => canPerform(permissions, resource, action),
    role: 'platform_admin', // Cached role text must not grant a fallback.
    instanceMap: {101: 'OLD_ADMIN_NAME', 202: 'OTHER_ADMIN_NAME'}, instanceList: [],
    sourceTenantKey: 'TENANT_A', listSequence: 0, handlingSequence: 0,
    list: [], expandedAlarmKeys: [], pagination: {total: 0},
    page: 1, pageSize: 10, hosts: '', hostIp: '', status: '', level: '',
    selectedInstance: '', beginTime: '', endTime: '', loading: false,
    alarmAnalysisPrompt: '', handlingRecord: null, handlingDetail: null,
    initOptions() {}, initColumns() {},
    applyTimeRange(value) { this.lastTimeRange = value },
  }
  const bindings = {
    window: {addEventListener() {}},
    tenantContextChangingEvent: 'unit-tenant-context-changing',
    buildAlarmTimeRanges: () => [], getDefaultAlarmTimeRange: () => ['DEFAULT_BEGIN', 'DEFAULT_END'],
    alarm(input) {
      observations.alarmRequests.push({...input})
      return new Promise(resolve => requests.push(resolve))
    },
    listZabbixInstance() {
      observations.instanceRequests++
      return Promise.resolve({data: {code: 200, data: [
        {id: 101, name: 'LIVE_ADMIN_NAME', enabled: true},
        {id: 202, name: 'DISABLED_ADMIN_NAME', enabled: false},
      ]}})
    },
    configGetList() {
      observations.configRequests++
      return Promise.resolve({data: {code: 200, data: {items: []}}})
    },
    console: {error: (...args) => observations.errors.push(args)},
  }
  for (const name of ['getInstanceName', 'loadInstances', 'loadAlarmAnalysisPrompt', 'init', 'invalidateAlarmContext', 'closeHandling', 'resetData', 'changePage']) {
    vm[name] = componentMethod(name, bindings).bind(vm)
  }
  return {
    vm, observations,
    created: componentMethod('created', bindings, '  ').bind(vm),
    respond(index, items, total = items.length) {
      requests[index]({data: {code: 200, data: {items, total}}})
    },
  }
}

for (const [label, permissions] of [['viewer', viewer], ['tenant administrator', tenantAdmin]]) {
  test(`authorized alarm row name renders for ${label} without platform metadata`, () => {
    const {vm, observations} = fixture(permissions)
    assert.equal(vm.getInstanceName({id: 1, zid: 101, instance_name: '租户授权实例 A'}), '租户授权实例 A')
    assert.equal(observations.instanceRequests, 0)
  })
}

test('server row name has priority over a stale platform administrator map', () => {
  const {vm} = fixture(platformAdmin)
  assert.equal(vm.getInstanceName({zid: 101, instance_name: 'RENAMED_AUTHORIZED_INSTANCE'}), 'RENAMED_AUTHORIZED_INSTANCE')
})

const invalidFields = [
  ['empty', ''], ['whitespace', ' \t\n '], ['null', null], ['undefined', undefined],
  ['number', 101], ['zero', 0], ['boolean', false], ['array', ['FORGED']], ['object', {name: 'FORGED'}],
]
for (const [label, value] of invalidFields) {
  test(`explicit ${label} instance_name stays unknown despite a privileged old cache`, () => {
    const {vm} = fixture(platformAdmin)
    assert.equal(vm.getInstanceName({zid: 101, instance_name: value}), unknown)
  })
}

test('old backend field absence retains permitted administrator map fallback', () => {
  const {vm} = fixture(platformAdmin)
  assert.equal(vm.getInstanceName({zid: 101}), 'OLD_ADMIN_NAME')
  assert.equal(vm.getInstanceName({zid: '202'}), 'OTHER_ADMIN_NAME')
})

test('old backend field absence never grants viewer or tenant administrator a cached name', () => {
  for (const permissions of [viewer, tenantAdmin, [], undefined]) {
    const {vm} = fixture(permissions)
    assert.equal(vm.getInstanceName({zid: 101}), unknown)
  }
})

test('current permission revocation removes old backend name fallback without changing cached role text', () => {
  const permissions = [...platformAdmin]
  const {vm} = fixture(permissions)
  assert.equal(vm.getInstanceName({zid: 101}), 'OLD_ADMIN_NAME')
  permissions.length = 0
  assert.equal(vm.getInstanceName({zid: 101}), unknown)
})

test('missing or unknown legacy ZID is not rendered as an invented instance name', () => {
  const {vm} = fixture(platformAdmin)
  for (const record of [{}, {zid: null}, {zid: 0}, {zid: ''}, {zid: 9999}]) {
    assert.equal(vm.getInstanceName(record), unknown)
  }
})

test('missing or nonrecord input is unknown rather than using a primitive as a map key', () => {
  const {vm} = fixture(platformAdmin)
  for (const record of [null, undefined, false, 101, '101']) {
    assert.equal(vm.getInstanceName(record), unknown)
  }
})

test('instance_name must be the row own field, not an inherited display value', () => {
  const {vm} = fixture(viewer)
  const record = Object.assign(Object.create({instance_name: 'INHERITED_FOREIGN_NAME'}), {zid: 101})
  assert.equal(vm.getInstanceName(record), unknown)
})

test('own field detection handles null-prototype rows and a shadowed hasOwnProperty', () => {
  const {vm} = fixture(viewer)
  const record = Object.assign(Object.create(null), {zid: 101, instance_name: 'SAFE_NAME', hasOwnProperty: false})
  assert.equal(vm.getInstanceName(record), 'SAFE_NAME')
})

test('multiple authorized instance names remain row-local, including a new server name after reload', () => {
  const {vm} = fixture(viewer)
  const rows = [{zid: 101, instance_name: 'A'}, {zid: 202, instance_name: 'B'}, {zid: 101, instance_name: 'A renamed'}]
  assert.deepEqual(rows.map(row => vm.getInstanceName(row)), ['A', 'B', 'A renamed'])
})

test('instance slot passes the complete row and keeps Vue escaped text interpolation', () => {
  const slot = query.match(/<div slot="instance_name" slot-scope="record">([\s\S]*?)<\/div>/)
  assert.ok(slot, 'native instance column slot remains present')
  assert.match(slot[1], /\{\{\s*getInstanceName\(record\)\s*\}\}/)
  assert.doesNotMatch(slot[1], /v-html|innerHTML|getInstanceName\(record\.zid\)/)
  const {vm} = fixture(viewer)
  const text = '<img src=x onerror="alert(1)"> & "租户实例"'
  assert.equal(vm.getInstanceName({zid: 101, instance_name: text}), text)
})

test('viewer created keeps ISSUE005 permission guard and makes only the authorized alarm query', async () => {
  const setup = fixture(viewer)
  setup.created()
  setup.respond(0, [{id: 1, zid: 101, instance_name: 'VIEWER_VISIBLE'}])
  await settle()
  assert.equal(setup.observations.instanceRequests, 0)
  assert.equal(setup.observations.configRequests, 0)
  assert.equal(setup.observations.alarmRequests.length, 1)
  assert.deepEqual(setup.observations.errors, [])
  assert.equal(setup.vm.getInstanceName(setup.vm.list[0]), 'VIEWER_VISIBLE')
})

test('platform administrator keeps enabled-instance loading and the management-only selector', async () => {
  const setup = fixture([...platformAdmin, {id: 'platform.system', operation: ['read']}])
  setup.created()
  setup.respond(0, [])
  await settle()
  assert.equal(setup.observations.instanceRequests, 1)
  assert.equal(setup.observations.configRequests, 1)
  assert.deepEqual(setup.vm.instanceList, [{id: 101, name: 'LIVE_ADMIN_NAME', enabled: true}])
  assert.deepEqual(setup.vm.instanceMap, {101: 'LIVE_ADMIN_NAME'})
  assert.match(query, /v-if="\$can\('platform\.zabbix', 'read'\)" :label="\$t\('label_select_instance'\)"/)
})

test('pagination and reset use fresh row names while preserving exact filter request semantics', async () => {
  const setup = fixture(viewer)
  Object.assign(setup.vm, {hosts: 'unique host', hostIp: '192.0.2.', status: '0', level: '0', selectedInstance: 101, beginTime: 'BEGIN', endTime: 'END'})
  setup.vm.init()
  setup.respond(0, [{id: 1, zid: 101, instance_name: 'FIRST_NAME'}], 20)
  await settle()
  assert.equal(setup.vm.getInstanceName(setup.vm.list[0]), 'FIRST_NAME')
  setup.vm.changePage({current: 2, pageSize: 10})
  setup.respond(1, [{id: 11, zid: 101, instance_name: 'SECOND_PAGE_NAME'}], 20)
  await settle()
  assert.equal(setup.observations.alarmRequests[1].page, 2)
  assert.equal(setup.observations.alarmRequests[1].status, '0')
  assert.equal(setup.observations.alarmRequests[1].level, '0')
  assert.equal(setup.observations.alarmRequests[1].zid, 101)
  assert.equal(setup.vm.getInstanceName(setup.vm.list[0]), 'SECOND_PAGE_NAME')
  setup.vm.resetData()
  setup.respond(2, [{id: 12, zid: 202, instance_name: 'RESET_NAME'}])
  await settle()
  const reset = setup.observations.alarmRequests[2]
  for (const field of ['hosts', 'host_ip', 'status', 'level']) assert.equal(reset[field], '')
  assert.equal(Object.hasOwn(reset, 'zid'), false)
  assert.deepEqual(setup.vm.lastTimeRange, ['DEFAULT_BEGIN', 'DEFAULT_END'])
  assert.equal(setup.vm.getInstanceName(setup.vm.list[0]), 'RESET_NAME')
})

test('tenant invalidation and the existing response epoch prevent stale row names from returning', async () => {
  const setup = fixture(platformAdmin)
  setup.vm.list = [{id: 1, zid: 101, instance_name: 'OLD_TENANT_NAME'}]
  setup.vm.handlingRecord = setup.vm.list[0]
  setup.vm.handlingDetail = {alarm_id: 1}
  setup.vm.init()
  setup.vm.invalidateAlarmContext()
  setup.vm.sourceTenantKey = 'TENANT_B'
  assert.deepEqual(setup.vm.list, [])
  assert.equal(setup.vm.handlingRecord, null)
  assert.equal(setup.vm.handlingDetail, null)
  setup.respond(0, [{id: 1, zid: 101, instance_name: 'STALE_TENANT_NAME'}])
  await settle()
  assert.deepEqual(setup.vm.list, [])
  setup.vm.init()
  setup.respond(1, [{id: 2, zid: 101, instance_name: ''}])
  await settle()
  // Do not refactor the legacy request/cache lifecycle for this display repair.
  assert.equal(setup.vm.instanceMap[101], 'OLD_ADMIN_NAME')
  assert.equal(setup.vm.getInstanceName(setup.vm.list[0]), unknown)
})

test('a newer same-tenant query wins even when an older named page arrives later', async () => {
  const setup = fixture(viewer)
  setup.vm.init(); setup.vm.init()
  setup.respond(1, [{id: 2, zid: 101, instance_name: 'LATEST'}])
  await settle()
  setup.respond(0, [{id: 1, zid: 101, instance_name: 'OLD'}])
  await settle()
  assert.equal(setup.vm.list[0].id, 2)
  assert.equal(setup.vm.getInstanceName(setup.vm.list[0]), 'LATEST')
})
