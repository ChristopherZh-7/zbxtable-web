<template>
  <page-layout :noTitle="true" content-title="参数配置" content-description="维护系统信息、通知渠道和后台任务设置。">
    <div class="config-container">
      <a-card :bordered="false">
        <a-tabs v-model="activeTab" :animated="false">
          <!-- 系统配置 -->
          <a-tab-pane key="system" :tab="$t('systemTab')">
            <a-form-model ref="systemForm" :model="systemForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 14 }">
              <!-- 外观配置部分 -->
              <a-divider orientation="left">{{$t('appearanceConfig')}}</a-divider>

              <a-form-model-item :label="$t('systemName')">
                <a-input v-model="systemForm.system_name" :placeholder="$t('systemNamePlaceholder')" />
                <div class="config-hint">{{$t('systemNameHint')}}</div>
              </a-form-model-item>

              <a-form-model-item :label="$t('systemSubtitle')">
                <a-input v-model="systemForm.system_subtitle" :placeholder="$t('systemSubtitlePlaceholder')" />
                <div class="config-hint">{{$t('systemSubtitleHint')}}</div>
              </a-form-model-item>

              <!-- 系统配置部分 -->
              <a-divider orientation="left">{{$t('systemSettings')}}</a-divider>

              <a-form-model-item v-for="item in systemOnlyConfigs" :key="item.id" :label="item.name">
                <a-select v-if="isBooleanConfig(item.config_key)" v-model="systemForm[item.config_key]" :placeholder="item.comment" style="width: 100%">
                  <a-select-option v-for="opt in getBooleanOptions(item.config_key)" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </a-select-option>
                </a-select>
                <a-input-group v-else-if="item.config_key === 'webhook_url'" compact style="display: flex;">
                  <a-input v-model="systemForm[item.config_key]" :placeholder="item.comment" style="flex: 1;" />
                  <a-button type="primary" @click="getCurrentWebUrl" :loading="gettingUrl">
                    <a-icon type="link" /> {{gettingUrl ? $t('gettingUrl') : $t('getCurrentUrl')}}
                  </a-button>
                </a-input-group>
                <a-input v-else v-model="systemForm[item.config_key]" :placeholder="item.comment" />
                <div class="config-hint">{{ item.comment }}</div>
              </a-form-model-item>

              <a-form-model-item :wrapper-col="{ span: 14, offset: 6 }">
                <a-button type="primary" @click="saveCategory('system')" :loading="saveLoading">{{$t('save')}}</a-button>
              </a-form-model-item>
            </a-form-model>
          </a-tab-pane>

          <!-- 计划任务配置 -->
          <a-tab-pane key="task" :tab="$t('taskTab')">
            <a-form-model ref="taskForm" :model="taskForm" :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }">
              <a-divider orientation="left">{{$t('taskSettings')}}</a-divider>

              <div class="task-config-grid">
                <a-row :gutter="24">
                  <a-col :xs="24" :xl="12" v-for="(column, columnIndex) in taskConfigColumns" :key="`task-column-${columnIndex}`">
                    <div
                      v-for="(group, groupIndex) in column"
                      :key="`task-group-${columnIndex}-${groupIndex}`"
                      class="task-config-card"
                    >
                      <div class="task-config-card__header">
                        <div class="task-config-card__title">{{ group.title }}</div>
                      </div>
                      <a-row :gutter="16">
                        <a-col :xs="24" :md="12" v-for="item in group.items" :key="item.id">
                          <a-form-model-item :label="getTaskFieldLabel(item.config_key)">
                            <a-select v-if="isBooleanConfig(item.config_key)" v-model="taskForm[item.config_key]" :placeholder="item.comment" style="width: 100%">
                              <a-select-option v-for="opt in getBooleanOptions(item.config_key)" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                              </a-select-option>
                            </a-select>
                            <a-input
                              v-else
                              v-model="taskForm[item.config_key]"
                              :placeholder="`${item.comment}（${$t('taskCronFormatShort')}）`"
                            />
                          </a-form-model-item>
                        </a-col>
                      </a-row>
                    </div>
                  </a-col>
                </a-row>
              </div>

              <a-form-model-item :wrapper-col="{ span: 14, offset: 6 }">
                <a-button type="primary" @click="saveCategory('task')" :loading="saveLoading">{{$t('save')}}</a-button>
              </a-form-model-item>
            </a-form-model>
          </a-tab-pane>

          <!-- 邮件配置 -->
          <a-tab-pane key="email" :tab="$t('emailTab')">
            <a-form-model ref="emailForm" :model="emailForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 14 }">
              <a-form-model-item v-for="item in emailConfigs" :key="item.id" :label="item.name">
                <a-select v-if="isBooleanConfig(item.config_key)" v-model="emailForm[item.config_key]" :placeholder="item.comment" style="width: 100%">
                  <a-select-option v-for="opt in getBooleanOptions(item.config_key)" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </a-select-option>
                </a-select>
                <a-input-group v-else-if="isSecretConfigKey(item.config_key)" compact class="secret-input-group">
                  <a-input-password
                    v-model="emailForm[item.config_key]"
                    :placeholder="secretPlaceholder(item.config_key)"
                    @input="onSecretInput(item.config_key)" />
                  <a-button
                    v-if="secretConfigured[item.config_key] && !secretClearPending[item.config_key]"
                    type="danger"
                    ghost
                    @click="confirmClearSecret(item.config_key)">{{$t('clearSecret')}}</a-button>
                  <a-button
                    v-else-if="secretClearPending[item.config_key]"
                    @click="undoClearSecret(item.config_key)">{{$t('undoClear')}}</a-button>
                </a-input-group>
                <a-input v-else v-model="emailForm[item.config_key]" :placeholder="item.comment" />
                <div class="config-hint">
                  {{ isSecretConfigKey(item.config_key) ? secretStatus(item.config_key) : item.comment }}
                </div>
              </a-form-model-item>
              <a-form-model-item :wrapper-col="{ span: 14, offset: 6 }">
                <a-space>
                  <a-button type="primary" @click="saveCategory('email')" :loading="saveLoading">{{$t('save')}}</a-button>
                  <a-button @click="showTestEmailModal">
                    <a-icon type="mail" /> {{$t('testEmail')}}
                  </a-button>
                </a-space>
              </a-form-model-item>
            </a-form-model>
          </a-tab-pane>

          <!-- 企业微信配置 -->
          <a-tab-pane key="wechat" :tab="$t('wechatTab')">
            <a-form-model ref="wechatForm" :model="wechatForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 14 }">
              <a-form-model-item v-for="item in wechatConfigs" :key="item.id" :label="item.name">
                <a-select v-if="isBooleanConfig(item.config_key)" v-model="wechatForm[item.config_key]" :placeholder="item.comment" style="width: 100%">
                  <a-select-option v-for="opt in getBooleanOptions(item.config_key)" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </a-select-option>
                </a-select>
                <a-input-group v-else-if="isSecretConfigKey(item.config_key)" compact class="secret-input-group">
                  <a-input-password
                    v-model="wechatForm[item.config_key]"
                    :placeholder="secretPlaceholder(item.config_key)"
                    @input="onSecretInput(item.config_key)" />
                  <a-button
                    v-if="secretConfigured[item.config_key] && !secretClearPending[item.config_key]"
                    type="danger"
                    ghost
                    @click="confirmClearSecret(item.config_key)">{{$t('clearSecret')}}</a-button>
                  <a-button
                    v-else-if="secretClearPending[item.config_key]"
                    @click="undoClearSecret(item.config_key)">{{$t('undoClear')}}</a-button>
                </a-input-group>
                <a-input v-else v-model="wechatForm[item.config_key]" :placeholder="item.comment" />
                <div class="config-hint">
                  {{ isSecretConfigKey(item.config_key) ? secretStatus(item.config_key) : item.comment }}
                </div>
              </a-form-model-item>
              <a-form-model-item :wrapper-col="{ span: 14, offset: 6 }">
                <a-space>
                  <a-button type="primary" @click="saveCategory('wechat')" :loading="saveLoading">{{$t('save')}}</a-button>
                  <a-button @click="showTestWechatModal">
                    <a-icon type="wechat" /> {{$t('testWechat')}}
                  </a-button>
                </a-space>
              </a-form-model-item>
            </a-form-model>
          </a-tab-pane>

          <!-- 钉钉机器人配置 -->
          <a-tab-pane key="dingtalk" :tab="$t('dingtalkTab')">
            <a-form-model ref="dingtalkForm" :model="dingtalkForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 14 }">
              <a-form-model-item v-for="item in dingtalkConfigs" :key="item.id" :label="item.name">
                <a-select v-if="isBooleanConfig(item.config_key)" v-model="dingtalkForm[item.config_key]" :placeholder="item.comment" style="width: 100%">
                  <a-select-option v-for="opt in getBooleanOptions(item.config_key)" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </a-select-option>
                </a-select>
                <a-input-group v-else-if="isSecretConfigKey(item.config_key)" compact class="secret-input-group">
                  <a-input-password
                    v-model="dingtalkForm[item.config_key]"
                    :placeholder="secretPlaceholder(item.config_key)"
                    @input="onSecretInput(item.config_key)" />
                  <a-button
                    v-if="secretConfigured[item.config_key] && !secretClearPending[item.config_key]"
                    type="danger"
                    ghost
                    @click="confirmClearSecret(item.config_key)">{{$t('clearSecret')}}</a-button>
                  <a-button
                    v-else-if="secretClearPending[item.config_key]"
                    @click="undoClearSecret(item.config_key)">{{$t('undoClear')}}</a-button>
                </a-input-group>
                <div class="config-hint">
                  {{ isSecretConfigKey(item.config_key) ? secretStatus(item.config_key) : item.comment }}
                </div>
              </a-form-model-item>
              <a-form-model-item :wrapper-col="{ span: 14, offset: 6 }">
                <a-space>
                  <a-button type="primary" @click="saveCategory('dingtalk')" :loading="saveLoading">{{$t('save')}}</a-button>
                  <a-button @click="handleTestDingTalk" :loading="testingDingTalk">
                    <a-icon type="notification" /> {{$t('testDingTalk')}}
                  </a-button>
                </a-space>
                <div class="config-hint">{{$t('testDingTalkHint')}}</div>
              </a-form-model-item>
            </a-form-model>
          </a-tab-pane>

          <!-- AI 配置 -->
          <a-tab-pane key="ai" :tab="$t('aiTab')">
            <a-form-model ref="aiForm" :model="aiForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 14 }">
              <!-- AI 类型选择 -->
              <a-form-model-item :label="getConfigName('ai_type')">
                <a-select v-model="aiForm.ai_type" :placeholder="getConfigComment('ai_type')" style="width: 100%" @change="onAiTypeChange">
                  <a-select-option value="ollama">Ollama</a-select-option>
                  <a-select-option value="deepseek">Deepseek</a-select-option>
                  <a-select-option value="custom">自定义兼容接口</a-select-option>
                </a-select>
                <div class="config-hint">{{ getConfigComment('ai_type') }}</div>
              </a-form-model-item>

              <!-- Ollama 配置项 -->
              <template v-if="aiForm.ai_type === 'ollama'">
                <a-form-model-item v-for="item in ollamaConfigs" :key="item.id" :label="item.name">
                  <a-input v-model="aiForm[item.config_key]" :placeholder="item.comment" />
                  <div class="config-hint">{{ item.comment }}</div>
                </a-form-model-item>
              </template>

              <!-- Deepseek 配置项 -->
              <template v-if="aiForm.ai_type === 'deepseek'">
                <a-form-model-item v-for="item in deepseekConfigs" :key="item.id" :label="item.name">
                  <a-input-password v-if="item.config_key === 'deepseek_api_key'" v-model="aiForm[item.config_key]" :placeholder="item.comment" />
                  <a-input v-else v-model="aiForm[item.config_key]" :placeholder="item.comment" />
                  <div class="config-hint">{{ item.comment }}</div>
                </a-form-model-item>
              </template>

              <!-- Custom(OpenAI-compatible) 配置项 -->
              <template v-if="aiForm.ai_type === 'custom'">
                <a-form-model-item v-for="item in customConfigs" :key="item.id" :label="item.name">
                  <a-input-password v-if="item.config_key === 'custom_api_key'" v-model="aiForm[item.config_key]" :placeholder="item.comment" />
                  <a-input v-else v-model="aiForm[item.config_key]" :placeholder="item.comment" />
                  <div class="config-hint">{{ item.comment }}</div>
                </a-form-model-item>
              </template>

              <!-- 告警分析提示词（独立显示，不随 AI 类型切换隐藏） -->
              <a-form-model-item :label="getConfigName('alarm_analysis_prompt')">
                <a-textarea
                  v-model="aiForm.alarm_analysis_prompt"
                  :placeholder="getConfigComment('alarm_analysis_prompt')"
                  :auto-size="{ minRows: 4, maxRows: 10 }" />
                <div class="config-hint">{{ getConfigComment('alarm_analysis_prompt') }}</div>
              </a-form-model-item>

              <a-form-model-item :wrapper-col="{ span: 14, offset: 6 }">
                <a-button type="primary" @click="saveCategory('ai')" :loading="saveLoading">{{$t('save')}}</a-button>
              </a-form-model-item>
            </a-form-model>
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </div>

    <!-- 测试邮件对话框 -->
    <a-modal wrap-class-name="smartops-management-dialog"
      :title="$t('testEmailTitle')"
      :visible="testEmailVisible"
      :confirm-loading="testingEmail"
      @ok="handleTestEmail"
      @cancel="testEmailVisible = false">
      <div>
        <a-input v-model="testEmailAddress" :placeholder="$t('testEmailPlaceholder')" size="large" />
        <div class="config-hint" style="margin-top: 8px;">
          <a-icon type="info-circle" /> {{$t('testEmailHint')}}
        </div>
      </div>
    </a-modal>

    <!-- 测试企业微信对话框 -->
    <a-modal wrap-class-name="smartops-management-dialog"
      :title="$t('testWechatTitle')"
      :visible="testWechatVisible"
      :confirm-loading="testingWechat"
      @ok="handleTestWechat"
      @cancel="testWechatVisible = false">
      <div>
        <a-input v-model="testWechatUserId" :placeholder="$t('testWechatPlaceholder')" size="large" />
        <div class="config-hint" style="margin-top: 8px;">
          <a-icon type="info-circle" /> {{$t('testWechatHint')}}
        </div>
      </div>
    </a-modal>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import axios from 'axios'
import { parseTimeFun } from '@/utils/formatter'
import { configGetList, configUpdate, configUpdateGroup } from '@/services/admin'
import {
  buildAtomicGroupRequest,
  isAtomicCategory,
  isSecretConfigKey,
  normalizeSecretValue
} from './system-management-policy'

const DEPRECATED_INVENTORY_TASK_KEYS = new Set([
  'sync_inventory',
  'sync_inventory_cron',
  'auto_metric_mapping_enabled',
  'auto_metric_mapping_cron',
  'retry_failed_mapping_enabled',
  'retry_failed_mapping_cron',
  'binding_auto_init_enabled',
  'binding_auto_init_cron',
  'binding_retry_enabled',
  'binding_retry_cron',
])

export default {
  name: 'edit',
  i18n: require('./config-i18n'),
  components: { PageLayout },
  data() {
    return {
      loading: false,
      list: [],
      activeTab: 'system',
      systemForm: {},
      taskForm: {},
      emailForm: {},
      wechatForm: {},
      dingtalkForm: {},
      secretConfigured: {},
      secretClearPending: {},
      aiForm: {},
      securityForm: {},
      saveLoading: false,
      isKeyVisible: false,  // 控制密钥是否可见
      gettingUrl: false,  // 控制获取地址按钮的加载状态
      testEmailVisible: false,  // 测试邮件对话框
      testEmailAddress: '',  // 测试邮箱地址
      testingEmail: false,  // 测试邮件加载状态
      testWechatVisible: false,  // 测试企业微信对话框
      testWechatUserId: '',  // 测试企业微信用户ID
      testingWechat: false,  // 测试企业微信加载状态
      testingDingTalk: false
    }
  },
  computed: {
    systemOnlyConfigs() {
      return this.list.filter(item => 
        item.config_key === 'dash_top_lin_num' ||
        item.config_key === 'dash_top_win_num' ||
        item.config_key === 'webhook_url'
      )
    },
    allSystemConfigs() {
      return this.list.filter(item => 
        item.config_key === 'system_name' || 
        item.config_key === 'system_subtitle' ||
        item.config_key === 'system_logo' ||
        item.config_key === 'dash_top_lin_num' ||
        item.config_key === 'dash_top_win_num' ||
        item.config_key === 'webhook_url'
      )
    },
    taskConfigs() {
      return this.list.filter(item =>
        this.isTaskConfig(item.config_key) && !DEPRECATED_INVENTORY_TASK_KEYS.has(item.config_key)
      )
    },
    taskConfigColumns() {
      const groups = this.taskConfigGroups

      const columns = [[], []]
      groups.forEach((group, index) => {
        columns[index % 2].push(group)
      })
      return columns
    },
    taskConfigGroups() {
      const groupMap = new Map()

      this.taskConfigs.forEach(item => {
        const groupKey = this.getTaskGroupKey(item.config_key)
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            key: groupKey,
            title: this.getTaskGroupTitle(item),
            items: []
          })
        }
        groupMap.get(groupKey).items.push(item)
      })

      return Array.from(groupMap.values()).map(group => {
        group.items.sort((a, b) => {
          const orderA = a.config_key.endsWith('_enabled') || a.config_key === 'sync_inventory' ? 0 : 1
          const orderB = b.config_key.endsWith('_enabled') || b.config_key === 'sync_inventory' ? 0 : 1
          return orderA - orderB
        })
        return group
      })
    },
    emailConfigs() {
      return this.list.filter(item => 
        item.config_key && item.config_key.startsWith('email_')
      )
    },
    wechatConfigs() {
      return this.list.filter(item => 
        item.config_key && item.config_key.startsWith('wechat_')
      )
    },
    dingtalkConfigs() {
      return this.list.filter(item =>
        item.config_key && item.config_key.startsWith('dingtalk_')
      )
    },
    aiConfigs() {
      return this.list.filter(item => 
        item.config_key && (
          item.config_key.startsWith('ollama_') ||
          item.config_key.startsWith('deepseek_') ||
          item.config_key.startsWith('custom_') ||
          item.config_key === 'ai_type' ||
          item.config_key === 'alarm_analysis_prompt'
        )
      )
    },
    ollamaConfigs() {
      return this.list.filter(item => 
        item.config_key && item.config_key.startsWith('ollama_')
      )
    },
    deepseekConfigs() {
      return this.list.filter(item => 
        item.config_key && item.config_key.startsWith('deepseek_')
      )
    },
    customConfigs() {
      return this.list.filter(item =>
        item.config_key && item.config_key.startsWith('custom_')
      )
    },
    securityConfigs() {
      return this.list.filter(item => 
        item.config_key === 'encryption_key'
      )
    }
  },
  filters: {
    parsetime(v) {
      return parseTimeFun(v)
    }
  },
  created() {
    this.init()
  },
  watch: {
    // 监听语言变化，重新翻译配置项
    '$i18n.locale'() {
      this.translateConfigItems()
    },
    // 监听配置列表变化，进行翻译
    list: {
      handler() {
        this.translateConfigItems()
      },
      deep: true
    }
  },
  methods: {
    // 翻译配置项的 name 和 comment
    translateConfigItems() {
      const locale = this.$i18n.locale || 'CN'
      const translations = this.$options.i18n.configItemTranslations[locale]
      
      if (!translations) return
      
      this.list.forEach(item => {
        if (item.config_key && translations[item.config_key]) {
          item.name = translations[item.config_key].name
          item.comment = translations[item.config_key].comment
        }
      })
    },
    isBooleanConfig(key) {
      // 判断是否为布尔类型的配置项（开启/关闭）
      const booleanKeys = ['zbx_dash', 'sync_inventory', 'wechat_enabled', 'email_isSSl']
      return booleanKeys.includes(key) || key.endsWith('_enabled')
    },
    isTaskConfig(key) {
      if (!key) {
        return false
      }
      if (key === 'wechat_enabled') {
        return false
      }
      return key === 'sync_inventory' || key.endsWith('_enabled') || key.endsWith('_cron')
    },
    getTaskGroupKey(key) {
      if (key === 'sync_inventory' || key === 'sync_inventory_cron') {
        return 'sync_inventory'
      }
      return key.replace(/_(enabled|cron)$/, '')
    },
    getTaskGroupTitle(item) {
      return item.name.replace(/\s*(开关|Cron|Switch)$/u, '').trim()
    },
    getTaskFieldLabel(key) {
      if (key === 'sync_inventory' || key.endsWith('_enabled')) {
        return this.$t('taskEnabledLabel')
      }
      return this.$t('taskCronLabel')
    },
    getBooleanOptions(key) {
      // email_isSSl 使用 true/false，其他使用 1/0
      const enabledText = this.$t('enabled')
      const disabledText = this.$t('disabled')
      
      if (key === 'email_isSSl') {
        return [
          { label: enabledText, value: 'true' },
          { label: disabledText, value: 'false' }
        ]
      }
      return [
        { label: enabledText, value: '1' },
        { label: disabledText, value: '0' }
      ]
    },
    init() {
      this.loading = true
      return configGetList()
        .then((resp) => {
          let res = resp.data
          if (res.code == 200) {
            this.list = res.data.items || []
            // 获取数据后立即翻译
            this.translateConfigItems()
            this.initForms()
          }
        })
        .finally(() => {
          this.loading = false
        })
    },
    initForms() {
      // 初始化各个表单的数据
      this.systemForm = {}
      this.taskForm = {}
      this.emailForm = {}
      this.wechatForm = {}
      this.dingtalkForm = {}
      this.aiForm = {}
      this.securityForm = {}
      this.secretConfigured = {}
      this.secretClearPending = {}
      this.allSystemConfigs.forEach(item => {
        this.$set(this.systemForm, item.config_key, item.config_value)
      })
      this.taskConfigs.forEach(item => {
        this.$set(this.taskForm, item.config_key, item.config_value)
      })
      this.emailConfigs.forEach(item => {
        const normalized = normalizeSecretValue(item.config_key, item.config_value)
        this.$set(this.emailForm, item.config_key, normalized.value)
        if (isSecretConfigKey(item.config_key)) {
          this.$set(this.secretConfigured, item.config_key, normalized.configured)
          this.$set(this.secretClearPending, item.config_key, false)
        }
      })
      this.wechatConfigs.forEach(item => {
        const normalized = normalizeSecretValue(item.config_key, item.config_value)
        this.$set(this.wechatForm, item.config_key, normalized.value)
        if (isSecretConfigKey(item.config_key)) {
          this.$set(this.secretConfigured, item.config_key, normalized.configured)
          this.$set(this.secretClearPending, item.config_key, false)
        }
      })
      this.dingtalkConfigs.forEach(item => {
        const normalized = normalizeSecretValue(item.config_key, item.config_value)
        this.$set(this.dingtalkForm, item.config_key, normalized.value)
        if (isSecretConfigKey(item.config_key)) {
          this.$set(this.secretConfigured, item.config_key, normalized.configured)
          this.$set(this.secretClearPending, item.config_key, false)
        }
      })
      this.aiConfigs.forEach(item => {
        this.$set(this.aiForm, item.config_key, item.config_value)
      })
      // 如果没有设置 ai_type，默认为 ollama
      if (!this.aiForm.ai_type) {
        this.$set(this.aiForm, 'ai_type', 'ollama')
      }
      // 告警分析提示词默认值（当配置为空时自动填充，支持 i18n）
      if (!this.aiForm.alarm_analysis_prompt) {
        this.$set(this.aiForm, 'alarm_analysis_prompt', this.$t('defaultAlarmAnalysisPrompt'))
      }
      this.securityConfigs.forEach(item => {
        this.$set(this.securityForm, item.config_key, item.config_value)
      })
    },
    async saveCategory(category) {
      this.saveLoading = true
      try {
        let configs = []
        let form = {}
        
        switch(category) {
          case 'system':
            configs = this.allSystemConfigs
            form = this.systemForm
            break
          case 'email':
            configs = this.emailConfigs
            form = this.emailForm
            break
          case 'task':
            configs = this.taskConfigs
            form = this.taskForm
            break
          case 'wechat':
            configs = this.wechatConfigs
            form = this.wechatForm
            break
          case 'dingtalk':
            configs = this.dingtalkConfigs
            form = this.dingtalkForm
            break
          case 'ai':
            configs = this.aiConfigs
            form = this.aiForm
            break
        }
        
        if (isAtomicCategory(category)) {
          const request = buildAtomicGroupRequest(category, configs, form, this.secretClearPending)
          const response = await configUpdateGroup(category, request)
          this.ensureSuccessfulResponse(response)
        } else {
          // F05 不扩展计划任务和 AI，保留现有单项保存契约。
          const responses = await Promise.all(configs.map(item =>
            configUpdate(item.id, { config_value: form[item.config_key] || '' })
          ))
          responses.forEach(this.ensureSuccessfulResponse)
        }
        this.$message.success(this.$t('saveSuccess'))
        
        // 如果是系统配置，更新 Vuex 中的系统名称和Logo
        if (category === 'system') {
          this.$store.commit('setting/setSystemName', form.system_name || '智能运维管理系统')
          this.$store.commit('setting/setSystemSubtitle', form.system_subtitle || this.$t('systemSubtitleDefault'))
          this.$store.commit('setting/setSystemLogo', form.system_logo || '/logo.png')
        }
        
        await this.init()
      } catch (error) {
        this.$message.error(error.message || this.$t('saveFailed'))
      } finally {
        this.saveLoading = false
      }
    },
    ensureSuccessfulResponse(response) {
      const payload = response && response.data
      if (!payload || payload.code !== 200) {
        throw new Error((payload && payload.message) || this.$t('saveFailed'))
      }
      return payload
    },
    isSecretConfigKey,
    secretPlaceholder(key) {
      if (this.secretClearPending[key]) return this.$t('secretWillClear')
      if (this.secretConfigured[key]) return this.$t('secretKeepPlaceholder')
      return this.$t('secretNewPlaceholder')
    },
    secretStatus(key) {
      if (this.secretClearPending[key]) return this.$t('secretWillClear')
      if (this.secretConfigured[key]) return this.$t('secretConfigured')
      return this.$t('secretNotConfigured')
    },
    onSecretInput(key) {
      const form = this.secretFormForKey(key)
      if (form[key]) this.$set(this.secretClearPending, key, false)
    },
    secretFormForKey(key) {
      if (key.startsWith('email_')) return this.emailForm
      if (key.startsWith('wechat_')) return this.wechatForm
      if (key.startsWith('dingtalk_')) return this.dingtalkForm
      return {}
    },
    confirmClearSecret(key) {
      this.$confirm({
        title: this.$t('clearSecretTitle'),
        content: this.$t('clearSecretContent'),
        okText: this.$t('clearSecret'),
        okType: 'danger',
        cancelText: this.$t('cancel'),
        onOk: () => {
          const form = this.secretFormForKey(key)
          this.$set(form, key, '')
          this.$set(this.secretClearPending, key, true)
        }
      })
    },
    undoClearSecret(key) {
      this.$set(this.secretClearPending, key, false)
    },
    // 获取显示的值（加密密钥部分隐藏）
    getDisplayValue(key) {
      if (key === 'encryption_key') {
        const value = this.securityForm[key] || ''
        if (!value) return ''
        
        // 如果密钥可见，显示完整内容
        if (this.isKeyVisible) {
          return value
        }
        
        // 否则只显示前8个和后8个字符，中间用星号代替
        if (value.length <= 16) {
          // 如果密钥太短，显示前后各4个字符
          const showChars = Math.floor(value.length / 4)
          return value.substring(0, showChars) + '***' + value.substring(value.length - showChars)
        }
        
        return value.substring(0, 8) + '************************' + value.substring(value.length - 8)
      }
      return this.securityForm[key] || ''
    },
    // 切换密钥可见性
    toggleKeyVisibility() {
      this.isKeyVisible = !this.isKeyVisible
    },
    // 复制加密密钥
    copyEncryptionKey() {
      const key = this.securityForm['encryption_key']
      if (!key) {
        this.$message.warning(this.$t('keyEmpty'))
        return
      }
      
      const textarea = document.createElement('textarea')
      textarea.value = key
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      
      try {
        document.execCommand('copy')
        this.$message.success(this.$t('keyCopied'))
      } catch (err) {
        this.$message.error(this.$t('copyFailed'))
      }
      
      document.body.removeChild(textarea)
    },
    // AI 类型切换
    onAiTypeChange(value) {
      // 当切换 AI 类型时，可以在这里做一些额外的处理
      console.log('AI type changed to:', value)
    },
    // 获取配置项的名称（用于动态获取翻译）
    getConfigName(key) {
      const item = this.list.find(item => item.config_key === key)
      return item ? item.name : key
    },
    // 获取配置项的注释（用于动态获取翻译）
    getConfigComment(key) {
      const item = this.list.find(item => item.config_key === key)
      return item ? item.comment : ''
    },
    // 获取当前 Web 访问地址
    getCurrentWebUrl() {
      this.gettingUrl = true
      try {
        // 获取当前浏览器的协议、主机名和端口
        const protocol = window.location.protocol // http: 或 https:
        const hostname = window.location.hostname // 域名或IP
        const port = window.location.port // 端口号
        
        // 构建完整的 URL
        let baseUrl = `${protocol}//${hostname}`
        
        // 如果端口不是默认端口（80或443），则添加端口号
        if (port && port !== '80' && port !== '443') {
          baseUrl += `:${port}`
        }
        
        // 设置到 webhook_url 字段
        this.systemForm.webhook_url = baseUrl
        
        this.$message.success(this.$t('urlGetSuccess'))
      } catch (error) {
        this.$message.error(this.$t('urlGetFailed') + ': ' + error.message)
      } finally {
        this.gettingUrl = false
      }
    },
    // 显示测试邮件对话框
    showTestEmailModal() {
      this.testEmailAddress = ''
      this.testEmailVisible = true
    },
    // 处理测试邮件
    async handleTestEmail() {
      if (!this.testEmailAddress) {
        this.$message.warning(this.$t('pleaseInputTestEmail'))
        return
      }
      
      // 简单的邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(this.testEmailAddress)) {
        this.$message.warning('请输入有效的邮箱地址')
        return
      }
      
      this.testingEmail = true
      try {
        const response = await axios.post('/v1/system/test-email', {
          test_email: this.testEmailAddress
        })
        
        if (response.data.code === 200) {
          this.$message.success(this.$t('testEmailSuccess'))
          this.testEmailVisible = false
        } else {
          this.$message.error(response.data.message || this.$t('testFailed'))
        }
      } catch (error) {
        this.$message.error(this.$t('testFailed') + ': ' + (error.response?.data?.message || error.message))
      } finally {
        this.testingEmail = false
      }
    },
    // 显示测试企业微信对话框
    showTestWechatModal() {
      this.testWechatUserId = ''
      this.testWechatVisible = true
    },
    // 处理测试企业微信
    async handleTestWechat() {
      if (!this.testWechatUserId) {
        this.$message.warning(this.$t('pleaseInputTestUserId'))
        return
      }
      
      this.testingWechat = true
      try {
        const response = await axios.post('/v1/system/test-wechat', {
          test_user_id: this.testWechatUserId
        })
        
        if (response.data.code === 200) {
          this.$message.success(this.$t('testWechatSuccess'))
          this.testWechatVisible = false
        } else {
          this.$message.error(response.data.message || this.$t('testFailed'))
        }
      } catch (error) {
        this.$message.error(this.$t('testFailed') + ': ' + (error.response?.data?.message || error.message))
      } finally {
        this.testingWechat = false
      }
    },
    async handleTestDingTalk() {
      this.testingDingTalk = true
      try {
        const response = await axios.post('/v1/system/test-dingtalk', {})
        if (response.data.code === 200) {
          this.$message.success(this.$t('testDingTalkSuccess'))
        } else {
          this.$message.error(response.data.message || this.$t('testFailed'))
        }
      } catch (error) {
        this.$message.error(this.$t('testFailed') + ': ' + (error.response?.data?.message || error.message))
      } finally {
        this.testingDingTalk = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
.config-container {
  padding: 24px;
  background: #f0f2f5;
  min-height: calc(100vh - 200px);
}

.config-hint {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.5;
}

.secret-input-group {
  display: flex;
}

.secret-input-group /deep/ .ant-input-password {
  flex: 1;
}

/deep/ .ant-card {
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

/deep/ .ant-tabs-card > .ant-tabs-content {
  margin-top: -16px;
}

/deep/ .ant-tabs-card > .ant-tabs-content > .ant-tabs-tabpane {
  background: #fff;
  padding: 24px;
}

/deep/ .ant-tabs-card > .ant-tabs-bar {
  border-color: #fff;
  margin-bottom: 0;
}

/deep/ .ant-tabs-card > .ant-tabs-bar .ant-tabs-tab {
  border-color: transparent;
  background: transparent;
  margin-right: 4px;
}

/deep/ .ant-tabs-card > .ant-tabs-bar .ant-tabs-tab-active {
  border-color: #fff;
  background: #fff;
  font-weight: 600;
}

/deep/ .ant-form-item {
  margin-bottom: 20px;
}

/deep/ .ant-divider-horizontal.ant-divider-with-text-left {
  margin: 32px 0 24px 0;
  font-weight: 600;
  font-size: 14px;
}

/deep/ .ant-divider-horizontal.ant-divider-with-text-left:first-of-type {
  margin-top: 0;
}

/deep/ .ant-input,
/deep/ .ant-input-password {
  border-radius: 4px;
}

.task-config-grid {
  margin-bottom: 4px;
}

.task-config-card {
  padding: 16px 16px 0;
  margin-bottom: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}

.task-config-card__header {
  margin-bottom: 8px;
}

.task-config-card__title {
  color: #262626;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

/deep/ .task-config-card .ant-form-item-label > label {
  min-width: 44px;
  color: #595959;
  font-weight: 500;
}

/deep/ .task-config-card .ant-form-item {
  margin-bottom: 14px;
}

/deep/ .ant-input-group {
  display: flex;
  
  .ant-input {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  
  .ant-btn {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    white-space: nowrap;
  }
}

@media (max-width: 1199px) {
  .task-config-card {
    padding: 14px 14px 0;
  }
}
</style>
