<template>
  <page-layout :noTitle="true">
    <a-form-model class="home-search" layout="inline" :colon='false'>
      <a-form-model-item :label="$t('mutes_search_label')">
        <a-input v-model.trim="hosts" :placeholder="$t('mutes_search_placeholder')" />
      </a-form-model-item>
      <!-- 实例筛选已取消：统一跟随顶部“当前 Zabbix 连接” -->
      <a-form-model-item>
        <a-button type="primary" @click="init">{{ $t('mutes_btn_query') }}</a-button>
        <a-button style="margin-left: 10px;" @click="resetData">{{ $t('mutes_btn_reset') }}</a-button>
        <a-button type="primary" style="margin-left: 10px;" @click="showModal">{{ $t('mutes_btn_add') }}</a-button>
      </a-form-model-item>
    </a-form-model>
    <div>
      <a-table :scroll="{ x: 'max-content' }" :loading="loading" :columns="columns" :data-source="list" @change="changePage" :pagination="pagination" :rowKey="(record) => { return record.id;}">
        <div slot="instance_name" slot-scope="text">
          <a-tag :color="themeColor">{{ getInstanceNames(text) || '-' }}</a-tag>
        </div>
        <span slot="status" slot-scope="text, record">
          <a-switch :checked="record.status == '0' ? true : false" :checked-children="$t('status_enabled')" :un-checked-children="$t('status_disabled')" @change="onStatusChange($event, record)" />
        </span>
        <span slot="s_time" slot-scope="text">{{ formatRuleTime(text) }}</span>
        <span slot="e_time" slot-scope="text">{{ formatRuleTime(text) }}</span>
        <span slot="created" slot-scope="text">{{ text | parsetime }}</span>
        <span slot="expires_at" slot-scope="text, record">{{ record.time_mode === 'absolute' ? formatServerTimestamp(text) : '-' }}</span>
        <span slot="validity" slot-scope="text, record" :title="$t('mutes_server_reference_hint')">{{ expiryLabel(record) }}</span>
        <span slot="operation" slot-scope="text, record">
          <!-- <a-button class="pd20 paddingleft0" type="link" size="small" @click="seeDetail(record)">详细信息</a-button> -->
          <a-button class="pd20 paddingleft0" type="link" size="small" @click="seeEdit(record)">{{ $t('btn_edit') }}</a-button>
          <a-popconfirm :title="$t('confirm_delete_title')" :ok-text="$t('confirm_delete_ok')" :cancel-text="$t('confirm_delete_cancel')" @confirm="deleteRecord(record)">
            <a-button class="paddingleft0" type="link" size="small">{{ $t('btn_delete') }}</a-button>
          </a-popconfirm>
        </span>
      </a-table>
      <p class="mute-time-hint">{{ $t('mutes_server_reference_hint') }}</p>
    </div>
    <a-modal :title="$t('mutes_modal_title_add')" :visible="visible" :confirm-loading="confirmLoading" @ok="createRule" @cancel="handleCancel" width="1000px">
      <template>
        <a-form-model :model="rule">
          <a-form-model-item :label="$t('mutes_form_name')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="name" :required="true">
            <a-input v-model.trim="rule.name" :placeholder="$t('mutes_form_name_placeholder')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('mutes_form_instance')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="zid" :required="true">
            <a-select v-model="rule.zid" mode="multiple" style="width: 100%" :placeholder="$t('mutes_form_instance_placeholder')" @change="handleTenantChange">
              <a-select-option v-for="(item, index) in tenantlist" :key="index" :value="String(item.id != null ? item.id : item.zid)" :label="item.name || String(item.id != null ? item.id : item.zid)" :title="item.name || String(item.id != null ? item.id : item.zid)">
                {{ item.name || item.id || item.zid }}
              </a-select-option>
            </a-select>
          </a-form-model-item>
          <a-card class="card" :title="$t('mutes_form_condition_card_title')" :bordered="false">
            <a-row class="form-row" v-for="(itv, its) in rule.conditions" :key="its">
              <a-col :lg="6" :md="12" :sm="24">
                <a-form-item :label="$t('mutes_form_field')" :required="false">
                  <a-select v-model="itv.r_type">
                    <a-select-option v-for="(item, index) in rTypeOptions" :key="index" :value="item.value" :label="item.label" :title="item.label">
                      {{ item.label }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :xl="{span: 6, offset: 1}" :lg="{span: 8}" :md="{span: 12}" :sm="24">
                <a-form-item :label="$t('mutes_form_operator')">
                  <a-select v-model="itv.r_func">
                    <a-select-option v-for="(item, index) in rFuncOptions" :key="index" :value="item.value" :label="item.label" :title="item.label">
                      {{ item.label }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :xl="{span: 6, offset: 1}" :lg="{span: 10}" :md="{span: 24}" :sm="24">
                <a-form-item :label="$t('mutes_form_value')" :required="false">
                  <a-input v-model="itv.r_value" :placeholder="$t('mutes_form_value_placeholder')" />
                </a-form-item>
              </a-col>
              <a-col :span="2" :offset="1">
                <a-form-item :label="$t('mutes_form_operation')" :required="false">
                  <a-button type="primary" style="margin-right: 10px" v-if="rule.conditions && rule.conditions.length > 1" icon="delete" shape="circle" @click="rule.conditions.splice(its, 1)" />
                  <a-button type="primary" v-if="its == 0" icon="plus" shape="circle" @click='rule.conditions.push({ r_type: "", r_func: "", r_value: "",})' />
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>
          <a-card class="card" :title="$t('mutes_form_time_card_title')" :bordered="false">
            <a-form-model-item :label="$t('mutes_time_mode')" :labelCol="{span: 4}" :wrapperCol="{span: 18}" :required="true">
              <a-radio-group v-model="timeMode" data-testid="mute-time-mode" @change="changeTimeMode($event.target.value)">
                <a-radio value="absolute">{{ $t('mutes_time_absolute') }}</a-radio>
                <a-radio value="permanent">{{ $t('mutes_time_permanent') }}</a-radio>
                <a-radio value="weekly">{{ $t('mutes_time_weekly') }}</a-radio>
              </a-radio-group>
            </a-form-model-item>
            <template v-if="timeMode === 'absolute'">
              <a-form-model-item :label="$t('mutes_form_duration')" :labelCol="{span: 4}" :wrapperCol="{span: 16}" :required="true">
                <a-select v-model="absoluteDuration" data-testid="mute-absolute-duration" style="width: 100%">
                  <a-select-option v-for="item in absoluteDurationOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                </a-select>
              </a-form-model-item>
              <p class="mute-time-hint">{{ $t('mutes_absolute_create_hint') }}</p>
            </template>
            <template v-else>
              <a-form-model-item :label="$t('form_label_week')" :labelCol="{span: 4}" :wrapperCol="{span: 16}" :required="true">
                <a-select v-model="rule.s_week" mode="multiple" style="width: 100%">
                  <a-select-option v-for="item in rWeekOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                </a-select>
              </a-form-model-item>
              <a-row>
                <a-col :span="12">
                  <a-form-model-item :label="$t('mutes_form_start_time')" :labelCol="{span: 6}" :wrapperCol="{span: 16}" :required="true">
                    <a-time-picker v-model="rule.s_time" format="HH:mm" :disabled="timeMode === 'permanent'" @change="changeStime" />
                  </a-form-model-item>
                </a-col>
                <a-col :span="12">
                  <a-form-model-item :label="$t('mutes_form_end_time')" :labelCol="{span: 6}" :wrapperCol="{span: 16}" :required="true">
                    <a-time-picker v-model="rule.e_time" format="HH:mm" :disabled="timeMode === 'permanent'" @change="changeEtime" />
                  </a-form-model-item>
                </a-col>
              </a-row>
              <p class="mute-time-hint">{{ $t('mutes_weekly_hint') }}</p>
            </template>
            <a-row>
              <a-col :span="16">
                <a-form-model-item :label="$t('mutes_form_mute_channels')" :labelCol="{span: 4}" :wrapperCol="{span: 16}" :required="true">
                  <a-checkbox-group v-model="rule.channel" :options="rChannelOptions" @change="onChannelChange">
                  </a-checkbox-group>
                </a-form-model-item>
              </a-col>
            </a-row>
            <a-row>
              <a-col :span="16">
                <a-form-model-item :label="$t('mutes_form_mute_note')" :labelCol="{span:4}" :wrapperCol="{span: 18}" :required="true">
                  <a-textarea v-model.trim="rule.note" :placeholder="$t('mutes_form_mute_note_placeholder')" :rows="2" />
                </a-form-model-item>
              </a-col>
            </a-row>
          </a-card>
        </a-form-model>
      </template>
    </a-modal>
    <a-modal :title="$t('mutes_modal_title_edit')" :visible="visibleEdit" :confirm-loading="confirmLoading" @ok="updateRule" @cancel="handleEditCancel" width="1000px">
      <template>
        <a-form-model :model="rule">
          <a-form-model-item :label="$t('mutes_form_name')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="name" :required="true">
            <a-input v-model.trim="rule.name" :placeholder="$t('mutes_form_name_placeholder')" />
          </a-form-model-item>
          <a-form-model-item :label="$t('mutes_form_instance')" :labelCol="{span: 7}" :wrapperCol="{span: 10}" prop="zid">
            <a-select v-model="rule.zid" mode="multiple" style="width: 100%" :placeholder="$t('mutes_form_instance_placeholder')" @change="handleTenantChange" :required="true">
              <a-select-option v-for="(item, index) in tenantlist" :key="index" :value="String(item.id != null ? item.id : item.zid)" :label="item.name || String(item.id != null ? item.id : item.zid)" :title="item.name || String(item.id != null ? item.id : item.zid)">
                {{ item.name || item.id || item.zid }}
              </a-select-option>
            </a-select>
          </a-form-model-item>
          <a-card class="card" :title="$t('mutes_form_condition_card_title')" :bordered="false">
            <a-row class="form-row" v-for="(itv, its) in rule.conditions" :key="its">
              <a-col :lg="6" :md="12" :sm="24">
                <a-form-item :label="$t('mutes_form_field')" :required="false">
                  <a-select v-model="itv.r_type">
                    <a-select-option v-for="(item, index) in rTypeOptions" :key="index" :value="item.value" :label="item.label" :title="item.label">
                      {{ item.label }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :xl="{span: 6, offset: 1}" :lg="{span: 8}" :md="{span: 12}" :sm="24">
                <a-form-item :label="$t('mutes_form_operator')">
                  <a-select v-model="itv.r_func">
                    <a-select-option v-for="(item, index) in rFuncOptions" :key="index" :value="item.value" :label="item.label" :title="item.label">
                      {{ item.label }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :xl="{span: 6, offset: 1}" :lg="{span: 10}" :md="{span: 24}" :sm="24">
                <a-form-item :label="$t('mutes_form_value')" :required="false">
                  <a-input v-model="itv.r_value" :placeholder="$t('mutes_form_value_placeholder')" />
                </a-form-item>
              </a-col>
              <a-col :span="2" :offset="1">
                <a-form-item :label="$t('mutes_form_operation')" :required="false">
                  <a-button type="primary" style="margin-right: 10px" v-if="rule.conditions && rule.conditions.length > 1" icon="delete" shape="circle" @click="rule.conditions.splice(its, 1)" />
                  <a-button type="primary" v-if="its == 0" icon="plus" shape="circle" @click='rule.conditions.push({ r_type: "", r_func: "", r_value: "",})' />
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>
          <a-card class="card" :title="$t('mutes_form_time_card_title')" :bordered="false">
            <div v-if="rule.time_mode === 'absolute'" data-testid="mute-expiry-readback">
              <p>{{ $t('mutes_time_mode') }}: {{ $t('mutes_time_absolute') }}</p>
              <p>{{ $t('mutes_server_created') }}: {{ formatServerTimestamp(rule.created) }}</p>
              <p>{{ $t('mutes_expires_at') }}: {{ formatServerTimestamp(rule.expires_at) }}</p>
              <p>{{ $t('mutes_validity_server') }}: {{ expiryLabel(rule) }}</p>
              <p>{{ $t('mutes_server_now') }}: {{ formatServerTimestamp(rule.server_now) }}</p>
              <p class="mute-time-hint">{{ $t('mutes_expiry_edit_hint') }}</p>
            </div>
            <template v-else-if="isLegacyTimeMode(rule)">
              <p class="mute-time-hint">{{ $t('mutes_weekly_hint') }}</p>
              <a-form-model-item :label="$t('form_label_week')" :labelCol="{span: 4}" :wrapperCol="{span: 16}" :required="true">
                <a-select v-model="rule.s_week" mode="multiple" style="width: 100%">
                  <a-select-option v-for="item in rWeekOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                </a-select>
              </a-form-model-item>
              <a-row>
                <a-col :span="12">
                  <a-form-model-item :label="$t('mutes_form_start_time')" :labelCol="{span: 6}" :wrapperCol="{span: 16}" :required="true">
                    <a-time-picker v-model="rule.s_time" format="HH:mm" @change="changeStime" />
                  </a-form-model-item>
                </a-col>
                <a-col :span="12">
                  <a-form-model-item :label="$t('mutes_form_end_time')" :labelCol="{span: 6}" :wrapperCol="{span: 16}" :required="true">
                    <a-time-picker v-model="rule.e_time" format="HH:mm" @change="changeEtime" />
                  </a-form-model-item>
                </a-col>
              </a-row>
            </template>
            <p v-else>{{ $t('mutes_expiry_invalid') }}</p>
            <a-row>
              <a-col :span="16">
                <a-form-model-item :label="$t('mutes_form_mute_channels')" :labelCol="{span: 4}" :wrapperCol="{span: 16}" :required="true">
                  <a-checkbox-group v-model="rule.channel" :options="rChannelOptions" @change="onChannelChange">
                  </a-checkbox-group>
                </a-form-model-item>
              </a-col>
            </a-row>
            <a-row>
              <a-col :span="16">
                <a-form-model-item :label="$t('mutes_form_mute_note')" :labelCol="{span:4}" :wrapperCol="{span: 18}" :required="true">
                  <a-textarea v-model.trim="rule.note" :placeholder="$t('mutes_form_mute_note_placeholder')" :rows="2" />
                </a-form-model-item>
              </a-col>
            </a-row>
          </a-card>
        </a-form-model>
      </template>
    </a-modal>
  </page-layout>
</template>

<script>
import { mapGetters } from 'vuex'
import PageLayout from "@/layouts/PageLayout";
import { ruleList, ruleAdd, rulePut, ruleStatusPut, ruleDelete } from "@/services/admin";
import { listZabbixInstance } from "@/services/zabbix";
import { parseTimeFun } from "@/utils/formatter";
import moment from "moment";
import "moment/locale/zh-cn";
import themeMixin from '@/mixins/themeMixin'
const alarmMessages = require('./i18n').messages
export default {
  name: "LinuxList",
  i18n: { messages: {
    CN: { ...alarmMessages.CN, mutes_col_window: '每日生效窗口（含起止分钟）', mutes_invalid_condition: '条件格式无效' },
    US: { ...alarmMessages.US, mutes_col_window: 'Daily window (inclusive minutes)', mutes_invalid_condition: 'Invalid condition format' },
    HK: { ...alarmMessages.HK, mutes_col_window: '每日生效窗口（含起止分鐘）', mutes_invalid_condition: '條件格式無效' },
  } },
  mixins: [themeMixin],
  computed: {
    ...mapGetters('account', ['user']),
  },
  components: {
    PageLayout,
  },
  data() {
    return {
      page: 1,
      pageSize: 10,
      loading: false,
      status: "",
      confirmLoading: false,
      visible: false,
      visibleEdit: false,
      level: "",
      rule: {
        name: "",
        zid: [],
        m_type: "3",
        conditions: [],
        s_week: ['0', '1', '2', '3', '4', '5', '6'],
        s_time: moment(),
        e_time: moment().add(1, 'hour'),
        channel: [],
        user_ids: "",
        group_ids: "",
        note: "",
        duration: "1h",
        status: "0",
      },
      rChannelOptions: [],
      rFuncOptions: [],
      rTypeOptions: [],
      rWeekOptions: [],
      columns: [],
      tOptions: [],
      absoluteDurationOptions: [],
      timeMode: 'weekly',
      absoluteDuration: 3600,
      tenantlist: [],
      list: [],
      pagination: {
        total: 0,
        current: 1,
        "show-quick-jumper": true,
        "page-size-options": ["10", "20", "30", "40", "50", "100", "200"],
        pageSize: 10,
        "show-size-changer": true,
        "show-total": () => ``,
      },
      duration: "1h",
      moment,
      tenantid: "",
      hosts: "",
    };
  },
  created() {
    this.initOptions();
    this.init();
    this.hostid = this.$route.query.hostid || ""
    this.host = this.$route.query.host || ""
    this.zid = this.$route.query.tenantid || ""
    this.message = this.$route.query.message || ""
    if (this.hostid != "") {
      this.rule = {
        name: this.host + " muted " + this.message,
        zid: this.zid,
        conditions: [{
          "r_type": "host",
          "r_func": "==",
          "r_value": this.host,
        }, {
          "r_type": "trigger",
          "r_func": "==",
          "r_value": this.message,
        }],
        s_week: ['0', '1', '2', '3', '4', '5', '6'],
        s_time: moment(),
        e_time: moment().add(1, 'hour'),
        note: this.host + " muted by " + this.$store.state.account['user'].name,
        duration: "1h",
        channel: [],
        m_type: "3",
        status: "0"
      }
      this.timeMode = 'absolute'
      this.absoluteDuration = 3600
      this.visible = true
    }
  },
  methods: {
    initOptions() {
      // 初始化通道选项
      this.rChannelOptions = [
        { value: "mail", label: this.$t('channel_mail') },
        { value: "wechat", label: this.$t('channel_wechat') },
        { value: "wechat_robot", label: this.$t('channel_wechat_robot') },
        // { value: "dingding", label: this.$t('channel_dingding') },
        // { value: "sms", label: this.$t('channel_sms') },
      ];
      
      // 初始化操作符选项
      this.rFuncOptions = [
        { value: "==", label: this.$t('mutes_operator_equal') },
        { value: "contains", label: this.$t('mutes_operator_contain') },
        { value: "!=", label: this.$t('mutes_operator_not_equal') },
        { value: "=~", label: "Regex" },
      ];

      this.rWeekOptions = [
        { value: "0", label: this.$t('week_sunday') },
        { value: "1", label: this.$t('week_monday') },
        { value: "2", label: this.$t('week_tuesday') },
        { value: "3", label: this.$t('week_wednesday') },
        { value: "4", label: this.$t('week_thursday') },
        { value: "5", label: this.$t('week_friday') },
        { value: "6", label: this.$t('week_saturday') },
      ];
      
      // 初始化字段选项
      this.rTypeOptions = [
        { value: "host", label: this.$t('mutes_field_hostname') },
        { value: "group", label: this.$t('mutes_field_hostgroup') },
        { value: "item", label: this.$t('mutes_field_item_name') },
        { value: "key", label: this.$t('mutes_field_item_key') },
        { value: "trigger", label: this.$t('mutes_field_trigger_name') },
        { value: "severity", label: this.$t('mutes_field_severity') }
      ];
      
      // 初始化时长选项
      this.tOptions = [
        { value: "1", label: this.$t('mutes_duration_1h') },
        { value: "2", label: this.$t('mutes_duration_2h') },
        { value: "3", label: this.$t('mutes_duration_5h') },
        { value: "6", label: this.$t('mutes_duration_8h') },
        { value: "12", label: this.$t('mutes_duration_12h') },
        { value: "24", label: this.$t('mutes_duration_1d') },
        { value: "48", label: this.$t('mutes_duration_2d') },
        { value: "120", label: this.$t('mutes_duration_5d') },
        { value: "168", label: this.$t('mutes_duration_7d') },
        { value: "336", label: this.$t('mutes_duration_14d') },
        { value: "720", label: this.$t('mutes_duration_30d') },
        { value: "1440", label: this.$t('mutes_duration_60d') },
        { value: "2160", label: this.$t('mutes_duration_90d') },
        { value: "86400", label: this.$t('mutes_duration_forever') },
      ];
      
      // New temporary rules use seconds; legacy hour/sentinel adapter stays separate.
      this.absoluteDurationOptions = [
        [3600, '1h'], [7200, '2h'], [18000, '5h'], [28800, '8h'], [43200, '12h'],
        [86400, '1d'], [172800, '2d'], [432000, '5d'], [604800, '7d'],
        [1209600, '14d'], [2592000, '30d'], [5184000, '60d'], [7776000, '90d'],
      ].map(([value, key]) => ({ value, label: this.$t('mutes_duration_' + key) }))

      // 初始化表格列
      this.columns = [
        { title: this.$t('mutes_col_id'), dataIndex: "id", align: "center" },
        { title: this.$t('mutes_col_policy_name'), dataIndex: "name", align: "left" },
        { title: this.$t('mutes_col_instance'), dataIndex: "z_ids", key: "instance_name", align: "left", scopedSlots: { customRender: "instance_name" } },
        { title: this.$t('mutes_col_mute_condition'), dataIndex: "conditions", align: "left", customRender: value => this.ruleConditionSummary(value) },
        {
          title: this.$t('mutes_col_window'), dataIndex: "duration", key: "duration", align: "left",
          customRender: (value, row) => this.ruleWindowDuration(row),
        },
        { title: this.$t('mutes_col_start_time'), dataIndex: "s_time", key: "s_time", align: "left", scopedSlots: { customRender: "s_time" }, },
        { title: this.$t('mutes_col_end_time'), dataIndex: "e_time", key: "e_time", align: "left", scopedSlots: { customRender: "e_time" }, },
        { title: this.$t('mutes_col_add_time'), dataIndex: "created", key: "created", align: "left", scopedSlots: { customRender: "created" }, },
        { title: this.$t('mutes_time_mode'), dataIndex: 'time_mode', customRender: (value, row) => this.$t(row.time_mode === 'absolute' ? 'mutes_time_absolute' : this.isLegacyTimeMode(row) ? 'mutes_time_weekly' : 'mutes_expiry_invalid') },
        { title: this.$t('mutes_expires_at'), dataIndex: 'expires_at', scopedSlots: { customRender: 'expires_at' } },
        { title: this.$t('mutes_validity_server'), key: 'validity', scopedSlots: { customRender: 'validity' } },
        { title: this.$t('mutes_col_policy_status'), dataIndex: "status", key: "status", align: "left", scopedSlots: { customRender: "status" }, },
        { title: this.$t('mutes_col_operation'), dataIndex: "operation", key: "operation", align: "left", scopedSlots: { customRender: "operation" } },
      ];
      
      // 更新分页文本
      this.pagination["show-total"] = (total) => this.$t('mutes_pagination_total', { total });
    },
    isLegacyTimeMode(row) {
      return !!row && (row.time_mode == null || row.time_mode === '' || row.time_mode === 'weekly') && (row.expires_at == null || row.expires_at === '')
    },
    serverInstant(value) {
      if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
      const parsed = moment.parseZone(value, moment.ISO_8601, true)
      return parsed.isValid() ? parsed : null
    },
    formatServerTimestamp(value) {
      const parsed = this.serverInstant(value)
      return parsed ? parsed.format('YYYY-MM-DD HH:mm:ss Z') : '-'
    },
    expiryState(row) {
      if (this.isLegacyTimeMode(row)) return 'weekly'
      if (!row || row.time_mode !== 'absolute') return 'invalid'
      const hasWeek = Array.isArray(row.s_week) ? row.s_week.length > 0 : !!row.s_week
      if (hasWeek || row.s_time || row.e_time) return 'invalid'
      const created = this.serverInstant(row.created)
      const expires = this.serverInstant(row.expires_at)
      if (!created || !expires || expires.valueOf() <= created.valueOf()) return 'invalid'
      // Only a server readback snapshot is authoritative here. Never use browser Date.now.
      const serverNow = this.serverInstant(row.server_now)
      if (!serverNow) return 'unconfirmed'
      if (serverNow.valueOf() < created.valueOf()) return 'pending'
      return serverNow.valueOf() >= expires.valueOf() ? 'expired' : 'active'
    },
    expiryLabel(row) {
      return this.$t('mutes_expiry_' + this.expiryState(row))
    },
    changeTimeMode(value) {
      if (this.rule.id || !['absolute', 'permanent', 'weekly'].includes(value)) return
      this.timeMode = value
      if (value === 'permanent') this.changeDuration('86400')
    },
    formatRuleTime(value) {
      return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '-'
    },
    ruleWindowDuration(row) {
      if (!row || this.formatRuleTime(row.s_time) === '-' || this.formatRuleTime(row.e_time) === '-') return '-'
      const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
      // F16 matches occurrence minutes inclusively, including across midnight.
      const minutes = (toMinutes(row.e_time) - toMinutes(row.s_time) + 1440) % 1440 + 1
      const hours = Math.floor(minutes / 60)
      const remainder = minutes % 60
      return (hours ? hours + this.$t('duration_hour') : '') + (remainder ? remainder + this.$t('duration_minute') : '')
    },
    ruleConditionSummary(raw) {
      if (raw == null || raw === '') return '-'
      let conditions = raw
      if (typeof raw === 'string') {
        try { conditions = JSON.parse(raw) } catch (error) { return this.$t('mutes_invalid_condition') }
      }
      if (!Array.isArray(conditions)) return this.$t('mutes_invalid_condition')
      if (!conditions.length) return '-'
      const labels = []
      for (const item of conditions) {
        if (!item || typeof item.r_type !== 'string' || typeof item.r_func !== 'string' ||
          (typeof item.r_value !== 'string' && typeof item.r_value !== 'number')) return this.$t('mutes_invalid_condition')
        const field = this.rTypeOptions.find(option => option.value === item.r_type)
        const operator = this.rFuncOptions.find(option => option.value === item.r_func)
        labels.push(`${field ? field.label : item.r_type} ${operator ? operator.label : item.r_func} ${item.r_value}`)
      }
      return labels.join(' AND ')
    },
    init() {
      this.loading = true;
      let req = {
        page: this.page, limit: this.pageSize,
        hosts: this.hosts,
        status: this.status, m_type: "3"
      };
      ruleList(req).then((resp) => {
        let res = resp.data;
        if (res.code == 200) {
          this.pagination.total = res.data.total;
          this.pagination.current = this.page;
          this.pagination.pageSize = this.pageSize;
          this.list = res.data.items || [];
        }
      }).finally(() => {
        this.loading = false;
      });
      listZabbixInstance().then((resp) => {
        const res = resp.data
        if (res.code == 200) {
          const allItems = Array.isArray(res.data) ? res.data : []
          this.tenantlist = allItems.filter(item => item && item.enabled)
        }
      })
    },
    getInstanceNames(zids) {
      const zidsText = zids == null ? "" : String(zids)
      const sourceList = zidsText.split(",").map(v => v.trim()).filter(Boolean)
      if (!sourceList.length) {
        return ""
      }
      const mapped = sourceList.map((item) => {
        const hit = this.tenantlist.find((tid) => String(item) === String(tid && (tid.id != null ? tid.id : tid.zid)))
        return hit ? (hit.name || String(item)) : String(item)
      })
      return mapped.join(",")
    },
    onStatusChange(e, record) {
      if (e) {
        record.status = 0
      } else {
        record.status = 1
      }
      this.loading = true;
      ruleStatusPut(record.id, this.rule = { status: String(record.status) }).then((resp) => {
        let res = resp.data;
        if (res.code == 200) {
          this.$message.success(res.message);
          this.loading = false;
        } else {
          this.$message.error(res.message);
          this.loading = true;
        }
      }).finally(() => {
        this.loading = false;
      });
    },
    onChannelChange(val) {
      this.rule.channel = val;
    },
    showModal() {
      this.timeMode = 'absolute';
      this.absoluteDuration = 3600;
      this.visible = true;
      this.rule = {
        name: "",
        zid: [],
        m_type: "3",
        conditions: [
          { r_type: "", r_func: "", r_value: "", }
        ],
        s_week: ['0', '1', '2', '3', '4', '5', '6'],
        s_time: moment(),
        e_time: moment().add(1, 'hour'),
        channel: [],
        note: "",
        duration: "1h",
        status: "0",
      };
    },
    seeEdit(record) {
      this.visibleEdit = true;
      const rawZids = record && (record.z_ids != null ? record.z_ids : record.zid)
      const zidText = rawZids != null ? String(rawZids) : ""
      const channelText = record && record.channel != null ? String(record.channel) : ""
      const lten = zidText ? zidText.split(",").filter(Boolean) : []
      const lchan = channelText ? channelText.split(",").filter(Boolean) : []

      let parsedConditions = []
      if (Array.isArray(record.conditions)) {
        parsedConditions = record.conditions
      } else if (record.conditions) {
        try {
          parsedConditions = JSON.parse(record.conditions)
        } catch (e) {
          parsedConditions = []
        }
      }

      this.rule = {
        id: record.id,
        time_mode: record.time_mode,
        created: record.created,
        expires_at: record.expires_at,
        server_now: record.server_now,
        name: record.name,
        zid: lten,
        channel: lchan,
        conditions: parsedConditions,
        s_week: record.s_week ? String(record.s_week).split(",") : [],
        s_time: this.formatRuleTime(record.s_time) === '-' ? null : moment(record.s_time, "HH:mm", true),
        e_time: this.formatRuleTime(record.e_time) === '-' ? null : moment(record.e_time, "HH:mm", true),
        note: record.note,
        m_type: "3",
        status: record.status == null ? "" : String(record.status)
      }
    },
    changeDuration(value) {
      if (typeof value !== 'string' || !this.tOptions.some(option => option.value === value)) return
      this.duration = value;
      if (value === '86400') {
        if (!this.rule.id) this.timeMode = 'permanent'
        this.rule.s_time = moment('00:00', 'HH:mm', true)
        this.rule.e_time = moment('23:59', 'HH:mm', true)
        return
      }
      this.rule.s_time = moment()
      this.rule.e_time = moment().add(Number(value), 'hour')
    },
    changeStime(value) {
      this.rule.s_time = value
    },
    changeEtime(value) {
      this.rule.e_time = value
    },
    buildRulePayload() {
      if (!this.rule.id && !['absolute', 'permanent', 'weekly'].includes(this.timeMode)) {
        this.$message.error(this.$t('mutes_expiry_invalid'))
        return null
      }
      const payload = {
        ...this.rule,
        z_ids: Array.isArray(this.rule.zid) ? this.rule.zid.join(",") : String(this.rule.zid || ""),
        conditions: JSON.stringify(this.rule.conditions || []),
        s_week: Array.isArray(this.rule.s_week) ? this.rule.s_week.join(",") : String(this.rule.s_week || ""),
        s_time: this.rule.s_time ? moment(this.rule.s_time).format("HH:mm") : "",
        e_time: this.rule.e_time ? moment(this.rule.e_time).format("HH:mm") : "",
        channel: Array.isArray(this.rule.channel) ? this.rule.channel.join(",") : String(this.rule.channel || ""),
        user_ids: "",
        group_ids: "",
        status: String(this.rule.status == null ? "0" : this.rule.status),
        m_type: "3",
      }
      // Read-only temporal output must never be echoed by normal edit/create requests.
      for (const key of ['time_mode', 'duration_seconds', 'created', 'expires_at', 'server_now', 'duration']) delete payload[key]
      if (!this.rule.id && this.timeMode === 'absolute') {
        if (!Number.isInteger(this.absoluteDuration) || !this.absoluteDurationOptions.some(option => option.value === this.absoluteDuration)) {
          this.$message.error(this.$t('mutes_invalid_duration'))
          return null
        }
        payload.time_mode = 'absolute'
        payload.duration_seconds = this.absoluteDuration
        payload.s_week = ''
        payload.s_time = ''
        payload.e_time = ''
      }
      return payload
    },
    updateRule() {
      const payload = this.buildRulePayload()
      if (!payload) return
      rulePut(this.rule.id, payload).then((resp) => {
        let res = resp.data
        if (res.code == 200) {
          this.$message.success(res.message)
          this.init()
        } else {
          this.$message.error(res.message)
        }
      })
      this.visibleEdit = false
    },
    handleEditCancel() {
      this.visibleEdit = false;
    },
    handleCancel() {
      this.visible = false;
    },
    createRule() {
      const payload = this.buildRulePayload()
      if (!payload) return
      ruleAdd(payload).then((resp) => {
        let res = resp.data
        if (res.code == 200) {
          this.$message.success(res.message)
          this.loading = false;
          this.confirmLoading = false;
          this.visible = false;
          this.init()
        } else {
          this.visible = true;
          this.confirmLoading = false;
          this.$message.error(res.message);
        }
      })
    },
    handleTenantChange(value) {
      this.tenantid = value
    },
    handleStatusChange(value) {
      this.status = value
    },
    handleLevelChange(value) {
      this.level = value
    },
    deleteRecord(record) {
      this.loading = true
      ruleDelete(record.id).then((resp) => {
        let res = resp.data
        if (res.code == 200) {
          this.loading = false
          this.$message.success(res.message)
          this.init()
        } else {
          this.loading = false
          this.$message.error(res.message)
        }
      })
    },
    changePage(e) {
      // 切换页码
      this.page = e.current;
      this.pageSize = e.pageSize;
      this.init();
    },
    // changeCreationTime(e) {
    //   if (e.length) {
    //     this.beginTime = parseTimeFun(new Date(e[0]));
    //     this.endTime = parseTimeFun(new Date(e[1]));
    //   } else {
    //     this.beginTime = "";
    //     this.endTime = "";
    //   }
    // },
    resetData() {
      this.hosts = "";
      this.tenantid = "";
      this.status = "";
      this.level = "";
      this.init();
    },
  },
  filters: {
    parsetime(v) {
      return parseTimeFun(v);
    },
    levelFilter(v) {
      let res = "未分类";
      switch (v) {
        case "0":
          res = "未分类";
          break;
        case "1":
          res = "信息";
          break;
        case "2":
          res = "警告";
          break;
        case "3":
          res = "一般";
          break;
        case "4":
          res = "严重";
          break;
        case "5":
          res = "灾难";
          break;
      }
      return res;
    },
    statusFilter(v) {
      let res = "未分类";
      switch (v) {
        case "0":
          res = "恢复";
          break;
        case "1":
          res = "告警";
          break;
      }
      return res;
    },
  },
};
</script>

<style lang="less" scoped>
.mute-time-hint { color: #607080; margin: 8px 0; }
.card-avatar {
  width: 48px;
  height: 48px;
  border-radius: 48px;
}
.new-btn {
  border-radius: 2px;
  width: 100%;
  height: 187px;
}
.meta-content {
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  height: 64px;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.form {
  .form-row {
    margin: 0 -8px;
  }
  .ant-col-md-12,
  .ant-col-sm-24,
  .ant-col-lg-6,
  .ant-col-lg-8,
  .ant-col-lg-10,
  .ant-col-xl-8,
  .ant-col-xl-6 {
    padding: 0 8px;
  }
}
</style>
