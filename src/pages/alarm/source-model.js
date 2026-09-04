const STATES = {
  unverified: {label: '来源未核验', color: ''},
  problem: {label: '仍有未恢复问题', color: '#c94b4b'},
  recovered: {label: '监控已恢复', color: '#2f6f62'},
  recovery: {label: '恢复已关联', color: '#1b5a96'},
  waiting_problem: {label: '恢复待关联', color: '#c68a2b'},
}

function normalizeAlarmSource(value) {
  const data = value && typeof value === 'object' ? value : {}
  let state = Object.prototype.hasOwnProperty.call(STATES, data.state) ? data.state : 'unverified'
  const count = key => Number.isSafeInteger(Number(data[key])) && Number(data[key]) >= 0 ? Number(data[key]) : 0
  const total = count('problem_count'), active = count('active_problem_count'), recovered = count('recovered_problem_count')
  if (state === 'recovered' && (total < 1 || active !== 0 || recovered !== total)) state = 'unverified'
  return {state, problem_count: total, active_problem_count: active, recovered_problem_count: recovered,
    summary: state === 'unverified' ? '旧格式或不完整来源不能用来确认监控恢复。' : String(data.summary || ''),
    links: Array.isArray(data.links) ? data.links : []}
}

function alarmSourceMeta(value) { return STATES[normalizeAlarmSource(value).state] }
function canHandleProblem(record) { return Boolean(record && ['1', 'problem', '故障'].includes(String(record.status).toLowerCase())) }

module.exports = {normalizeAlarmSource, alarmSourceMeta, canHandleProblem}
