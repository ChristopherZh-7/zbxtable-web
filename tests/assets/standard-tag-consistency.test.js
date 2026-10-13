const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Vue = require('vue')
const compiler = require('vue-template-compiler')
const Tag = require('ant-design-vue/lib/tag').default
const Tooltip = require('ant-design-vue/lib/tooltip').default
const {standardTagValues, standardTagState, buildStandardTagFilters, optionLabel,
  ENV_OPTIONS, LEVEL_OPTIONS} = require('../../src/pages/host/asset-tags')

const valid = () => [
  {tag: 'tenant', value: 'tenant-a'}, {tag: 'env', value: 'prod'},
  {tag: 'app', value: 'billing-api'}, {tag: 'level', value: 'core'},
]

// Compile the unchanged production slot, removing only its outer slot binding
// because this isolated renderer supplies record directly. No mocked render.
const source = fs.readFileSync(path.join(__dirname, '../../src/pages/host/GenericDeviceList.vue'), 'utf8')
const template = compiler.parseComponent(source).template.content.trim()
const parsed = compiler.compile(template, {outputSourceRange: true})
assert.deepEqual(parsed.errors, [])
const slots = [], visited = new Set()
function visit(node) {
  if (!node || visited.has(node)) return
  visited.add(node)
  if (node.tag === 'div' && node.attrsMap.slot === 'standard_tags') slots.push(node)
  for (const child of node.children || []) visit(child)
  for (const child of Object.values(node.scopedSlots || {})) visit(child)
}
visit(parsed.ast)
assert.equal(slots.length, 1)
const fragment = template.slice(slots[0].start, slots[0].end)
  .replace(' slot="standard_tags"', '').replace(' slot-scope="record"', '')
const compiled = compiler.compile(fragment)
assert.deepEqual(compiled.errors, [])
function renderedText(tags) {
  const vm = new Vue({components: {'a-tag': Tag, 'a-tooltip': Tooltip},
    data: () => ({record: {tags}, envOptions: ENV_OPTIONS, levelOptions: LEVEL_OPTIONS}),
    methods: {tagState: record => standardTagState(record.tags, 'tenant-a'), optionLabel},
    render: new Function(compiled.render),
    staticRenderFns: compiled.staticRenderFns.map(code => new Function(code))})
  function text(node) {
    if (!node) return ''
    return (node.text || '') + [...(node.children || []), ...((node.componentOptions || {}).children || [])].map(text).join('')
  }
  try { return text(vm._render()).replace(/\s+/g, '') } finally { vm.$destroy() }
}

test('conflicting env tags render pending normalization, never a misleading first value', () => {
  const tags = Object.freeze([...valid(), {tag: 'env', value: 'dev'}].map(Object.freeze))
  const before = JSON.stringify(tags)
  for (const ordered of [tags, [...tags].reverse()]) {
    assert.equal(renderedText(ordered), '待规范')
    assert.deepEqual(standardTagState(ordered, 'tenant-a').missing, ['env'])
    assert.equal(standardTagValues(ordered).env, '')
  }
  assert.equal(JSON.stringify(tags), before)
})

test('same-value, mixed-case and repeated duplicates are noncompliant in every standard dimension', () => {
  for (const {tag, value} of valid()) {
    const tags = [...valid(), {tag: ' ' + tag.toUpperCase() + ' ', value}, {tag, value}]
    const before = JSON.stringify(tags)
    const state = standardTagState(tags, 'tenant-a')
    assert.equal(state.compliant, false, tag)
    assert.deepEqual(state.missing, [tag])
    assert.equal(state.values[tag], '')
    assert.equal(JSON.stringify(tags), before)
  }
})

test('unique case-normalized keys preserve display and canonical exact-value filter semantics', () => {
  const tags = valid().map(({tag, value}) => ({tag: ' ' + tag.toUpperCase() + ' ', value: ' ' + value + ' '}))
  tags.push({tag: ' custom note ', value: ' keep spacing '}, {tag: ' custom note ', value: ' other '})
  const before = JSON.stringify(tags)
  const state = standardTagState(tags, 'tenant-a')
  assert.equal(state.compliant, true)
  assert.deepEqual(state.values, {tenant: 'tenant-a', env: 'prod', app: 'billing-api', level: 'core'})
  assert.equal(renderedText(tags), '租户=tenant-a环境=生产系统=billing-api级别=核心')
  assert.deepEqual(JSON.parse(buildStandardTagFilters(state.values)), [
    {tag: 'env', value: 'prod'}, {tag: 'app', value: 'billing-api'}, {tag: 'level', value: 'core'},
  ])
  assert.equal(standardTagState(valid().map(item => item.tag === 'env' ? {...item, value: 'PROD'} : item), 'tenant-a').compliant, false)
  assert.equal(JSON.stringify(tags), before)
})
