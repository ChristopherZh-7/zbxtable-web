const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  accountStateMeta,
  buildResponsibilityFields,
  contactStatusMeta,
  createResponsibilityForm,
  deactivateImpactText,
  filterContacts,
  impactLabel,
  normalizeDirectory,
  validateResponsibilityForm,
} = require('../../src/pages/cmdb/responsibilities/responsibility-model')

const source = relative => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('CMDB responsibility directory has a dedicated route, permission and SmartOps-only services', () => {
  const router = source('src/router/async/router.map.js')
  const page = source('src/pages/cmdb/responsibilities/index.vue')
  const service = source('src/services/cmdb.js')
  assert.match(router, /cmdbResponsibilities:\s*\{[\s\S]*@\/pages\/cmdb\/responsibilities/)
  assert.match(page, /canPerform\(this\.permissions, 'tenant\.cmdb\.responsibility', 'create'\)/)
  assert.match(page, /canPerform\(this\.permissions, 'tenant\.cmdb\.responsibility', 'update'\)/)
  assert.match(page, /canPerform\(this\.permissions, 'tenant\.cmdb\.responsibility', 'operate'\)/)
  for (const operation of [
    'getCMDBResponsibilities', 'listCMDBResponsibilityAccountOptions', 'createCMDBTeam', 'updateCMDBTeam',
    'transitionCMDBTeam', 'createCMDBPerson', 'updateCMDBPerson', 'transitionCMDBPerson',
    'updateCMDBPersonTeams', 'setCMDBPersonAccount',
  ]) assert.match(service, new RegExp(`function ${operation}\\b`))
  assert.doesNotMatch(service, /deleteCMDBTeam|deleteCMDBPerson|METHOD\.DELETE/)
  for (const forbidden of ['Auth-Token', 'SMARTOPS_ITOP', 'webservices/rest.php']) assert.equal(service.includes(forbidden), false)
})

test('page explains account, tenant membership and iTop responsibility as separate layers', () => {
  const page = source('src/pages/cmdb/responsibilities/index.vue')
  const model = source('src/pages/cmdb/responsibilities/responsibility-model.js')
  for (const copy of [
    '运维基础资料', '\u5e73\u53f0\u8d26\u53f7', '\u79df\u6237\u6210\u5458', '团队与负责人', '\u53ea\u7ba1\u767b\u5f55\u4e0e\u8d26\u53f7\u542f\u505c',
    '\u53ea\u7ba1\u89d2\u8272\u4e0e\u6570\u636e\u8303\u56f4', '\u4fdd\u5b58\u771f\u5b9e\u8fd0\u7ef4\u8d23\u4efb', '\u4e0d\u4f1a\u6388\u4e88\u6216\u6539\u53d8\u4efb\u4f55\u5e73\u53f0\u6743\u9650',
    '\u5916\u90e8\u4eba\u5458\u53ef\u7559\u7a7a', '\u8d26\u53f7\u5df2\u505c\u7528', '\u5df2\u79fb\u51fa\u79df\u6237', '\u8d26\u53f7\u5df2\u5220\u9664',
  ]) assert.ok(`${page}\n${model}`.includes(copy), `missing responsibility boundary copy: ${copy}`)
  assert.match(page, /v-if="!canUpdate"[\s\S]*\u53ea\u8bfb\u89c6\u56fe/)
  assert.match(page, /v-if="canCreate && writeContextReady"[\s\S]*\u65b0\u589e\u56e2\u961f/)
  assert.doesNotMatch(page, /\u81ea\u52a8\u6388\u6743|\u5220\u9664\u8d1f\u8d23\u4eba|\u5220\u9664\u56e2\u961f/)
})

test('responsibility writes use the same tenant Organization generation and discard old responses', () => {
  const page = source('src/pages/cmdb/responsibilities/index.vue')
  const service = source('src/services/cmdb.js')
  assert.match(page, /Promise\.all\(\[getCMDBResponsibilities\(\), getCMDBOverview\(\)\]\)/)
  assert.match(page, /normalizeCMDBContext\(overview, tenantID\)/)
  assert.match(page, /activeCMDBContextKey/)
  assert.match(page, /resetContextWorkspaces\(\)[\s\S]*editorVisible = false[\s\S]*impactVisible = false/)
  assert.match(page, /mapping_transition_in_progress[\s\S]*resetContextWorkspaces\(\)/)
  assert.match(page, /updateCMDBTeam\([^\n]*fields, context\)/)
  assert.match(page, /createCMDBPerson\(fields, context\)/)
  assert.match(page, /setCMDBPersonAccount\([^\n]*context\)/)
  assert.match(page, /transitionCMDBPerson\([^\n]*context\)/)
  assert.match(service, /function createCMDBTeam\(fields, context\)[\s\S]*cmdbWriteConfig\(context\)/)
  assert.match(service, /function setCMDBPersonAccount\(id, userID, context\)[\s\S]*cmdbWriteConfig\(context\)/)
})

test('directory normalization keeps inactive records, memberships, impacts and broken account states visible', () => {
  const directory = normalizeDirectory({
    state: 'ready',
    organization: {id: 44, name: 'Tenant A'},
    teams: [{id: 2, class: 'Team', name: 'Ops', status: 'inactive', person_ids: [8], impact: {total: 1}}],
    people: [{id: 8, class: 'Person', name: 'Li', first_name: 'Lei', status: 'active', team_ids: [2], account: {user_id: 7, username: 'lilei', state: 'not_member'}, impact: {total: 2, primary_owner: 1, backup_owner: 1}}],
  })
  assert.equal(directory.state, 'ready')
  assert.equal(directory.teams[0].status, 'inactive')
  assert.deepEqual(directory.teams[0].person_ids, [8])
  assert.equal(directory.people[0].account.state, 'not_member')
  assert.equal(accountStateMeta(directory.people[0].account).label, '\u5df2\u79fb\u51fa\u79df\u6237')
  assert.equal(contactStatusMeta('inactive').label, '\u505c\u7528')
  assert.equal(impactLabel(directory.people[0]), '2 \u9879\u8d44\u4ea7 \u00b7 \u4e3b\u8d23 1 / \u5907\u8d23 1')
})

test('directory keeps transport failures distinct from an unconfigured tenant', () => {
  assert.equal(normalizeDirectory({state: 'error', message: 'iTop timeout'}).state, 'error')
  assert.equal(normalizeDirectory({state: 'unknown'}).state, 'unconfigured')
  const page = source('src/pages/cmdb/responsibilities/index.vue')
  assert.match(page, /directory\.state === 'error'[\s\S]*运维基础资料\u8bfb\u53d6\u5931\u8d25/)
  assert.match(page, /emptyDirectory\('error', error\.message/)
})

test('responsibility form trims allowlisted fields and supports unlinked external people', () => {
  const form = createResponsibilityForm('person')
  form.name = '  \u674e\u96f7  '
  form.first_name = ' Lei '
  form.email = ' ops@example.com '
  form.function = ' DBA '
  form.team_ids = [2]
  form.user_id = undefined
  assert.equal(validateResponsibilityForm('person', form), '')
  assert.deepEqual(buildResponsibilityFields('person', form), {
    name: '\u674e\u96f7', email: 'ops@example.com', phone: '', notify: 'yes', function: 'DBA',
    first_name: 'Lei', employee_number: '', mobile_phone: '',
  })
  assert.equal(validateResponsibilityForm('team', {name: '', email: ''}), '\u8bf7\u8f93\u5165\u56e2\u961f\u540d\u79f0')
  assert.equal(validateResponsibilityForm('person', {name: '\u674e', first_name: '', email: ''}), '\u8bf7\u8f93\u5165\u8d1f\u8d23\u4eba\u7684\u540d / \u82f1\u6587\u540d')
  assert.equal(validateResponsibilityForm('person', {name: '\u674e', first_name: '\u96f7', email: 'invalid'}), '\u8bf7\u8f93\u5165\u6709\u6548\u90ae\u7bb1')
})

test('search includes account identity and deactivation gives a reassignment closure', () => {
  const people = normalizeDirectory({state: 'ready', people: [{
    id: 8, class: 'Person', name: '\u674e\u96f7', status: 'active', account: {user_id: 7, username: 'lilei', state: 'available'},
    impact: {total: 2, sample_assets: [{key: 'Server:1', name: 'app-01'}]},
  }]}).people
  assert.equal(filterContacts(people, 'lilei', '').length, 1)
  assert.equal(filterContacts(people, '', 'inactive').length, 0)
  assert.match(deactivateImpactText(people[0]), /2 \u9879\u8d44\u4ea7.*app-01.*资产配置中心/)
})
