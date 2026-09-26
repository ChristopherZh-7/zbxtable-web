const observations = {
  healthy: ['正常', 'green'], abnormal: ['异常', 'red'],
  disabled: ['已停用', 'default'], removed: ['移除待同步', 'orange'],
  sync_error: ['同步未完成', 'orange'], pending: ['等待采集', 'blue'],
  no_data: ['无近期数据', 'orange'], unavailable: ['查询失败', 'orange']
}
const reasons = {
  ok: '正常', policy_denied: '目标未获准入', dns_failed: 'DNS解析失败',
  tcp_failed: '端口无法连接', timeout: '探测超时', tls_invalid: '证书校验失败',
  ca_unavailable: '信任证书不可用', http_failed: 'HTTP请求失败',
  http_status: '状态码异常', keyword_missing: '缺少关键字',
  body_limit: '响应正文超限', slow_response: '响应过慢',
  certificate_expiring: '证书即将到期', config_invalid: '配置无效'
}
export const statusMeta = state => observations[state] || ['未知', 'default']
export const reasonText = reason => reasons[reason] || '未知'
export function defaultForm() {
  return {name: '', zid: null, group_id: '', interval: 60, enabled: true, revision: 0,
    config: {domain: '', scheme: 'https', port: 443, path: '/', timeout: 5,
      codes: [200], keyword: '', slow_ms: 2000, cert_days: 30}}
}
export function writePayload(row) {
  const f = defaultForm()
  for (const key of ['name', 'zid', 'group_id', 'interval', 'enabled', 'revision']) f[key] = row[key]
  for (const key of Object.keys(f.config)) f.config[key] = row.config[key]
  f.config.codes = [...f.config.codes]
  return f
}
export function validateForm(f, codes) {
  if (!f.name.trim() || !f.config.domain.trim() || !f.group_id || !f.zid) return '请填写名称、完整域名和监控分组'
  if (!/^\d{3}(,\s*\d{3})*$/.test(codes) || codes.split(',').some(c => Number(c) < 100 || Number(c) > 599)) return '期望状态码格式示例：200,204'
  if (f.interval < 10 || f.interval > 3600 || f.config.timeout < 1 || f.config.timeout > 10 || f.config.timeout >= f.interval) return '采集周期为10–3600秒，超时为1–10秒且小于周期'
  return ''
}
export function chartOption(samples) {
  const single = samples.length === 1 ? samples[0].clock * 1000 : null
  return {
    tooltip: {trigger: 'axis'}, xAxis: {type: 'time', ...(single === null ? {} : {min: single - 60000, max: single + 60000})}, yAxis: {type: 'value', name: '响应时间 ms'},
    series: [{type: 'line', showSymbol: samples.length <= 120, symbolSize: 5, connectNulls: false,
      data: [...samples].reverse().map(s => [s.clock * 1000, s.status_code > 0 ? s.response_ms : null])}]
  }
}
