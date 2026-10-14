<template>
  <custom-dashboard-designer v-if="customID" :key="customID" :screen-id="customID" presentation-only @exit="goBack" @unavailable="fallback" />
  <screen-dashboard v-else />
</template>

<script>
import CustomDashboardDesigner from '../dashboard/custom/designer'
import ScreenDashboard from './index'
import {screenID, defaultScreenKey, screenPreferenceStorage, readDefaultScreen, writeDefaultScreen} from '../dashboard/custom/screen-management'
import {SCREEN_PATH, screenSessionStorage, screenContextKey, screenReturnPath} from '@/utils/screen-navigation'

export default {
  name: 'ScreenEntry',
  components: {CustomDashboardDesigner, ScreenDashboard},
  computed: {
    customID() { return screenID(this.$route.query.custom) },
  },
  methods: {
    goBack() {
      this.$router.replace(screenReturnPath(screenSessionStorage(window), screenContextKey(this.$store), this.$router))
    },
    fallback(error) {
      const storage = screenPreferenceStorage(window), key = defaultScreenKey(this.$store)
      const unavailable = [403, 404].includes(Number(error && (error.code || (error.response && error.response.status))))
      if (unavailable && readDefaultScreen(storage, key) === this.customID) writeDefaultScreen(storage, key, null)
      this.$message.warning(unavailable ? '该大屏已删除或无权访问，已切换到内置运维大屏' : '大屏暂时无法加载，已切换到内置运维大屏')
      this.$router.replace({path: SCREEN_PATH})
    },
  },
}
</script>
