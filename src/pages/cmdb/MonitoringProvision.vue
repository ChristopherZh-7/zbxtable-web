<template>
  <section class="monitoring-provision" aria-label="监控对象创建任务">
    <a-button
      v-if="writable && !bound && !retired"
      data-testid="cmdb-provision-open"
      size="small"
      icon="plus-circle"
      :disabled="busy"
      @click="open"
    >创建并绑定监控对象</a-button>

    <div v-if="latest" class="provision-record" data-testid="cmdb-provision-status" :data-state="latest.status">
      <div class="provision-record__heading">
        <a-badge :status="state.status" :text="state.label" />
        <code>#{{ latest.id }} · v{{ latest.version }}</code>
      </div>
      <p v-if="latest.error_message">{{ latest.error_message }}</p>
      <p v-else-if="latest.status === 'bound'">只完成监控主机创建与身份绑定；配置和采集状态以上方实时结果为准。</p>
      <p v-else>响应丢失时会核验本次创建记录，不盲目重复建监控主机。</p>
      <small v-if="latest.host_id">监控源编号 {{ latest.zid }} · 监控主机 {{ latest.host_id }}</small>
      <a-button v-if="writable && latest.status === 'failed' && latest.retryable" data-testid="cmdb-provision-retry" type="link" size="small" :loading="submitting" @click="retry">核验并重试</a-button>
    </div>
    <a-button v-if="writable && bound && !configured" data-testid="cmdb-provision-configure" type="link" size="small" @click="$router.push('/assets/configuration')">前往监控配置</a-button>
    <p v-if="error && !visible" class="provision-error">{{ error }}</p>

    <a-modal
      v-if="writable"
      :visible="visible"
      title="创建并绑定监控对象"
      ok-text="创建并绑定"
      :confirm-loading="submitting"
      :ok-button-props="{props: {disabled: !selectedGroup || loading}}"
      :mask-closable="false"
      :width="650"
      @ok="submit"
      @cancel="close"
    >
      <div class="provision-authority">
        <strong>{{ asset.name }}</strong>
        <code>{{ asset.class }}:{{ asset.id }} · 组织编号 {{ context.organization_id }} · 组织映射版本 {{ context.generation }}</code>
      </div>
      <a-alert show-icon type="info" message="创建不是采集就绪" description="本次只创建监控主机并建立监控关联，不下发模板、接口或采集凭据。完成后前往监控配置应用监控策略。" />
      <a-alert v-if="error" class="provision-modal-error" show-icon type="error" :message="error" />
      <a-form-model layout="vertical" class="provision-form">
        <a-form-model-item label="目标主机组（当前租户范围）">
          <a-select v-model="groupKey" data-testid="cmdb-provision-group" :loading="loading" :disabled="submitting || Boolean(requestSnapshot)" placeholder="选择监控源与主机组">
            <a-select-option v-for="group in groups" :key="keyOf(group)" :value="keyOf(group)">{{ group.host_group_name || group.host_group_id }}（{{ group.instance_name }}）</a-select-option>
          </a-select>
        </a-form-model-item>
      </a-form-model>
      <p class="provision-note">主机技术名由服务端生成。遇到冲突或部分失败时保留原对象，不自动覆盖或删除。</p>
    </a-modal>
  </section>
</template>

<script>
import {createMonitoringProvision, getMonitoringProvisionResources, listMonitoringProvisions, retryMonitoringProvision} from '@/services/cmdb'
import {activeProvision, acceptsProvisionSnapshot, newProvisionRequestKey, provisionIdentityKey, provisionRequest, provisionState} from './monitoring-provision-model'

export default {
  name: 'MonitoringProvision',
  props: {
    asset: {type: Object, required: true},
    context: {type: Object, required: true},
    writable: {type: Boolean, default: false},
    bound: {type: Boolean, default: false},
    retired: {type: Boolean, default: false},
    configured: {type: Boolean, default: false},
  },
  data() {
    return {jobs: [], groups: [], groupKey: undefined, visible: false, error: '', loading: false, submitting: false, requestKey: '', requestSnapshot: null, sequence: 0, disposed: false, timer: null}
  },
  computed: {
    identity() { return provisionIdentityKey(this.context, this.asset) },
    latest() { return this.jobs[0] || null },
    busy() { return activeProvision(this.latest) },
    state() { return provisionState(this.latest && this.latest.status) },
    selectedGroup() { return this.groups.find(group => this.keyOf(group) === this.groupKey) || null },
  },
  watch: {
    identity() { this.reset(); this.loadJobs() },
    bound() { this.loadJobs() },
    writable(value) { if (!value) this.close() },
    'asset.revision'() { this.close(); this.requestSnapshot = null },
  },
  created() {
    this.loadJobs()
    this.timer = window.setInterval(() => { if (this.busy || this.visible) this.loadJobs() }, 3000)
  },
  beforeDestroy() {
    this.disposed = true
    this.sequence += 1
    if (this.timer) window.clearInterval(this.timer)
  },
  methods: {
    keyOf(group) { return `${group.zid}:${group.host_group_id}` },
    current(key, sequence) { return !this.disposed && key && key === this.identity && sequence === this.sequence },
    unwrap(response) {
      const payload = response && response.data
      if (!payload || Number(payload.code) !== 200) {
        const error = new Error(payload && payload.message || '暂时无法读取创建任务')
        error.reason = payload && payload.data && payload.data.reason || ''
        throw error
      }
      return payload.data
    },
    checkContext(data) {
      const source = data && data.context || {}
      return Number(source.organization_id) === Number(this.context.organization_id) && Number(source.generation) === Number(this.context.generation)
    },
    reset() {
      this.sequence += 1
      this.visible = false
      this.jobs = []
      this.groups = []
      this.requestSnapshot = null
      this.requestKey = ''
      this.error = ''
      this.submitting = false
    },
    close() { this.visible = false; this.error = '' },
    async loadJobs() {
      const identity = this.identity, sequence = this.sequence
      if (!identity) return
      try {
        const data = this.unwrap(await listMonitoringProvisions(this.asset.class, this.asset.id))
        if (!this.current(identity, sequence)) return
        if (!this.checkContext(data)) { this.reset(); this.$emit('context-stale'); return }
        const newest = Array.isArray(data.items) ? data.items[0] : null
        if (!acceptsProvisionSnapshot(this.latest, newest)) return
        const previous = this.latest && `${this.latest.id}:${this.latest.status}`
        this.jobs = Array.isArray(data.items) ? data.items : []
        if (this.latest && this.latest.status === 'bound' && `${this.latest.id}:${this.latest.status}` !== previous) this.$emit('changed')
      } catch (error) {
        if (this.current(identity, sequence)) this.error = error.message
      }
    },
    async open() {
      if (!this.writable || this.bound || this.busy || this.retired || !this.identity) return
      const identity = this.identity, sequence = this.sequence
      this.visible = true
      this.error = ''
      this.loading = true
      this.groupKey = undefined
      this.requestSnapshot = null
      this.requestKey = newProvisionRequestKey()
      try {
        if (!this.requestKey) throw new Error('当前浏览器无法生成安全请求标识。')
        const data = this.unwrap(await getMonitoringProvisionResources())
        if (!this.current(identity, sequence)) return
        if (!this.checkContext(data)) { this.reset(); this.$emit('context-stale'); return }
        this.groups = Array.isArray(data.host_groups) ? data.host_groups : []
        if (!this.groups.length) this.error = '当前租户没有可用于创建的监控主机组，请联系平台管理员。'
      } catch (error) {
        if (this.current(identity, sequence)) this.error = error.message
      } finally {
        if (this.current(identity, sequence)) this.loading = false
      }
    },
    async submit() {
      if (!this.writable || !this.identity || this.submitting || this.bound) return
      const identity = this.identity, sequence = this.sequence
      this.submitting = true
      try {
        // Retain the same body/key after a transport timeout. Do not create a
        // second operation merely because its first response was lost.
        if (!this.requestSnapshot) this.requestSnapshot = provisionRequest(this.selectedGroup, this.asset, this.requestKey)
        const job = this.unwrap(await createMonitoringProvision(this.asset.class, this.asset.id, this.requestSnapshot, this.context))
        if (!this.current(identity, sequence)) return
        if (acceptsProvisionSnapshot(this.latest, job)) this.jobs = [job, ...this.jobs.filter(item => item.id !== job.id)]
        this.visible = false
        this.error = ''
        this.$message.success('创建任务已受理')
        if (this.latest && this.latest.status === 'bound') this.$emit('changed')
        await this.loadJobs()
      } catch (error) {
        if (!this.current(identity, sequence)) return
        this.error = error.message
        if (error.reason === 'mapping_context_stale') { this.reset(); this.$emit('context-stale') }
        else this.loadJobs()
      } finally {
        if (this.current(identity, sequence)) this.submitting = false
      }
    },
    async retry() {
      const job = this.latest
      if (!this.writable || !job || job.status !== 'failed' || !job.retryable || this.submitting) return
      const identity = this.identity, sequence = this.sequence
      this.submitting = true
      try {
        const result = this.unwrap(await retryMonitoringProvision(this.asset.class, this.asset.id, job.id, job.version, this.context))
        if (!this.current(identity, sequence)) return
        if (acceptsProvisionSnapshot(this.latest, result)) this.jobs = [result, ...this.jobs.slice(1)]
        this.error = ''
      } catch (error) { if (this.current(identity, sequence)) this.error = error.message }
      finally { if (this.current(identity, sequence)) this.submitting = false }
    },
  },
}
</script>

<style scoped>
.monitoring-provision { margin-top: 12px; }
.provision-record { margin-top: 12px; padding: 12px; background: #f4f8fb; border-left: 2px solid #1f5f9f; }
.provision-record__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.provision-record code, .provision-authority code { font: 11px/1.6 monospace; color: #536780; overflow-wrap: anywhere; }
.provision-record p, .provision-note { margin: 8px 0 0; color: #536780; font-size: 12px; line-height: 1.7; }
.provision-record small { display: block; color: #536780; }
.provision-authority { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; color: #0b2147; overflow-wrap: anywhere; }
.provision-form, .provision-modal-error { margin-top: 18px; }
.provision-error { margin: 8px 0 0; font-size: 12px; color: #a65321; }
</style>
