const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Execute the unchanged literal method body with real native Promise,
// ArrayBuffer, TextEncoder/TextDecoder and Blob. Only service/DOM boundaries are
// local fixtures; these tests do not claim an API or browser acceptance run.
const source = fs.readFileSync(path.resolve(__dirname, '../../src/pages/alarm/analysis.vue'), 'utf8')
const start = source.indexOf('    anayexport(')
const end = source.indexOf('\n    },', start)
assert.ok(start >= 0 && end > start, 'literal analysis.anayexport is present')
const method = source.slice(start, end + 6).trim()
const tick = () => new Promise(resolve => setImmediate(resolve))
const bytes = text => new TextEncoder().encode(text).buffer

function fixture(selectedInstance = 17) {
  const seen = {requests: [], blobs: [], clicked: [], removed: [], revoked: [], errors: []}
  let resolve, reject
  const pending = new Promise((yes, no) => { resolve = yes; reject = no })
  const vm = {beginTime: '2026-10-01 00:00:00', endTime: '2026-10-02 23:59:59', selectedInstance,
    $t: key => { assert.equal(key, 'msg_export_failed'); return '导出失败' },
    $message: {error: message => seen.errors.push(message)}}
  const bindings = {
    TextDecoder, Blob,
    alarmExport(params, config) { seen.requests.push({params, config}); return pending },
    window: {URL: {
      createObjectURL(blob) { seen.blobs.push(blob); return 'blob:p9-local-test' },
      revokeObjectURL(url) { seen.revoked.push(url) },
    }},
    document: {
      createElement(tag) {
        assert.equal(tag, 'a')
        return {attrs: {}, setAttribute(k, v) { this.attrs[k] = v }, click() { seen.clicked.push(this) }}
      },
      body: {appendChild() {}, removeChild(link) { seen.removed.push(link) }},
    },
  }
  const run = new Function(...Object.keys(bindings), `return ({${method}}).anayexport`)(...Object.values(bindings)).bind(vm)
  return {seen, vm, run, resolve, reject}
}

function noDownload(seen) {
  for (const key of ['blobs', 'clicked', 'removed', 'revoked']) assert.deepEqual(seen[key], [], key)
}

async function respond(f, data, headers) {
  const completion = f.run()
  noDownload(f.seen)
  assert.deepEqual(f.seen.errors, [])
  await tick() // The service is still pending; no synchronous then() substitute.
  noDownload(f.seen)
  f.resolve({status: 200, data, headers})
  await completion // Baseline returns undefined; tick still observes its actual promise callbacks.
  await tick()
}

test('HTTP200 business422 ArrayBuffer displays the decoded Chinese error and never downloads', async () => {
  const f = fixture()
  const message = '开始时间不能晚于结束时间'
  const data = bytes(JSON.stringify({code: 422, message}))
  assert.ok(data instanceof ArrayBuffer)
  await respond(f, data, {'content-type': 'application/json; charset=utf-8'})
  noDownload(f.seen)
  assert.deepEqual(f.seen.errors, [message])
  assert.deepEqual(f.seen.requests, [{params: {
    begin: f.vm.beginTime, end: f.vm.endTime, analysis: true, zid: 17,
  }, config: {responseType: 'arraybuffer'}}])
})

for (const [label, data] of [
  ['missing message', bytes(JSON.stringify({code: 422}))],
  ['non-string message', bytes(JSON.stringify({code: 422, message: {unsafe: 'not text'}}))],
  ['malformed JSON', bytes('{"code":422,"message":')],
]) {
  test(`declared JSON ${label} shows the existing Chinese fallback without a workbook`, async () => {
    const f = fixture()
    await respond(f, data, {'content-type': 'application/json', 'content-disposition': 'attachment; filename=must-not-save.xlsx'})
    noDownload(f.seen)
    assert.deepEqual(f.seen.errors, ['导出失败'])
  })
}

test('JSON media type casing and +json suffix do not bypass the error branch', async () => {
  const f = fixture()
  await respond(f, bytes(JSON.stringify({code: 403, message: '无导出权限'})),
    {'content-type': 'Application/Problem+JSON; charset=UTF-8'})
  noDownload(f.seen)
  assert.deepEqual(f.seen.errors, ['无导出权限'])
})

test('asynchronous HTTP rejection with an ArrayBuffer body retains the Chinese failure hint', async () => {
  const f = fixture()
  const completion = f.run()
  await tick(); noDownload(f.seen)
  f.reject({response: {status: 422, data: bytes(JSON.stringify({code: 422, message: '无效时间'}))}})
  await completion; await tick()
  noDownload(f.seen)
  assert.deepEqual(f.seen.errors, ['导出失败'])
})

test('binary XLSX response retains exact bytes, filename, cleanup and P8 all-instance payload', async () => {
  const f = fixture('')
  const workbookBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]).buffer
  await respond(f, workbookBytes, {'content-type': 'application/octet-stream',
    'content-disposition': 'attachment; filename=alarm_list.xlsx'})
  assert.deepEqual(f.seen.errors, [])
  assert.deepEqual(f.seen.requests, [{params: {
    begin: f.vm.beginTime, end: f.vm.endTime, analysis: true,
  }, config: {responseType: 'arraybuffer'}}])
  assert.equal(f.seen.blobs.length, 1)
  assert.deepEqual(Buffer.from(await f.seen.blobs[0].arrayBuffer()), Buffer.from(workbookBytes))
  assert.equal(f.seen.clicked.length, 1)
  assert.equal(f.seen.clicked[0].attrs.download, 'alarm_list.xlsx')
  assert.deepEqual(f.seen.removed, f.seen.clicked)
  assert.deepEqual(f.seen.revoked, ['blob:p9-local-test'])
})
