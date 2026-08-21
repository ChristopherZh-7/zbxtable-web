const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const querySource = fs.readFileSync(path.join(root, 'src/pages/alarm/query.vue'), 'utf8')
const serviceSource = fs.readFileSync(path.join(root, 'src/services/admin.js'), 'utf8')

test('alarm list exposes duty, escalation and pipeline configuration', () => {
  assert.match(querySource, /pipeline_config/)
  assert.match(querySource, /dispatched_username/)
  assert.match(querySource, /escalation_username/)
  assert.match(querySource, /openPipeline/)
})

test('pipeline write and manual run require unified operate permission in the UI', () => {
  assert.match(querySource, /\$can\('tenant\.alarms', 'operate'\)/)
  assert.match(querySource, /savePipeline/)
  assert.match(querySource, /runPipelineCheck/)
})

test('pipeline services use tenant-scoped alarm endpoints', () => {
  assert.match(serviceSource, /ALARM \+ '\/pipeline', METHOD\.GET/)
  assert.match(serviceSource, /ALARM \+ '\/pipeline', METHOD\.PUT/)
  assert.match(serviceSource, /ALARM \+ '\/pipeline\/run', METHOD\.POST/)
})
