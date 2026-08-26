<template>
  <a-layout-sider :theme="sideTheme" :class="['side-menu', 'beauty-scroll', isMobile ? null : 'shadow']" width="256px" :collapsible="collapsible" v-model="collapsed" :trigger="null">
    <div :class="['logo', theme]">
      <router-link to="/dashboard/workplace">
        <span :class="['logo-brand', collapsed ? 'is-collapsed' : 'is-expanded']">
          <img
            class="brand-image"
            :src="collapsed ? brandMarkEmbeddedLogo : brandWideEmbeddedLogo"
            :alt="collapsed ? '奇安信标志' : '奇安信 新一代网络安全领军者'"
          >
        </span>
      </router-link>
    </div>
    <i-menu :theme="theme" :collapsed="collapsed" :options="menuData" @select="onSelect" class="menu" />
  </a-layout-sider>
</template>

<script>
import IMenu from "./menu";
import { mapState } from "vuex";
export default {
  name: "SideMenu",
  components: { IMenu },
  data() {
    return {
      brandWideEmbeddedLogo: require('@/assets/img/qianxin-horizontal-embedded.png'),
      brandMarkEmbeddedLogo: require('@/assets/img/qianxin-tiger-embedded.png'),
    };
  },
  props: {
    collapsible: {
      type: Boolean,
      required: false,
      default: false,
    },
    collapsed: {
      type: Boolean,
      required: false,
      default: false,
    },
    menuData: {
      type: Array,
      required: true,
    },
    theme: {
      type: String,
      required: false,
      default: "dark",
    },
  },
  computed: {
    sideTheme() {
      return this.theme == "light" ? this.theme : "dark";
    },
    ...mapState("setting", ["isMobile"]),
  },
  methods: {
    onSelect(obj) {
      this.$emit("menuSelect", obj);
    },
  },
};
</script>

<style lang="less" scoped>
@import "index";
</style>
