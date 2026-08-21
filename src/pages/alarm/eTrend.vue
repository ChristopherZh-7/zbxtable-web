<template>
  <div>
    <div class="trend-info" v-if="!mock.length">
      <span>告警趋势暂无数据</span>
    </div>
    <div class="trend-main" v-else>
      <v-chart :forceFit="true" :height="360" :data="chartData" :scale="scale" :padding="[30, 60, 70, 80]">
        <v-tooltip />
        <v-axis dataKey="bucket" :label="axisLabel" />
        <v-axis dataKey="count" :label="{ formatter: value => `${value}次` }" />
        <v-line position="bucket*count" :color="$themeColor" :size="2" />
        <v-point position="bucket*count" :color="$themeColor" :size="3" />
      </v-chart>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AlarmTrend',
  props: {
    mock: {
      type: Array,
      default: () => []
    },
    bucket: {
      type: String,
      default: 'day'
    }
  },
  computed: {
    chartData() {
      return this.mock.map(item => ({ bucket: item.bucket, count: Number(item.count) || 0 }))
    },
    scale() {
      return [
        { dataKey: 'bucket', type: 'cat', range: [0, 1] },
        { dataKey: 'count', min: 0, minTickInterval: 1, alias: '告警次数' }
      ]
    },
    axisLabel() {
      return {
        autoRotate: this.bucket !== 'hour',
        formatter: value => this.bucket === 'hour' ? value.slice(5, 16) : value.slice(5)
      }
    }
  }
}
</script>

<style lang="less" scoped>
.trend-info {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 24px;
}
.trend-main {
  width: 100%;
  padding: 10px;
}
</style>
