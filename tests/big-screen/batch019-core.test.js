const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {operationsKpi, resourcePercentage} = require('../../src/pages/screen/operations-model')
const {createAssetForm, buildAssetFields, validateAssetForm, editableFields} = require('../../src/pages/cmdb/cmdb-model')

test('BATCH019 ISSUE031 alarm multiplicity never changes scoped host availability', () => {
  const info = {online_rate: 100, asset_type_counts: [{count: 4}]}
  assert.equal(operationsKpi(info, []).online, 100)
  assert.equal(operationsKpi(info, [{severity: 5}, {severity: 5}]).online, 100)
  assert.equal(operationsKpi({asset_type_counts: [{count: 4}]}, []).online, null)
  assert.equal(operationsKpi({online_rate: 0}).online, 0)
})

test('BATCH019 ISSUE032 missing metric is unknown and measured zero is valid', () => {
  for (const value of [undefined, null, '', ' ', false, NaN, Infinity, -1, 101, 'unknown']) {
    assert.equal(resourcePercentage(value), null)
  }
  assert.equal(resourcePercentage(0), 0)
  assert.equal(resourcePercentage('0'), 0)
  assert.equal(resourcePercentage(100), 100)
  const source = fs.readFileSync(path.join(__dirname, '../../src/pages/screen/components/ResourceTopBar.vue'), 'utf8')
  assert.match(source, /filter\(\(row\) => row && resourcePercentage\(row\[this\.metric\]\) !== null\)/)
  assert.match(source, /pct\(v\) === null \? '—'/)
})

test('BATCH019 ISSUE056 create and edit retain a required positive VM host reference', () => {
  const form = {...createAssetForm('VirtualMachine'), name: 'vm', smartops_operations_team_id: 1, smartops_primary_owner_id: 2}
  assert.equal(editableFields('VirtualMachine').find((field) => field.key === 'virtualhost_id').required, true)
  for (const value of [undefined, null, 0, -1, 1.5]) {
    assert.notEqual(validateAssetForm('VirtualMachine', {...form, virtualhost_id: value}), '')
  }
  form.virtualhost_id = 7
  assert.equal(validateAssetForm('VirtualMachine', form), '')
  assert.equal(buildAssetFields('VirtualMachine', form, true).virtualhost_id, 7)
  assert.equal(createAssetForm('VirtualMachine', {virtualhost_id: 7}).virtualhost_id, 7)
  const template = fs.readFileSync(path.join(__dirname, '../../src/pages/cmdb/index.vue'), 'utf8')
  assert.equal((template.match(/v-else-if="field.kind === 'virtualHost'"/g) || []).length, 2)
  assert.match(template, /virtual_hosts: Array\.isArray\(data\.virtual_hosts\)/)
})
