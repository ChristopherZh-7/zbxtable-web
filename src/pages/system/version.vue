<template>
  <page-layout :noTitle="true" content-title="版本信息" content-description="查看软件版本、构建信息与升级说明。">
    <a-card :headStyle="$cardHeadStyle" size="small">
      <a-descriptions bordered>
        <a-descriptions-item :label="$t('smartops_version')" :span="3">{{ UIVersion }}</a-descriptions-item>
        <a-descriptions-item :label="$t('buildinfo')">
          软件版本:{{ BackVersion }}
          <br />
          代码版本:{{ GitHash }}
          <br />
          构建时间:{{ BuildTime }}
        </a-descriptions-item>
      </a-descriptions>

      <a-divider />
      <div class="update-policy">
        <h3>
          <a-icon type="safety-certificate" />
          {{$t('system_update')}}
        </h3>

        <a-alert
          v-if="updateChecked"
          :type="updateAlertType"
          :message="updateInfo.message || $t('deployment_managed')"
          show-icon>
          <template slot="description">
            <p>{{$t('current_version')}}：{{ updateInfo.current_version }}</p>
            <p>{{$t('latest_version')}}：{{ updateInfo.latest_version }}</p>
            <p class="update-policy__detail">
              {{$t('deployment_manager')}}：{{ updateInfo.managed_by || $t('deployment_managed') }}
            </p>
          </template>
        </a-alert>

        <a-alert
          v-else
          type="info"
          :message="$t('safe_update_hint')"
          show-icon />

        <a-button
          class="update-policy__button"
          type="primary"
          icon="reload"
          :loading="checkingUpdate"
          @click="handleCheckUpdate">
          {{checkingUpdate ? $t('checking_update') : $t('check_update')}}
        </a-button>
      </div>
    </a-card>
  </page-layout>
</template>

<script>
import PageLayout from '@/layouts/PageLayout'
import config from '../../../package.json'
import { baseVersion, systemCheckUpdate } from '@/services/admin'

export default {
  name: 'version',
  i18n: require('./i18n'),
  components: {
    PageLayout
  },
  data() {
    return {
      UIVersion: '',
      BackVersion: '',
      GitHash: '',
      BuildTime: '',
      updateInfo: {
        current_version: '',
        latest_version: '',
        has_update: false,
        check_available: false,
        managed_by: '',
        message: ''
      },
      updateChecked: false,
      checkingUpdate: false
    }
  },
  computed: {
    updateAlertType() {
      if (!this.updateInfo.check_available) return 'warning'
      return this.updateInfo.has_update ? 'info' : 'success'
    }
  },
  created() {
    this.UIVersion = process.env.VUE_APP_VERSION || config.version
    this.getversion()
  },
  methods: {
    getversion() {
      baseVersion().then((resp) => {
        const data = resp.data.data
        this.BackVersion = data.version || ''
        this.GitHash = data.gitHash || ''
        this.BuildTime = data.buildTime || ''
      })
    },
    handleCheckUpdate() {
      this.checkingUpdate = true
      systemCheckUpdate()
        .then((resp) => {
          const payload = resp && resp.data
          if (!payload || payload.code !== 200) {
            throw new Error((payload && payload.message) || this.$t('check_update_failed'))
          }
          const data = payload.data || {}
          this.updateInfo = {
            current_version: data.currentVersion || this.BackVersion,
            latest_version: data.latestVersion || this.BackVersion,
            has_update: Boolean(data.hasUpdate),
            check_available: Boolean(data.checkAvailable),
            managed_by: data.managedBy || '',
            message: data.message || ''
          }
          this.updateChecked = true
        })
        .catch((error) => {
          this.$message.error(this.$t('check_update_failed') + '：' + (error.message || ''))
        })
        .finally(() => {
          this.checkingUpdate = false
        })
    }
  }
}
</script>

<style lang="less" scoped>
.update-policy {
  margin-top: 24px;
}

.update-policy h3 .anticon {
  margin-right: 8px;
}

.update-policy__detail {
  margin-bottom: 0;
}

.update-policy__button {
  margin-top: 16px;
}
</style>
