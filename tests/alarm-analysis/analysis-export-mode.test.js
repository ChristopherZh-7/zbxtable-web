const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const sources = Object.fromEntries(['analysis', 'query'].map(name => [name,
  fs.readFileSync(path.join(root, 'src/pages/alarm', `${name}.vue`), 'utf8')]))

// Execute the literal SFC methods, without rewriting their bodies. Service and
// download boundaries are explicit local fixtures, NOT API/browser evidence.
function method(page, name, bindings) {
  const source = sources[page]
  const start = source.indexOf(`    ${name}(`)
  assert.notEqual(start, -1, `missing ${page}.${name}`)
  const end = source.indexOf('\n    },', start)
  assert.notEqual(end, -1, `missing end of ${page}.${name}`)
  const body = source.slice(start, end + 6).trim()
  return new Function(...Object.keys(bindings), `return ({${body}}).${name}`)(...Object.values(bindings))
}

const settle = () => new Promise(resolve => setImmediate(resolve))
const begin = '2026-10-01 00:00:00'
const end = '2026-10-02 23:59:59'
const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]).buffer

function fixture(page = 'analysis', values = {}) {
  const observed = {exports: [], analyses: [], blobs: [], elements: [], appended: [],
    removed: [], clicked: [], revoked: [], errors: []}
  const vm = {
    beginTime: begin, endTime: end, selectedInstance: 17,
    hosts: 'HOST_FILTER', status: '0', level: '3', hostIp: '192.0.2.17',
    list: ['OLD'], nameList: ['OLD'], numList: [99], trendList: ['OLD'], showPage: false,
    $t: key => key, $message: {error: value => observed.errors.push(value)}, ...values,
  }
  const bindings = {
    Blob,
    alarmExport(params, options) {
      return new Promise((resolve, reject) => observed.exports.push({params, options, resolve, reject}))
    },
    alarmAnalysis(params) {
      observed.analyses.push(params)
      return Promise.resolve({data: {code: 200, data: {level_count: [1], host: ['A'],
        host_count: [1], trend: [{time: '2026-10-01', count: 1}], trend_bucket: 'day'}}})
    },
    window: {URL: {
      createObjectURL(blob) { observed.blobs.push(blob); return `blob:local-fixture-${observed.blobs.length}` },
      revokeObjectURL(url) { observed.revoked.push(url) },
    }},
    document: {
      createElement(tag) {
        assert.equal(tag, 'a')
        const link = {attributes: {}, setAttribute(key, value) { this.attributes[key] = value },
          click() { observed.clicked.push(this) }}
        observed.elements.push(link)
        return link
      },
      body: {appendChild(link) { observed.appended.push(link) },
        removeChild(link) { observed.removed.push(link) }},
    },
  }
  return {vm, observed,
    export: method(page, 'anayexport', bindings).bind(vm),
    init: page === 'analysis' ? method(page, 'init', bindings).bind(vm) : null,
    respond(index = 0, headers = {'content-disposition': 'attachment; filename=analysis-fixture.xlsx'}) {
      observed.exports[index].resolve({data: bytes, headers})
    },
  }
}

for (const [label, selectedInstance] of [['numeric instance', 17], ['string instance', '17'],
  ['all instances', ''], ['cleared instance', null], ['unset instance', undefined]]) {
  test(`analysis export explicitly requests analysis mode: ${label}`, async () => {
    const f = fixture('analysis', {selectedInstance})
    f.export()
    const expected = {begin, end, analysis: true}
    if (selectedInstance) expected.zid = selectedInstance
    assert.deepEqual(f.observed.exports[0].params, expected)
    assert.deepEqual(f.observed.exports[0].options, {responseType: 'arraybuffer'})
    f.respond(); await settle()
    assert.deepEqual(f.observed.errors, [])
  })
}

test('analysis export keeps exact caller time strings including paired empty values', async () => {
  const f = fixture('analysis', {beginTime: '', endTime: '', selectedInstance: ''})
  f.export()
  assert.deepEqual(f.observed.exports[0].params, {begin: '', end: '', analysis: true})
  f.respond(); await settle()
})

test('analysis export forwards a 90-day selection without client-side status or date rewriting', async () => {
  const f = fixture('analysis', {beginTime: '2026-07-01 00:00:00', endTime: '2026-09-28 23:59:59'})
  f.export()
  assert.deepEqual(f.observed.exports[0].params, {
    begin: '2026-07-01 00:00:00', end: '2026-09-28 23:59:59', analysis: true, zid: 17,
  })
  f.respond(); await settle()
})

test('export snapshots current filters and does not mutate component selection', async () => {
  const f = fixture()
  f.export()
  assert.equal(f.vm.beginTime, begin)
  assert.equal(f.vm.endTime, end)
  assert.equal(f.vm.selectedInstance, 17)
  f.vm.beginTime = '2026-10-03 00:00:00'; f.vm.endTime = '2026-10-04 00:00:00'
  f.vm.selectedInstance = ''
  f.export()
  assert.deepEqual(f.observed.exports.map(x => x.params), [
    {begin, end, analysis: true, zid: 17},
    {begin: f.vm.beginTime, end: f.vm.endTime, analysis: true},
  ])
  assert.notEqual(f.observed.exports[0].params, f.observed.exports[1].params)
  f.respond(1); f.respond(0); await settle()
  assert.equal(f.observed.clicked.length, 2)
})

test('analysis export downloads returned bytes once and removes the temporary URL/link', async () => {
  const f = fixture(); f.export(); f.respond(); await settle()
  assert.equal(f.observed.blobs.length, 1)
  assert.deepEqual(Buffer.from(await f.observed.blobs[0].arrayBuffer()), Buffer.from(bytes))
  assert.equal(f.observed.elements.length, 1)
  const link = f.observed.elements[0]
  assert.equal(link.href, 'blob:local-fixture-1')
  assert.equal(link.attributes.download, 'analysis-fixture.xlsx')
  assert.deepEqual(f.observed.appended, [link])
  assert.deepEqual(f.observed.clicked, [link])
  assert.deepEqual(f.observed.removed, [link])
  assert.deepEqual(f.observed.revoked, ['blob:local-fixture-1'])
  assert.deepEqual(f.observed.errors, [])
})

test('analysis export retains the existing filename fallback', async () => {
  const f = fixture(); f.export(); f.respond(0, {}); await settle()
  assert.equal(f.observed.elements[0].attributes.download, 'alarm_list.xlsx')
  assert.deepEqual(f.observed.errors, [])
})

for (const [label, error] of [['transport', new Error('local network fixture')],
  ['HTTP 422', {response: {status: 422, data: {message: 'invalid analysis filters'}}}],
  ['HTTP 403', {response: {status: 403, data: {message: 'denied'}}}]]) {
  test(`analysis export ${label} rejection shows an error without a download or filter mutation`, async () => {
    const f = fixture(); f.export(); f.observed.exports[0].reject(error); await settle()
    assert.deepEqual(f.observed.errors, ['msg_export_failed'])
    for (const key of ['blobs', 'elements', 'appended', 'clicked', 'removed', 'revoked']) {
      assert.deepEqual(f.observed[key], [])
    }
    assert.equal(f.vm.beginTime, begin); assert.equal(f.vm.endTime, end)
    assert.equal(f.vm.selectedInstance, 17)
    assert.equal(f.observed.exports.length, 1)
  })
}

test('analysis export rejects malformed attachment handling without downloading', async () => {
  const f = fixture(); f.export(); f.respond(0, {'content-disposition': 'inline'}); await settle()
  assert.deepEqual(f.observed.errors, ['msg_export_failed'])
  assert.deepEqual(f.observed.clicked, [])
})

for (const selectedInstance of [17, '']) {
  test(`analysis init remains an unmodified analysis-endpoint request: ${selectedInstance || 'all'}`, async () => {
    const f = fixture('analysis', {selectedInstance}); f.init(); await settle()
    const expected = {begin, end}
    if (selectedInstance) expected.zid = selectedInstance
    assert.deepEqual(f.observed.analyses, [expected])
    assert.deepEqual(f.observed.exports, [])
    assert.deepEqual(f.vm.list, [1]); assert.deepEqual(f.vm.nameList, ['A'])
    assert.deepEqual(f.vm.numList, [1]); assert.deepEqual(f.vm.trendList, [{time: '2026-10-01', count: 1}])
    assert.equal(f.vm.showPage, true)
  })
}

for (const status of ['', '0', '1', '3']) {
  test(`ordinary alarm query export keeps legacy filters and has no analysis flag: status=${status}`, async () => {
    const f = fixture('query', {status}); f.export()
    assert.deepEqual(f.observed.exports[0].params, {
      begin, end, hosts: 'HOST_FILTER', status, level: '3', host_ip: '192.0.2.17', zid: 17,
    })
    assert.equal(Object.hasOwn(f.observed.exports[0].params, 'analysis'), false)
    assert.deepEqual(f.observed.exports[0].options, {responseType: 'arraybuffer'})
    f.respond(); await settle()
    assert.equal(f.observed.clicked.length, 1)
  })
}
