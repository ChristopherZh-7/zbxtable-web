const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('alarm list exposes the four handling states and assignee', () => {
  const page = source('src/pages/alarm/query.vue')
  for (const status of ['unclaimed', 'processing', 'resolved', 'closed']) {
    assert.match(page, new RegExp(`${status}: this\\.\\$t\\('handling_${status}'\\)`))
  }
  assert.match(page, /dataIndex: "assignee_username"/)
  assert.match(page, /handlingStatusColor\(record\.handling_status\)/)
})

test('handling drawer uses server timeline and unified operate permission', () => {
  const page = source('src/pages/alarm/query.vue')
  assert.match(page, /\$can\('tenant\.alarms', 'operate'\)/)
  assert.match(page, /handlingDetail\.events/)
  assert.match(page, /claimHandling/)
  assert.match(page, /submitHandling\('note'\)/)
  assert.match(page, /submitHandling\('resolve'\)/)
  assert.match(page, /submitHandling\('close'\)/)
})

test('alarm handling services use scoped nested endpoints', () => {
  const service = source('src/services/admin.js')
  assert.match(service, /ALARM \+ '\/' \+ id \+ '\/handling'/)
  assert.match(service, /ALARM \+ '\/' \+ id \+ '\/claim'/)
  assert.match(service, /\{ action, note \}/)
})

// Execute the literal Vue method. Service/callback fixtures never claim native UI/API proof.
function handlingNotePage(note, options = {}) {
  const page = source('src/pages/alarm/query.vue')
  const body = page.match(/submitHandling\(action\)\s*\{([\s\S]*?)\n    \},\n    finishHandlingAction/)
  assert.ok(body, 'literal submitHandling method remains available')
  const calls = [], warnings = [], callbacks = {}, finishes = []
  const service = (...args) => {
    calls.push(args)
    const chain = {
      then(fn) { callbacks.then = fn; return chain },
      catch(fn) { callbacks.catch = fn; return chain },
      finally(fn) { callbacks.finally = fn; return chain }
    }
    return chain
  }
  const submit = new Function('canHandleProblem', 'handleAlarm', `return function submitHandling(action) {${body[1]}}`)(
    () => options.sourceAllowed !== false, service
  )
  const vm = {
    handlingRecord: options.missingRecord ? null : {id: 17},
    handlingSubmitting: options.busy === true,
    handlingNote: note,
    handlingSequence: 1,
    sourceTenantKey: 'A',
    $can: () => options.permission !== false,
    $t: key => key,
    $message: {warning: key => warnings.push(key), error: () => assert.fail('unexpected error')},
    finishHandlingAction: (...args) => finishes.push(args)
  }
  return {vm, calls, warnings, callbacks, finishes, submit: action => submit.call(vm, action)}
}

test('F18 handling textareas preserve full Unicode input without UTF16 maxlength', () => {
  const page = source('src/pages/alarm/query.vue')
  const textareas = [...page.matchAll(/<a-textarea\b[^>]*v-model\.trim="handlingNote"[^>]*\/>/g)]
  assert.equal(textareas.length, 2)
  for (const [textarea] of textareas) assert.doesNotMatch(textarea, /max-?length/i)
})

test('F18 accepts exactly 2000 Unicode codepoints for note resolve and close', () => {
  for (const note of ['a'.repeat(2000), '\u4e2d'.repeat(2000), '\u{1f600}'.repeat(2000)]) {
    assert.equal(Array.from(note).length, 2000)
    for (const action of ['note', 'resolve', 'close']) {
      const page = handlingNotePage(note)
      page.submit(action)
      assert.deepEqual(page.calls, [[17, action, note]])
      assert.deepEqual(page.warnings, [])
      assert.equal(page.vm.handlingNote, note)
      assert.equal(page.vm.handlingSubmitting, true)
      page.callbacks.finally()
      assert.equal(page.vm.handlingSubmitting, false)
    }
  }
})

test('F18 rejects 2001 codepoints without posting or rewriting and counts trimmed notes', () => {
  for (const note of ['a'.repeat(2001), '\u4e2d'.repeat(2001), '\u{1f600}'.repeat(2001)]) {
    for (const action of ['note', 'resolve', 'close']) {
      const raw = `  ${note}\n `
      const page = handlingNotePage(raw)
      page.submit(action)
      assert.deepEqual(page.calls, [])
      assert.deepEqual(page.warnings, ['handling_note_too_long'])
      assert.equal(page.vm.handlingNote, raw)
      assert.equal(page.vm.handlingSubmitting, false)
    }
  }
  const note = '\u{1f600}'.repeat(2000), raw = `  ${note}\n `
  const page = handlingNotePage(raw)
  page.submit('note')
  assert.deepEqual(page.calls, [[17, 'note', note]])
  assert.equal(page.vm.handlingNote, raw)
  const messages = require(path.join(root, 'src/pages/alarm/i18n.js')).messages
  for (const locale of ['CN', 'US', 'HK']) assert.match(messages[locale].handling_note_too_long, /2000/)
})

test('F18 retains early permission busy source empty guards and stale callback isolation', () => {
  for (const options of [{missingRecord: true}, {busy: true}, {sourceAllowed: false}, {permission: false}]) {
    const page = handlingNotePage('', options)
    Object.defineProperty(page.vm, 'handlingNote', {get: () => assert.fail('note inspected before existing guard')})
    page.submit('note')
    assert.deepEqual(page.calls, [])
    assert.deepEqual(page.warnings, [])
  }
  for (const note of ['', ' \n\t ', null]) {
    const page = handlingNotePage(note)
    page.submit('note')
    assert.deepEqual(page.calls, [])
    assert.deepEqual(page.warnings, ['handling_note_required'])
    assert.equal(page.vm.handlingNote, note)
    assert.equal(page.vm.handlingSubmitting, false)
  }
  for (const changed of ['handlingSequence', 'sourceTenantKey']) {
    const page = handlingNotePage('valid')
    page.submit('resolve')
    page.vm[changed] = changed === 'handlingSequence' ? 2 : 'B'
    page.callbacks.then({data: {code: 200}})
    page.callbacks.catch()
    page.callbacks.finally()
    assert.deepEqual(page.finishes, [])
    assert.equal(page.vm.handlingSubmitting, true)
  }
})
