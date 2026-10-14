<template>
  <div class="screen-header">
    <div class="header-left">
      <slot name="left">
      <button type="button" class="header-btn screen-back" @click="goBack"><a-icon type="arrow-left" />{{ $t('screen_back') }}</button>
      <span v-if="canManageScreens" class="header-btn" @click="$emit('manage-screens')">
        <a-icon type="appstore" />{{ $t('screen_manage') }}
      </span>
      <span v-if="canCreateScreen" class="header-btn" @click="$emit('create-screen')">
        <a-icon type="plus" />{{ $t('screen_create') }}
      </span>
      </slot>
    </div>
    <div class="header-title">
      <div class="title-main">{{ title || $t('screen_title') }}</div>
      <div class="title-sub">{{ $t('screen_subtitle') }}</div>
    </div>
    <div class="header-right">
      <span class="clock-date">{{ dateText }}</span>
      <span class="clock-time">{{ timeText }}</span>

      <slot name="controls">
      <span class="screen-status"><a-icon type="desktop" />{{ viewportLabel }}</span>
      <span class="screen-status"><a-icon type="history" />{{ $t('screen_last_refresh') }} {{ lastUpdated || '--' }}</span>

      <!-- 刷新间隔设置 -->
      <div class="refresh-wrap">
        <a-icon type="sync" class="refresh-icon" :spin="spinning" />
        <span class="refresh-label">{{ $t('screen_auto_refresh') }}</span>
        <select class="refresh-select" :aria-label="$t('screen_refresh_interval')" :value="interval" @change="onIntervalChange">
          <option v-for="opt in intervalOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <span class="header-btn" @click="toggleFullscreen">
        <a-icon :type="isFs ? 'fullscreen-exit' : 'fullscreen'" />
        {{ isFs ? $t('screen_exit_fullscreen') : $t('screen_fullscreen') }}
      </span>
      </slot>
    </div>
  </div>
</template>

<script>
import {screenContextKey, screenSessionStorage, screenReturnPath} from '@/utils/screen-navigation'

export default {
  name: 'HeaderBar',
  i18n: require('../i18n'),
  props: {
    title: { type: String, default: '' },
    interval: { type: Number, default: 30 },
    lastUpdated: { type: String, default: '' },
    viewportLabel: { type: String, default: '1920×1080' },
    canManageScreens: { type: Boolean, default: false },
    canCreateScreen: { type: Boolean, default: false }
  },
  data() {
    return {
      now: new Date(),
      timer: null,
      isFs: false,
      spinning: false,
      spinTimer: null,
      intervalOptions: [
        { label: '10 秒', value: 10 },
        { label: '30 秒', value: 30 },
        { label: '1 分钟', value: 60 },
        { label: '5 分钟', value: 300 },
        { label: '10 分钟', value: 600 }
      ]
    }
  },
  computed: {
    dateText() {
      const d = this.now
      const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
      return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())} ${week}`
    },
    timeText() {
      const d = this.now
      return `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`
    }
  },
  mounted() {
    this.timer = setInterval(() => { this.now = new Date() }, 1000)
    document.addEventListener('fullscreenchange', this.syncFs)
  },
  beforeDestroy() {
    if (this.timer) clearInterval(this.timer)
    if (this.spinTimer) clearTimeout(this.spinTimer)
    document.removeEventListener('fullscreenchange', this.syncFs)
  },
  methods: {
    pad(n) { return String(n).padStart(2, '0') },
    async goBack() {
      if (document.fullscreenElement && document.exitFullscreen) {
        try { await document.exitFullscreen() } catch (_) { /* navigation remains available */ }
      }
      const path = screenReturnPath(screenSessionStorage(window), screenContextKey(this.$store), this.$router)
      this.$router.replace(path)
    },
    syncFs() { this.isFs = !!document.fullscreenElement },
    toggleFullscreen() {
      const el = document.documentElement
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen()
      } else if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    },
    onIntervalChange(e) {
      const val = Number(e.target.value)
      this.$emit('interval-change', val)
      // 短暂旋转图标提示已更新
      this.spinning = true
      if (this.spinTimer) clearTimeout(this.spinTimer)
      this.spinTimer = setTimeout(() => { this.spinning = false }, 1200)
    }
  }
}
</script>

<style scoped>
.screen-back { font: inherit; background: transparent; cursor: pointer; }
</style>
