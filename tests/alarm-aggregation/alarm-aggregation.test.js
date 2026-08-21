const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const page = fs.readFileSync(path.join(root, 'src/pages/alarm/query.vue'), 'utf8')
const service = fs.readFileSync(path.join(root, 'src/services/admin.js'), 'utf8')

test('alarm list exposes aggregation count and source occurrences', () => {
  assert.match(page, /record\.repeat_count/)
  assert.match(page, /handlingDetail\.occurrences/)
  assert.match(page, /aggregation_repeat_count/)
})

test('aggregation configuration is restricted to alarm operators in the UI', () => {
  assert.match(page, /\$can\('tenant\.alarms', 'operate'\)[^>]*openAggregation/)
  assert.match(page, /updateAlarmAggregation/)
  assert.match(page, /window_minutes/)
})

test('aggregation services use tenant-scoped alarm endpoints', () => {
  assert.match(service, /ALARM \+ '\/aggregation', METHOD\.GET/)
  assert.match(service, /ALARM \+ '\/aggregation', METHOD\.PUT/)
})
