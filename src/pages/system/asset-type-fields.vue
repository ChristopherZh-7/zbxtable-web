<template>
  <a-drawer
    :title="`配置显示字段 — ${assetType ? assetType.name : ''}`"
    :visible="visible"
    :width="980"
    :destroy-on-close="true"
    @close="$emit('close')"
  >
    <div class="field-toolbar">
      <div class="field-hint">
        仅可调整字段的显示、顺序和内置字段渲染方式。历史自定义字段只读保留，不属于 CMDB；资产模型请在资产配置中心维护。
      </div>
    </div>

    <a-spin :spinning="loading">
      <a-table
        :data-source="fields"
        :pagination="false"
        row-key="_rowKey"
        size="small"
        :columns="tableColumns"
      >
        <span slot="visible" slot-scope="text, record">
          <a-checkbox :checked="record.visible" @change="record.visible = !record.visible" />
        </span>
        <span slot="label" slot-scope="text, record">
          <template v-if="record.custom">
            <span>{{ record.label || record.key }}</span>
            <a-tag color="orange" class="legacy-tag">历史只读 · 非 CMDB</a-tag>
          </template>
          <a-input v-else v-model.trim="record.label" size="small" style="width: 140px;" />
        </span>
        <span slot="fieldType" slot-scope="text, record">
          <a-tag v-if="record.custom">{{ fieldTypeLabel(record.field_type) }}</a-tag>
          <a-tag v-else>内置</a-tag>
        </span>
        <span slot="options" slot-scope="text, record">
          <template v-if="record.custom && record.field_type === 'select' && record.options && record.options.length">
            <a-tag v-for="option in record.options" :key="option">{{ option }}</a-tag>
          </template>
          <span v-else class="muted">--</span>
        </span>
        <span slot="width" slot-scope="text, record">
          <a-input-number
            v-model="record.width"
            :min="0"
            :max="2000"
            :step="10"
            size="small"
            style="width: 88px;"
          />
        </span>
        <span slot="render" slot-scope="text, record">
          <a-select
            v-if="!record.custom"
            v-model="record.render"
            size="small"
            style="width: 100px;"
          >
            <a-select-option
              v-for="opt in renderOptions"
              :key="opt.value"
              :value="opt.value"
            >
              <a-tag :color="opt.color" style="margin: 0;">{{ opt.label }}</a-tag>
            </a-select-option>
          </a-select>
          <a-tag v-else>text</a-tag>
        </span>
        <span slot="actions" slot-scope="text, record, index">
          <a-button
            icon="up"
            size="small"
            :disabled="index === 0"
            @click="moveUp(index)"
            style="margin-right: 4px;"
          />
          <a-button
            icon="down"
            size="small"
            :disabled="index === fields.length - 1"
            @click="moveDown(index)"
          />
        </span>
      </a-table>
    </a-spin>

    <div class="drawer-footer">
      <a-button style="margin-right: 8px;" @click="$emit('close')">取消</a-button>
      <a-button type="primary" :loading="saving" @click="handleSave">保存配置</a-button>
    </div>
  </a-drawer>
</template>

<script>
import { getAssetTypeFields, updateAssetTypeFields } from '@/services/admin';

// 所有可配置的列表字段定义
const ALL_FIELDS = [
  { key: 'hostid',             label: '主机ID',    render: 'text',     group: '基础' },
  { key: 'name',               label: '设备名称',  render: 'text',     group: '基础' },
  { key: 'instance_name',      label: '所属实例',  render: 'tag',      group: '基础' },
  { key: 'interfaces',         label: 'IP地址',   render: 'text',     group: '基础' },
  { key: 'os',                 label: '操作系统',  render: 'text',     group: '系统' },
  { key: 'model',              label: '设备型号',  render: 'text',     group: '硬件' },
  { key: 'serial_no',         label: '序列号',    render: 'text',     group: '硬件' },
  { key: 'vendor',             label: '厂商',      render: 'text',     group: '硬件' },
  { key: 'location',           label: '设备位置',  render: 'text',     group: '硬件' },
  { key: 'department',         label: '部门',      render: 'text',     group: '信息' },
  { key: 'resource_id',        label: '资产编号',  render: 'text',     group: '信息' },
  { key: 'date_hw_expiry',     label: '维保到期',  render: 'text',     group: '信息' },
  { key: 'date_hw_install',    label: '安装时间',  render: 'text',     group: '信息' },
  { key: 'mac',                label: 'MAC地址',  render: 'text',     group: '网络' },
  { key: 'uptime',             label: '运行时长',  render: 'text',     group: '性能' },
  { key: 'cpu_utilization',    label: 'CPU使用率', render: 'progress', group: '性能' },
  { key: 'memory_utilization', label: '内存使用率', render: 'progress', group: '性能' },
  { key: 'memory_used',        label: '内存用量',  render: 'text',     group: '性能' },
  { key: 'memory_total',       label: '内存总量',  render: 'text',     group: '性能' },
  { key: 'available',          label: '接口可用性', render: 'status',   group: '状态' },
  { key: 'ping',               label: 'Ping状态',  render: 'ping',     group: '状态' },
];

const RENDER_OPTIONS = [
  { value: 'text',     label: 'text',     color: 'default' },
  { value: 'progress', label: 'progress', color: 'blue'    },
  { value: 'status',   label: 'status',   color: 'green'   },
  { value: 'ping',     label: 'ping',     color: 'cyan'    },
  { value: 'tag',      label: 'tag',      color: 'orange'  },
  { value: 'link',     label: 'link',     color: 'purple'  },
];

const FIELD_TYPE_LABELS = {
  text: '文本',
  number: '数字',
  date: '日期',
  select: '单选下拉',
};

export default {
  name: 'AssetTypeFieldDrawer',
  props: {
    visible:   { type: Boolean, required: true },
    assetType: { type: Object,  default: null },
  },
  data() {
    return {
      loading: false,
      saving: false,
      fields: [],
      renderOptions: RENDER_OPTIONS,
      tableColumns: [
        { title: '显示', key: 'visible', width: 60,  scopedSlots: { customRender: 'visible' } },
        { title: '字段键', dataIndex: 'key', key: 'key', width: 190, ellipsis: true },
        { title: '显示名称', key: 'label', width: 160, scopedSlots: { customRender: 'label' } },
        { title: '字段类型', key: 'field_type', width: 120, scopedSlots: { customRender: 'fieldType' } },
        { title: '下拉选项', key: 'options', width: 240, scopedSlots: { customRender: 'options' } },
        { title: '列宽', key: 'width', width: 110, scopedSlots: { customRender: 'width' } },
        { title: '渲染', key: 'render', dataIndex: 'render', width: 110, scopedSlots: { customRender: 'render' } },
        { title: '操作', key: 'actions', width: 150, scopedSlots: { customRender: 'actions' } },
      ],
    };
  },
  watch: {
    visible(val) {
      if (val && this.assetType) this.loadFields();
    },
  },
  methods: {
    async loadFields() {
      this.loading = true;
      try {
        const res = await getAssetTypeFields(this.assetType.id);
        const biz = res && res.data ? res.data : res;
        const serverFields = (biz && biz.code === 200 && biz.data) ? biz.data : [];
        const keyToServer = {};
        serverFields.forEach((f) => { keyToServer[f.key] = f; });
        // 合并：服务端配置优先，未配置的字段补充为不可见
        const builtins = ALL_FIELDS.map((meta, idx) => {
          if (keyToServer[meta.key]) {
            return { ...meta, ...keyToServer[meta.key], custom: false, _rowKey: meta.key };
          }
          return { ...meta, custom: false, visible: false, width: 0, sortable: false, order: 100 + idx, _rowKey: meta.key };
        });
        const custom = serverFields
          .filter((field) => field.custom)
          .map((field) => ({
            ...field,
            options: field.options || [],
            _rowKey: field.key,
            // 历史字段的身份与类型不能变更；列宽、显示和顺序仍属于本地展示配置。
            _readOnlyDefinition: {
              key: field.key,
              label: field.label,
              render: field.render,
              sortable: field.sortable,
              field_type: field.field_type,
              options: [...(field.options || [])],
            },
          }));
        const merged = [...builtins, ...custom];
        merged.sort((a, b) => a.order - b.order);
        this.fields = merged;
      } catch {
        this.$message.error('加载字段配置失败');
      } finally {
        this.loading = false;
      }
    },
    fieldTypeLabel(type) {
      return FIELD_TYPE_LABELS[type] || type || '未知';
    },
    moveUp(idx) {
      if (idx === 0) return;
      const arr = [...this.fields];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      arr.forEach((f, i) => { f.order = i; });
      this.fields = arr;
    },
    moveDown(idx) {
      if (idx >= this.fields.length - 1) return;
      const arr = [...this.fields];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      arr.forEach((f, i) => { f.order = i; });
      this.fields = arr;
    },
    async handleSave() {
      const invalid = this.fields.find((field) => !field.custom && !field.label);
      if (invalid) {
        this.$message.warning('请填写内置字段的显示名称');
        return;
      }
      this.saving = true;
      try {
        const payload = this.fields.map((f, i) => {
          const definition = f.custom && f._readOnlyDefinition ? f._readOnlyDefinition : f;
          return {
            key:      definition.key,
            label:    definition.label,
            render:   definition.render,
            width:    f.width || 0,
            visible:  !!f.visible,
            sortable: !!definition.sortable,
            order:    i,
            custom:   !!f.custom,
            field_type: f.custom ? definition.field_type : '',
            options:  f.custom && definition.field_type === 'select' ? (definition.options || []) : [],
          };
        });
        const res = await updateAssetTypeFields(this.assetType.id, payload);
        const biz = res && res.data ? res.data : res;
        if (biz && biz.code === 200) {
          this.$message.success('字段配置已保存');
          this.$emit('saved');
          this.$emit('close');
        } else {
          this.$message.error((biz && biz.message) || '保存失败');
        }
      } catch {
        this.$message.error('保存失败');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style lang="less" scoped>
.drawer-footer {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  border-top: 1px solid #e8e8e8;
  padding: 10px 16px;
  text-align: right;
  background: #fff;
}
.field-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.field-hint, .muted {
  color: #888;
  font-size: 12px;
}
.legacy-tag {
  margin-top: 4px;
  white-space: nowrap;
}
</style>
