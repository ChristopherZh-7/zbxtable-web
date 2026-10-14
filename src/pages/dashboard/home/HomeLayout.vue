<template>
  <div :class="['home-layout', {'home-layout--editing': editing}]">
    <div class="smartops-page-heading workplace-heading">
      <slot name="heading" />
      <div class="home-heading-actions">
        <span class="home-layout-label">{{ editing ? '正在编辑主页' : customized ? '我的布局' : '默认布局' }}</span>
        <a-button v-if="!editing" type="primary" icon="edit" @click="startEditing">编辑主页</a-button>
      </div>
    </div>
    <div v-if="editing" class="home-edit-toolbar" role="region" aria-label="主页编辑工具">
      <div class="home-edit-toolbar__help">
        <strong><a-icon type="drag" /> 拖动卡片手柄调整顺序</strong>
        <span>自动对齐，统一间距；保存到本机当前账号与租户。</span>
      </div>
      <span class="home-layout-label">{{ draftWidgets.length }} 个组件</span>
    </div>
    <div v-if="editing" class="home-edit-dock" role="region" aria-label="主页保存操作">
      <span class="home-layout-label">{{ dirty ? '有未保存的修改' : '编辑主页' }}</span>
      <div class="home-edit-toolbar__actions">
        <a-button icon="plus" @click="catalogOpen = true">添加组件</a-button>
        <a-button @click="restoreDefault">恢复默认布局</a-button>
        <a-button @click="cancelEditing">取消</a-button>
        <a-button type="primary" icon="save" @click="save">保存主页</a-button>
      </div>
    </div>
    <a-alert v-if="notice" class="home-layout-notice" :message="notice" type="warning" show-icon />
    <draggable
      v-model="displayWidgets" class="home-widget-grid" tag="div" handle=".home-widget-handle"
      :disabled="!editing" :animation="180" ghost-class="home-widget-ghost" @start="dragging = true" @end="dragging = false"
    >
      <section v-for="(widget, index) in displayWidgets" :key="widget.type"
        :class="['home-widget', 'home-widget--' + widget.type, {'home-widget--editing': editing, 'home-widget--narrow': widget.columns === 4}]"
        :data-widget="widget.type" :aria-label="definition(widget.type).title"
        :style="{'--widget-columns': widget.columns, '--widget-rows': widget.rows, '--mobile-widget-rows': Math.max(3, widget.rows)}">
        <div v-if="editing" class="home-widget-tools">
          <button type="button" class="home-widget-handle" :aria-label="'拖动' + definition(widget.type).title" title="拖动排序；也可使用方向按钮移动"><a-icon type="drag" /></button>
          <label><span class="sr-only">{{ definition(widget.type).title }}宽度</span>
            <select v-model.number="widget.columns" :aria-label="definition(widget.type).title + '宽度'">
              <option v-for="width in definition(widget.type).widths" :key="width" :value="width">{{ width === 12 ? '整行' : width === 6 ? '半行' : '三分之一行' }}</option>
            </select>
          </label>
          <label><span class="sr-only">{{ definition(widget.type).title }}高度</span>
            <select v-model.number="widget.rows" :aria-label="definition(widget.type).title + '高度'">
              <option v-for="height in definition(widget.type).heights" :key="height" :value="height">{{ heightLabels[height] }}</option>
            </select>
          </label>
          <span class="home-widget-tools__spacer" />
          <button type="button" :disabled="index === 0" :aria-label="'前移' + definition(widget.type).title" title="前移" @click="move(widget.type, -1)"><a-icon type="arrow-up" /></button>
          <button type="button" :disabled="index === displayWidgets.length - 1" :aria-label="'后移' + definition(widget.type).title" title="后移" @click="move(widget.type, 1)"><a-icon type="arrow-down" /></button>
          <button type="button" class="home-widget-remove" :aria-label="'移除' + definition(widget.type).title" title="从主页移除" @click="remove(widget.type)"><a-icon type="close" /></button>
        </div>
        <div class="home-widget-content">
          <div v-if="errors[widget.type]" class="home-widget-error">
            <a-icon type="exclamation-circle" /><strong>{{ definition(widget.type).title }}暂时无法获取</strong>
            <span>请检查连接后重试。</span><a-button size="small" @click="$emit('retry', widget.type)">重新加载</a-button>
          </div>
          <slot v-else :name="widget.type" />
        </div>
      </section>
    </draggable>
    <div v-if="!displayWidgets.length" class="home-layout-empty">
      <a-empty description="主页还没有组件">
        <a-button type="primary" icon="plus" @click="openCatalog">添加组件</a-button>
        <a-button @click="restoreDefault">恢复默认布局</a-button>
      </a-empty>
    </div>
    <a-drawer wrap-class-name="smartops-management-dialog" title="添加主页组件" :visible="catalogOpen" width="min(360px, 100vw)" @close="catalogOpen = false">
      <p class="home-catalog-description">与主页共用原版组件与真实数据。添加后可调整大小和顺序。</p>
      <div v-for="widget in catalog" :key="widget.type" class="home-catalog-item">
        <span class="home-catalog-icon"><a-icon :type="widget.icon" /></span>
        <div><strong>{{ widget.title }}</strong><p>{{ widget.description }}</p>
          <span v-if="contains(widget.type)" class="home-catalog-added"><a-icon type="check" /> 已添加</span>
          <a-button v-else size="small" icon="plus" :aria-label="'添加' + widget.title" @click="add(widget.type)">添加</a-button>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script>
import draggable from 'vuedraggable'
import {HOME_WIDGETS, widgetDefinition, createHomeWidget, defaultHomeLayout, normalizeHomeLayout,
  moveHomeWidget, homeLayoutKey, homeStorage, readHomeLayout, saveHomeLayout} from './home-layout'

export default {
  name: 'HomeLayout',
  components: {draggable},
  props: {errors: {type: Object, default: () => ({})}},
  data() {
    return {savedWidgets: defaultHomeLayout(), draftWidgets: [], editing: false, catalogOpen: false,
      dragging: false, notice: '', loadedKey: null, savedRaw: null,
      catalog: HOME_WIDGETS, heightLabels: {2: '紧凑高度', 3: '标准高度', 4: '中等高度', 6: '加高', 8: '超高'}}
  },
  computed: {
    contextKey() { return homeLayoutKey(this.$store) },
    displayWidgets: {
      get() { return this.editing ? this.draftWidgets : this.savedWidgets },
      set(value) { if (this.editing) this.draftWidgets = normalizeHomeLayout(value) },
    },
    dirty() { return this.editing && JSON.stringify(this.draftWidgets) !== JSON.stringify(this.savedWidgets) },
    customized() { return JSON.stringify(this.savedWidgets) !== JSON.stringify(defaultHomeLayout()) },
  },
  watch: {contextKey: {immediate: true, handler() { this.load() }}},
  mounted() { window.addEventListener('beforeunload', this.beforeUnload) },
  beforeDestroy() { window.removeEventListener('beforeunload', this.beforeUnload) },
  methods: {
    definition: widgetDefinition,
    load() {
      const result = readHomeLayout(homeStorage(window), this.contextKey)
      this.loadedKey = this.contextKey
      this.savedWidgets = result.widgets
      this.savedRaw = result.raw
      this.draftWidgets = []
      this.editing = false
      this.catalogOpen = false
      this.notice = result.status === 'invalid' ? '已保存的布局无法识别，暂用默认布局；可重新编辑并保存。'
        : result.status === 'unavailable' ? '当前浏览器或账号状态无法读取个人布局，暂用默认布局。' : ''
    },
    startEditing() {
      if (this.editing) return
      this.load()
      this.draftWidgets = normalizeHomeLayout(this.savedWidgets)
      this.editing = true
    },
    openCatalog() { this.startEditing(); this.catalogOpen = true },
    contains(type) { return this.displayWidgets.some(widget => widget.type === type) },
    add(type) {
      if (!this.editing || this.contains(type)) return
      const widget = createHomeWidget(type)
      if (widget) this.draftWidgets.push(widget)
    },
    remove(type) { if (this.editing) this.draftWidgets = this.draftWidgets.filter(widget => widget.type !== type) },
    move(type, offset) { if (this.editing) this.draftWidgets = moveHomeWidget(this.draftWidgets, type, offset) },
    restoreDefault() { this.startEditing(); this.draftWidgets = defaultHomeLayout() },
    cancelEditing() { this.load() },
    save() {
      if (!this.editing) return
      if (!this.contextKey || this.loadedKey !== this.contextKey) {
        this.notice = '账号或租户已变化，请取消编辑后重新加载主页。'
        return
      }
      const result = saveHomeLayout(homeStorage(window), this.contextKey, this.draftWidgets, this.savedRaw)
      if (!result.ok) {
        this.notice = result.reason === 'conflict' ? '主页布局已在其他页面更新。请取消编辑后重新调整，避免覆盖新布局。'
          : '浏览器无法保存布局，修改仍保留在当前编辑中。请允许本站使用本地存储后重试。'
        this.$message.error('主页尚未保存')
        return
      }
      this.savedWidgets = normalizeHomeLayout(this.draftWidgets)
      this.savedRaw = result.raw
      this.editing = false
      this.catalogOpen = false
      this.notice = ''
      this.$message.success('主页已保存')
    },
    beforeUnload(event) {
      if (!this.dirty) return
      event.preventDefault()
      event.returnValue = ''
    },
    confirmLeave(next) {
      if (!this.dirty) return next()
      this.$confirm({title: '主页修改尚未保存', content: '离开会放弃本次修改。也可以留在主页继续编辑或保存。',
        okText: '放弃并离开', cancelText: '继续编辑',
        onOk: () => { this.cancelEditing(); next() }, onCancel: () => next(false)})
    },
  },
}
</script>

<style lang="less">
.home-layout {
  .workplace-heading { gap: 16px; flex-wrap: wrap; }
  .home-heading-actions { display: flex; align-items: center; gap: 12px; }
  .home-layout-label { font-size: 12px; color: #61758c; }
  .home-edit-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 16px; margin-bottom: 16px; background: #eef5fc; border: 1px solid #b9d0e8; border-radius: 4px; }
  &.home-layout--editing { padding-bottom: 80px; }
  .home-edit-dock { position: fixed; right: 30px; bottom: 20px; z-index: 20; display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 16px; max-width: calc(100vw - 32px); padding: 12px 16px; background: #fff; border: 1px solid #b9d0e8; border-radius: 6px; box-shadow: 0 4px 20px rgba(27, 57, 90, .16); }
  .home-edit-toolbar__help { display: flex; flex-direction: column; gap: 4px; color: #1b5a96; font-size: 13px; span { color: #536d89; font-size: 12px; } }
  .home-edit-toolbar__actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .home-layout-notice { margin-bottom: 16px; }
  .home-widget-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: 64px; gap: 16px; margin-bottom: 20px; }
  .home-widget { grid-column: span var(--widget-columns); grid-row: span var(--widget-rows); min-width: 0; min-height: 0; display: flex; flex-direction: column; border-radius: 4px; }
  .home-widget--editing { outline: 1px solid #a3bfdc; }
  .home-widget-ghost { opacity: .35; outline: 2px dashed #1b5a96; }
  .home-widget-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 5px 6px; background: #eaf2fa; border-bottom: 1px solid #c7d9eb; border-radius: 4px 4px 0 0; flex-shrink: 0; }
  .home-widget-tools button, .home-widget-tools select { height: 26px; min-width: 26px; border: 1px solid #bdcfe1; border-radius: 3px; background: #fff; color: #244867; font-size: 12px; cursor: pointer; }
  .home-widget-tools button:hover, .home-widget-tools select:hover { border-color: #1b5a96; background: #f5f9ff; }
  .home-widget-tools button:focus-visible, .home-widget-tools select:focus-visible { outline: 2px solid #1b5a96; outline-offset: 2px; }
  .home-widget-tools button:disabled { color: #94a4b5; cursor: default; background: #f5f7fa; }
  .home-widget-tools label { margin: 0; }
  .home-widget-tools .home-widget-handle { cursor: grab; background: transparent; border-color: transparent; touch-action: none; }
  .home-widget-tools .home-widget-remove { color: #b63c3c; }
  .home-widget-tools__spacer { flex: 1; }
  .home-widget-content { flex: 1; min-height: 0; }
  .home-widget-content > .ant-card { height: 100%; display: flex; flex-direction: column; border-radius: 4px; }
  .home-widget-content > .ant-card > .ant-card-head { flex: none; min-height: 40px; }
  .home-widget-content > .ant-card > .ant-card-body { flex: 1; min-height: 0 !important; height: auto !important; overflow: auto; }
  .home-widget--summary .ant-card-body { padding: 8px 12px; }
  .home-widget-content .homeMain { min-height: 0; max-height: none; height: 100%; padding: 6px 0; }
  .home-widget-content .homeMain.is-empty { display: grid; place-items: center; }
  .home-widget-content .homeMain .ant-timeline-item-content { overflow-wrap: anywhere; }
  .home-widget-content .homeTopList { padding: 6px 12px; }
  .home-widget-content .homeTopList .listBody { height: auto; max-height: none; }
  .home-widget-content .homeTopList .listBody.is-empty { min-height: 100px; }
  .home-widget-content .homeTopList .topListItem.empty { display: none; }
  .home-widget-content .homeTopList .topListItem .col-metric { min-width: 0; gap: 5px; padding: 0 5px; }
  .home-widget-content .homeTopList .topListItem .col-metric .legent { min-width: 0; }
  .home-widget-content .homeTopList .topListItem .col-metric .metric-value { flex-basis: 52px; }
  .home-widget-content .homeTopList .topListItem .col-name { gap: 6px; }
  .home-widget-content .homeTopList .host-info { flex-wrap: wrap; }
  .home-widget-content .homeTopList .hostname { flex-basis: 100%; }
  .home-widget-content .device-stat-grid { min-height: 0; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .home-widget--narrow .device-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-widget-content .device-stat-card { min-height: 70px; padding: 10px; }
  .home-widget-content .device-count { font-size: 24px; }
  .home-widget-error, .home-layout-empty { border: 1px solid #dce4ed; border-radius: 4px; background: #fff; padding: 24px; }
  .home-widget-error { height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: #61758c; strong { color: #244867; } }
  .home-layout-empty .ant-btn + .ant-btn { margin-left: 8px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
}
.home-catalog-description { font-size: 12px; line-height: 1.7; color: #61758c; }
.home-catalog-item { display: flex; gap: 12px; border: 1px solid #dce4ed; border-radius: 4px; padding: 14px; margin: 12px 0; background: #fff; strong { color: #163452; } p { color: #61758c; font-size: 12px; margin: 6px 0 10px; line-height: 1.6; } }
.home-catalog-icon { width: 32px; height: 32px; display: grid; place-items: center; background: #edf4fb; color: #1b5a96; border-radius: 4px; flex: none; }
.home-catalog-added { color: #35634c; font-size: 12px; }
@media (max-width: 1100px) { .home-layout .home-widget { grid-column: span 12; } }
@media (max-width: 600px) {
  .home-layout .home-widget-grid { gap: 12px; }
  .home-layout .home-widget { grid-row: span var(--mobile-widget-rows); }
  .home-layout .home-widget-content .device-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-layout .home-edit-dock { left: 16px; right: 16px; bottom: 12px; gap: 8px; padding: 10px; }
  .home-layout .home-edit-dock > .home-layout-label { display: none; }
  .home-layout .home-edit-toolbar__actions { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); }
  .home-layout.home-layout--editing { padding-bottom: 120px; }
}
</style>
