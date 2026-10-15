<template>
  <div class="page-layout" :class="{'smartops-management-page': contentTitle}">
    <page-header ref="pageHeader" :style="`margin-top: ${multiPage ? 0 : -24}px`" :noTitle="noTitle" :title="pageTitle" :logo="logo" :avatar="avatar">
      <slot name="action"  slot="action"></slot>
      <slot slot="content" name="headerContent"></slot>
      <div slot="content" v-if="!this.$slots.headerContent && desc">
        <p>{{desc}}</p>
        <div v-if="this.linkList" class="link">
          <template  v-for="(link, index) in linkList">
            <a :key="index" :href="link.href"><a-icon :type="link.icon" />{{link.title}}</a>
          </template>
        </div>
      </div>
      <slot v-if="this.$slots.extra" slot="extra" name="extra"></slot>
    </page-header>
    <div ref="page" :class="['page-content', layout, pageWidth, {'page-content--standalone': noTitle}]" >
      <header v-if="contentTitle" class="smartops-page-heading">
        <div>
          <h1>{{ contentTitle }}</h1>
          <p v-if="contentDescription">{{ contentDescription }}</p>
        </div>
        <div v-if="$slots.headingActions" class="smartops-heading-actions">
          <slot name="headingActions"></slot>
        </div>
      </header>
      <slot></slot>
    </div>
  </div>
</template>

<script>
import PageHeader from '@/components/page/header/PageHeader'
import {mapState, mapMutations} from 'vuex'
import {getI18nKey} from '@/utils/routerUtil'

export default {
  name: 'PageLayout',
  components: {PageHeader},
  props: ['desc', 'logo', 'title', 'avatar', 'linkList', 'extraImage', "noTitle", 'contentTitle', 'contentDescription'],
  data () {
    return {
      page: {},
      pageHeaderHeight: 0,
    }
  },
  watch: {
    $route() {
      this.page = this.$route.meta.page
    }
  },
  updated() {
    if (!this._inactive) {
      this.updatePageHeight()
    }
  },
  activated() {
    this.updatePageHeight()
  },
  deactivated() {
    this.updatePageHeight(0)
  },
  mounted() {
    this.updatePageHeight()
  },
  created() {
    this.page = this.$route.meta.page
  },
  beforeDestroy() {
    this.updatePageHeight(0)
  },
  computed: {
    ...mapState('setting', ['layout', 'multiPage', 'pageMinHeight', 'pageWidth', 'customTitles']),
    pageTitle() {
      let pageTitle = this.page && this.page.title
      return this.title || this.customTitle || (pageTitle && this.$t(pageTitle)) || this.routeName
    },
    routeName() {
      const route = this.$route
      return this.$t(getI18nKey(route.matched[route.matched.length - 1].path))
    },
    marginCorrect() {
      return this.multiPage ? 24 : 0
    }
  },
  methods: {
    ...mapMutations('setting', ['correctPageMinHeight']),
    /**
     * 用于计算页面内容最小高度
     * @param newHeight
     */
    updatePageHeight(newHeight = this.$refs.pageHeader.$el.offsetHeight + this.marginCorrect) {
      this.correctPageMinHeight(this.pageHeaderHeight - newHeight)
      this.pageHeaderHeight = newHeight
    }
  }
}
</script>

<style lang="less">
  .page-header{
    margin: 0 -24px 0;
  }
  .link{
    /*margin-top: 16px;*/
    line-height: 24px;
    a{
      font-size: 14px;
      margin-right: 32px;
      i{
        font-size: 22px;
        margin-right: 8px;
      }
    }
  }
  .page-content{
    position: relative;
    z-index: 9;
    &.page-content--standalone{
      padding-top: 16px;
    }
    &.head.fixed{
      margin: 0 auto;
      max-width: 1400px;
    }
  }
</style>
