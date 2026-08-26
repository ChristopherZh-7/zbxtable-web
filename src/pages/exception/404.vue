<template>
  <main class="smartops-not-found" :style="{ minHeight }" aria-labelledby="not-found-title">
    <section class="not-found-panel">
      <header class="not-found-header">
        <span class="not-found-kicker">导航状态</span>
        <span class="not-found-code">404 · 未登记路径</span>
      </header>

      <div class="route-trace" aria-hidden="true">
        <span class="trace-node is-complete"></span>
        <span class="trace-line is-complete"></span>
        <span class="trace-node is-complete"></span>
        <span class="trace-line is-interrupted"></span>
        <span class="trace-break">×</span>
        <span class="trace-line is-pending"></span>
        <span class="trace-node is-pending"></span>
      </div>

      <div class="not-found-body">
        <aside class="route-index" aria-label="错误编号">
          <strong>404</strong>
          <span>路由断点</span>
        </aside>

        <div class="not-found-content">
          <h1 id="not-found-title">运行路径在这里中断</h1>
          <p>当前地址没有对应页面，可能已移动、已关闭，或不在当前账号的导航范围内。</p>
          <div class="not-found-actions">
            <a-button type="primary" @click="backHome">返回工作台</a-button>
            <a-button @click="backPrevious">返回上一页</a-button>
          </div>
          <p class="not-found-note">
            如果你是从系统菜单进入此页面，请联系管理员核对菜单配置与访问范围。
          </p>
        </div>
      </div>
    </section>
  </main>
</template>

<script>
import {mapState} from 'vuex'
export default {
  name: 'Exp404',
  computed: {
    ...mapState('setting', ['pageMinHeight']),
    minHeight() {
      return this.pageMinHeight ? this.pageMinHeight + 'px' : '100vh'
    }
  },
  methods: {
    backHome() {
      this.$router.push('/dashboard/workplace')
    },
    backPrevious() {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        this.$router.back()
        return
      }
      this.backHome()
    }
  }
}
</script>

<style scoped lang="less">
.smartops-not-found {
  display: grid;
  padding: clamp(32px, 7vw, 96px);
  place-items: center;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(22, 58, 99, .035) 1px, transparent 1px),
    #f3f6fa;
  background-size: 72px 100%;
  color: #17283d;
}

.not-found-panel {
  width: 100%;
  max-width: 880px;
  border-top: 3px solid #0a1f44;
  border-bottom: 1px solid #cad6e2;
  background: rgba(255, 255, 255, .82);
}

.not-found-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 0 2px;
  border-bottom: 1px solid #d8e1ea;
}

.not-found-kicker {
  color: #1b5a96;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .2em;
}

.not-found-code {
  color: #6c7d91;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  letter-spacing: .08em;
}

.route-trace {
  display: grid;
  grid-template-columns: 12px minmax(60px, 1fr) 12px minmax(46px, .55fr) 30px minmax(46px, .55fr) 12px;
  align-items: center;
  padding: 38px 0 28px;
}

.trace-node {
  width: 11px;
  height: 11px;
  border: 2px solid #1b5a96;
  background: #fff;
  transform: rotate(45deg);
}

.trace-node.is-complete {
  background: #1b5a96;
}

.trace-node.is-pending {
  border-color: #a9b6c4;
}

.trace-line {
  height: 2px;
}

.trace-line.is-complete {
  background: #1b5a96;
}

.trace-line.is-interrupted {
  background: linear-gradient(90deg, #1b5a96 0 72%, transparent 72% 100%);
}

.trace-line.is-pending {
  background: repeating-linear-gradient(90deg, #a9b6c4 0 8px, transparent 8px 14px);
}

.trace-break {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #c68a2b;
  color: #a66f1f;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 18px;
  line-height: 1;
}

.not-found-body {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: clamp(36px, 7vw, 82px);
  padding: 42px 0 58px;
  border-top: 1px solid #d8e1ea;
}

.route-index {
  display: grid;
  align-content: start;
  padding-left: 20px;
  border-left: 4px solid #163a63;
}

.route-index strong {
  color: #0a1f44;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: clamp(58px, 8vw, 92px);
  font-weight: 600;
  line-height: .92;
  letter-spacing: -.08em;
}

.route-index span {
  margin-top: 13px;
  color: #76879a;
  font-size: 11px;
  letter-spacing: .18em;
}

.not-found-content h1 {
  margin: -4px 0 16px;
  color: #0a1f44;
  font-size: clamp(30px, 4vw, 44px);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: .02em;
}

.not-found-content > p {
  max-width: 550px;
  margin: 0;
  color: #5f7085;
  font-size: 15px;
  line-height: 1.9;
}

.not-found-actions {
  display: flex;
  gap: 12px;
  margin-top: 30px;
}

.not-found-actions .ant-btn {
  min-width: 116px;
  height: 42px;
  border-radius: 2px;
  box-shadow: none;
}

.not-found-note {
  margin-top: 34px !important;
  padding-top: 15px;
  border-top: 1px solid #d8e1ea;
  color: #7d8b9c !important;
  font-size: 12px !important;
  line-height: 1.7 !important;
}

@media screen and (max-width: 680px) {
  .smartops-not-found {
    padding: 24px 20px;
    place-items: start stretch;
    background-size: 48px 100%;
  }

  .not-found-header {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    padding: 12px 0;
  }

  .route-trace {
    grid-template-columns: 10px minmax(30px, 1fr) 10px minmax(24px, .55fr) 26px minmax(24px, .55fr) 10px;
    padding: 32px 0 24px;
  }

  .trace-break {
    width: 24px;
    height: 24px;
  }

  .not-found-body {
    grid-template-columns: 1fr;
    gap: 34px;
    padding: 34px 0 42px;
  }

  .route-index {
    grid-template-columns: auto 1fr;
    align-items: end;
    gap: 18px;
    padding-left: 14px;
  }

  .route-index strong {
    font-size: 58px;
  }

  .route-index span {
    margin: 0 0 5px;
  }

  .not-found-content h1 {
    font-size: 29px;
  }

  .not-found-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .not-found-actions .ant-btn {
    width: 100%;
  }
}
</style>
