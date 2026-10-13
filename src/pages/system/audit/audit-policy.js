const MAX_AUDIT_RANGE_MS = 31 * 24 * 60 * 60 * 1000

const RESULT_LABELS = {
  pending: '处理中',
  success: '成功',
  failed: '失败',
  denied: '已拒绝',
}

const ACTION_LABELS = {
  login: '登录',
  logout: '退出',
  create: '新增',
  update: '修改',
  delete: '删除',
  operate: '执行',
  export: '导出',
}

function validateAuditRange(range) {
  if (!Array.isArray(range) || range.length !== 2 || !range[0] || !range[1]) {
    return '请选择完整的时间范围'
  }
  const start = range[0].valueOf()
  const end = range[1].valueOf()
  if (end < start) return '结束时间不能早于开始时间'
  if (end - start > MAX_AUDIT_RANGE_MS) return '单次查询不能超过 31 天'
  return ''
}

function buildAuditQuery(filters, page, limit) {
  const rangeError = validateAuditRange(filters.range)
  if (rangeError) throw new Error(rangeError)
  const start = new Date(filters.range[0].valueOf())
  const end = new Date(filters.range[1].valueOf())
  start.setUTCMilliseconds(0)
  end.setUTCMilliseconds(0)
  const params = {
    page,
    limit,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  }
  ;['actor', 'tenant_id', 'resource', 'action', 'result'].forEach((key) => {
    if (filters[key] !== '' && filters[key] !== undefined && filters[key] !== null) {
      params[key] = filters[key]
    }
  })
  return params
}

module.exports = {
  ACTION_LABELS,
  MAX_AUDIT_RANGE_MS,
  RESULT_LABELS,
  buildAuditQuery,
  validateAuditRange,
}
