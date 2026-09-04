const STATES = {
  pending: {status: 'processing', label: '等待创建'},
  running: {status: 'processing', label: '正在创建并绑定'},
  bound: {status: 'success', label: '创建并绑定完成'},
  failed: {status: 'warning', label: '待核验后重试'},
  blocked: {status: 'error', label: '已停止，需核对'},
}

function provisionState(value) {
  return STATES[value] || {status: 'default', label: '状态未知'}
}

function provisionIdentityKey(context, asset) {
  if (!context || !context.ready || !context.key || !asset || !asset.id || !asset.class) return ''
  return `${context.key}/${asset.class}:${asset.id}`
}

function activeProvision(job) {
  return Boolean(job && (['pending', 'running'].includes(job.status) || (job.status === 'failed' && job.retryable)))
}

function acceptsProvisionSnapshot(current, incoming) {
  if (!incoming) return !current
  const id = Number(incoming.id), version = Number(incoming.version)
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(version) || version < 1) return false
  return !current || id > Number(current.id) || (id === Number(current.id) && version >= Number(current.version))
}

function newProvisionRequestKey(random) {
  const source = random || (typeof crypto !== 'undefined' ? crypto : null)
  if (source && typeof source.randomUUID === 'function') return source.randomUUID()
  if (!source || typeof source.getRandomValues !== 'function') return ''
  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = bytes[6] & 0x0f | 0x40
  bytes[8] = bytes[8] & 0x3f | 0x80
  const value = Array.from(bytes, item => item.toString(16).padStart(2, '0')).join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function provisionRequest(group, asset, key) {
  if (!group || !(Number(group.zid) > 0) || !/^[1-9][0-9]*$/.test(String(group.host_group_id)) ||
      !asset || !/^[a-f0-9]{64}$/.test(String(asset.revision || '')) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key || '')) {
    throw new Error('请刷新 CI 并选择当前租户的目标主机组。')
  }
  return {zid: Number(group.zid), target_host_group_id: String(group.host_group_id), expected_revision: asset.revision, idempotency_key: key}
}

module.exports = {provisionState, provisionIdentityKey, activeProvision, acceptsProvisionSnapshot, newProvisionRequestKey, provisionRequest}
