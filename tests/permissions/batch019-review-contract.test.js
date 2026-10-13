const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Definition only until the ROOT consolidated suite executes this file.
// These source boundary fixtures are not native API or browser acceptance.
const root = process.env.TARGET_ROOT || path.resolve(__dirname, '../..')
const source = (name) => fs.readFileSync(path.join(root, name), 'utf8')

test('batch019 review overview missing metrics stay unknown while measured zero stays zero', () => {
  const text = source('src/pages/dashboard/index.vue')
  const body = text.match(/    fmtPercent\(v\) \{([\s\S]*?)\n    \},/)[1]
  const format = new Function('v', body)
  for (const value of [null, undefined, '', ' ', false, true, NaN, Infinity, -1, 101, 'unknown']) {
    assert.equal(format(value), '—')
  }
  for (const [value, expected] of [[0, '0%'], ['0', '0%'], [72.25, '72.25%'], ['72.25', '72.25%'], [100, '100%']]) {
    assert.equal(format(value), expected)
  }
})

test('batch019 review overview bars are hidden for each unknown secondary metric', () => {
  const text = source('src/pages/dashboard/index.vue')
  const tags = text.match(/<legent\b[^>]*>/g) || []
  assert.equal(tags.length, 8)
  for (const tag of tags) {
    const metric = tag.match(/:rate="v\.(cpu|mem)"/)[1]
    assert.ok(tag.includes(`v-if="fmtPercent(v.${metric}) !== '—'"`))
  }
})

test('batch019 review graph ZID reaches the real query contract without mutating the range', async () => {
  const calls = []
  const request = (...args) => { calls.push(args); return Promise.resolve({data: {code: 200}}) }
  const implementation = source('src/services/admin.js').match(/^export async function hostGraph\(id, params\) \{[\s\S]*?^\}/m)[0]
  const graph = new Function('request', 'HOST_LIST', 'METHOD', implementation.replace('export ', '') + '\nreturn hostGraph')(request, '/v1/host', {POST: 'post'})
  const range = {start: 'start', end: 'end', zid: '7'}
  await graph('same-host-id', range)
  assert.deepEqual(calls[0], ['/v1/host/graph/same-host-id', 'post', {start: 'start', end: 'end'}, {params: {zid: '7'}}])
  assert.deepEqual(range, {start: 'start', end: 'end', zid: '7'})
  const legacyRange = {start: 'start', end: 'end'}
  await graph('legacy-host-id', legacyRange)
  assert.deepEqual(calls[1], ['/v1/host/graph/legacy-host-id', 'post', legacyRange, undefined])
  assert.equal(calls[1][2], legacyRange)
  await graph('legacy-host-id', null)
  assert.deepEqual(calls[2], ['/v1/host/graph/legacy-host-id', 'post', null, undefined])
  await graph('legacy-host-id', undefined)
  assert.deepEqual(calls[3], ['/v1/host/graph/legacy-host-id', 'post', undefined, undefined])
})


test('batch019 review canonical locales resolve actual Vue2 component dictionaries without replacing explicit canonical messages', async () => {
  const Vue = require('vue')
  const importedI18n = require('vue-i18n')
  const VueI18n = importedI18n.default || importedI18n
  assert.match(Vue.version, /^2\./)
  const locales = {}
  for (const locale of ['zh-CN', 'zh-TW', 'en-US']) {
    const text = source(`src/locales/lang/${locale}.js`)
    locales[locale] = new Function(text.replace(/^export default\s*/, 'return '))()
  }
  const text = source('src/utils/i18n.js')
  const start = text.indexOf('function initI18n(')
  const end = text.indexOf('\n/**', start)
  assert.ok(start >= 0 && end > start)
  const initI18n = new Function('Vue', 'VueI18n', 'locales', text.slice(start, end) + '\nreturn initI18n')(Vue, VueI18n, locales)
  const rootVm = new Vue({i18n: initI18n('CN', 'US')})
  const fixtures = [
    ['src/pages/dashboard/i18n.js', ['title_problems', 'title_hosttypecount', 'empty_unresolved_alerts', 'label_hostname', 'label_instance_name', 'label_IP', 'label_cpu_usage']],
    ['src/pages/system/i18n.js', ['logout_btn', 'change_password_title']],
    ['src/layouts/AdminLayout-i18n.js', ['header_search_placeholder']]
  ]
  const components = []
  try {
    for (const [file, keys] of fixtures) {
      const messages = JSON.parse(JSON.stringify(require(path.join(root, file)).messages))
      const vm = new Vue({parent: rootVm, i18n: {messages}})
      components.push({vm, messages, keys})
    }
    const canonicalMessages = {
      CN: {preserved: '旧简体'}, HK: {preserved: '舊繁體'}, US: {preserved: 'legacy English'},
      'zh-CN': {preserved: '保留简体字典'}, 'zh-TW': {preserved: '保留繁體字典'}, 'en-US': {preserved: 'Preserved English dictionary'}
    }
    const originals = {...canonicalMessages}
    const canonicalVm = new Vue({parent: rootVm, i18n: {messages: canonicalMessages}})
    components.push({vm: canonicalVm})
    for (const [canonical, legacy] of [['zh-CN', 'CN'], ['zh-TW', 'HK'], ['en-US', 'US']]) {
      rootVm.$i18n.locale = canonical
      await Vue.nextTick()
      for (const {vm, messages, keys} of components.filter(item => item.keys)) {
        assert.equal(vm.$i18n.locale, canonical)
        assert.equal(messages[canonical], messages[legacy])
        for (const key of keys) {
          assert.equal(typeof messages[legacy][key], 'string', `${legacy}:${key} is an actual component translation`)
          assert.notEqual(messages[legacy][key], key)
          assert.equal(vm.$t(key), messages[legacy][key], `${canonical}:${key}`)
        }
      }
      assert.equal(canonicalMessages[canonical], originals[canonical])
      assert.notEqual(canonicalMessages[canonical], canonicalMessages[legacy])
      assert.equal(canonicalVm.$t('preserved'), originals[canonical].preserved)
    }
  } finally {
    for (const {vm} of components) vm.$destroy()
    rootVm.$destroy()
  }
})
