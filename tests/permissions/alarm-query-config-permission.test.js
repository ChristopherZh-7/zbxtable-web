const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {canPerform} = require('../../src/utils/permission-policy')

const query = fs.readFileSync(path.join(__dirname, '../../src/pages/alarm/query.vue'), 'utf8')

// Execute the component's real method bodies without replacing their permission
// checks or loading Vue/browser dependencies. API responses below are unit fixtures.
function componentMethod(name, bindings, indentation = '    ') {
  const start = query.indexOf(`${indentation}${name}(`)
  assert.notEqual(start, -1, `missing component method: ${name}`)
  const end = query.indexOf(`\n${indentation}},`, start)
  assert.notEqual(end, -1, `missing component method end: ${name}`)
  const method = query.slice(start, end + indentation.length + 2).trim()
  return new Function(...Object.keys(bindings), `return ({${method}}).${name}`)(...Object.values(bindings))
}

function fixture(permissions, {error, response, prompt = ''} = {}) {
  const observation = {configRequests: 0, alarmQueries: 0, instanceRequests: 0, errors: []}
  const vm = {
    alarmAnalysisPrompt: prompt,
    // Cached role text must not override the server-supplied resource/action list.
    role: 'platform_admin',
    $can: (resource, action) => canPerform(permissions, resource, action),
    $t: value => value,
    invalidateAlarmContext() {},
    applyTimeRange() {},
    initOptions() {},
    initColumns() {},
    loadInstances() { observation.instanceRequests += 1 },
    init() { observation.alarmQueries += 1 },
  }
  const bindings = {
    configGetList() {
      observation.configRequests += 1
      if (error) return Promise.reject(error)
      return Promise.resolve(response || {data: {code: 200, data: {items: [
        {config_key: 'unrelated_setting', config_value: 'not the prompt'},
        {config_key: 'alarm_analysis_prompt', config_value: 'configured alarm prompt'},
      ]}}})
    },
    console: {error: (...args) => observation.errors.push(args)},
    window: {addEventListener() {}},
    tenantContextChangingEvent: 'tenant-context-changing',
    buildAlarmTimeRanges: () => [],
    getDefaultAlarmTimeRange: () => [],
  }
  vm.loadAlarmAnalysisPrompt = componentMethod('loadAlarmAnalysisPrompt', bindings).bind(vm)
  return {
    vm,
    observation,
    created: componentMethod('created', bindings, '  ').bind(vm),
    settle: () => new Promise(resolve => setImmediate(resolve)),
    report(t) {
      t.diagnostic(JSON.stringify({
        configRequests: observation.configRequests,
        alarmQueries: observation.alarmQueries,
        instanceRequests: observation.instanceRequests,
        prompt: vm.alarmAnalysisPrompt,
        errors: observation.errors.map(args => args.map(value => value instanceof Error ? value.message : value)),
      }))
    },
  }
}

const deniedPermissions = [
  ['viewer', [{id: 'tenant.alarms', operation: ['read']}]],
  ['tenant administrator', [{id: 'tenant.alarms', operation: ['read', 'export', 'create', 'update', 'delete', 'operate']}]],
  ['empty permissions despite cached administrator role', []],
  ['missing permissions', undefined],
  ['global-system write without read', [{id: 'platform.system', operation: ['update']}]],
  ['unrelated platform read', [{id: 'platform.zabbix', operation: ['read']}]],
]

for (const [role, permissions] of deniedPermissions) {
  test(`alarm prompt does not request global config for ${role}`, async t => {
    const setup = fixture(permissions, {error: new Error('CONFIG_PERMISSION_DENIED'), prompt: 'previous prompt'})
    setup.vm.loadAlarmAnalysisPrompt()
    await setup.settle()
    setup.report(t)
    assert.equal(setup.observation.configRequests, 0)
    assert.equal(setup.vm.alarmAnalysisPrompt, '')
    assert.deepEqual(setup.observation.errors, [])
  })
}

const systemRead = [{id: 'platform.system', operation: ['read']}]

test('rechecking a revoked permission clears an already loaded prompt without another request', async t => {
  const permissions = [...systemRead]
  const setup = fixture(permissions)
  setup.vm.loadAlarmAnalysisPrompt()
  await setup.settle()
  assert.equal(setup.vm.alarmAnalysisPrompt, 'configured alarm prompt')
  permissions.length = 0
  setup.vm.loadAlarmAnalysisPrompt()
  await setup.settle()
  setup.report(t)
  assert.equal(setup.observation.configRequests, 1)
  assert.equal(setup.vm.alarmAnalysisPrompt, '')
  assert.deepEqual(setup.observation.errors, [])
})

test('alarm prompt still loads the configured value for a permitted administrator', async t => {
  const setup = fixture(systemRead)
  setup.vm.loadAlarmAnalysisPrompt()
  await setup.settle()
  setup.report(t)
  assert.equal(setup.observation.configRequests, 1)
  assert.equal(setup.vm.alarmAnalysisPrompt, 'configured alarm prompt')
  assert.deepEqual(setup.observation.errors, [])
})

test('a permitted empty configuration clears the previous prompt', async t => {
  const setup = fixture(systemRead, {prompt: 'previous prompt', response: {data: {code: 200, data: {items: []}}}})
  setup.vm.loadAlarmAnalysisPrompt()
  await setup.settle()
  setup.report(t)
  assert.equal(setup.observation.configRequests, 1)
  assert.equal(setup.vm.alarmAnalysisPrompt, '')
  assert.deepEqual(setup.observation.errors, [])
})

test('a non-success business response preserves the existing prompt behavior', async t => {
  const setup = fixture(systemRead, {prompt: 'previous prompt', response: {data: {code: 403}}})
  setup.vm.loadAlarmAnalysisPrompt()
  await setup.settle()
  setup.report(t)
  assert.equal(setup.observation.configRequests, 1)
  assert.equal(setup.vm.alarmAnalysisPrompt, 'previous prompt')
})

for (const message of ['NETWORK_UNAVAILABLE', 'SERVER_PERMISSION_REVOKED']) {
  test(`a permitted request still reports a real failure: ${message}`, async t => {
    const error = new Error(message)
    const setup = fixture(systemRead, {error, prompt: 'previous prompt'})
    setup.vm.loadAlarmAnalysisPrompt()
    await setup.settle()
    setup.report(t)
    assert.equal(setup.observation.configRequests, 1)
    assert.equal(setup.vm.alarmAnalysisPrompt, 'previous prompt')
    assert.equal(setup.observation.errors.length, 1)
    assert.equal(setup.observation.errors[0][0], 'msg_load_ai_prompt_failed')
    assert.equal(setup.observation.errors[0][1], error)
  })
}

test('created still initializes the viewer alarm query without global configuration or instance requests', async t => {
  const setup = fixture([{id: 'tenant.alarms', operation: ['read']}], {error: new Error('CONFIG_PERMISSION_DENIED')})
  setup.created()
  await setup.settle()
  setup.report(t)
  assert.equal(setup.observation.alarmQueries, 1)
  assert.equal(setup.observation.instanceRequests, 0)
  assert.equal(setup.observation.configRequests, 0)
  assert.deepEqual(setup.observation.errors, [])
})

test('created preserves permitted administrator configuration, instance, and alarm requests', async t => {
  const setup = fixture([...systemRead, {id: 'platform.zabbix', operation: ['read']}])
  setup.created()
  await setup.settle()
  setup.report(t)
  assert.equal(setup.observation.alarmQueries, 1)
  assert.equal(setup.observation.instanceRequests, 1)
  assert.equal(setup.observation.configRequests, 1)
  assert.equal(setup.vm.alarmAnalysisPrompt, 'configured alarm prompt')
  assert.deepEqual(setup.observation.errors, [])
})
