import Vue from 'vue'
import OperationsWidget from '../../screen/components/OperationsWidget'

// Mount the actual screen component, not an SVG facsimile. Reuse on data/size
// updates so animated values and local flow history survive a refresh.
export function renderOperationsNode(node, parent) {
  const element = document.createElement('div')
  element.style.cssText = 'width:100%;height:100%;background:transparent'
  const mount = document.createElement('div')
  element.appendChild(mount)
  let vm
  const props = () => {
    const data = node.getData() || {}
    return {type: data.chart_type, title: data.title, payload: data.operations || {}, status: data.loadState, metric: (data.data_source || {}).metric || 'cpu'}
  }
  const start = () => {
    if (!element.isConnected || vm) return
    vm = new Vue({parent, data: {widgetProps: props()}, render(h) {
      return h(OperationsWidget, {props: this.widgetProps, on: {'metric-change': metric => {
        if (!parent || parent.isReadonly || parent.$options.name !== 'CustomDashboardDesigner') return
        const data = node.getData()
        node.setData({...data, data_source: {...data.data_source, metric}}, {overwrite: true})
        if (parent.selectedNode === node) parent.editor.data_source.metric = metric
      }}})
    }}).$mount(mount)
  }
  const frame = requestAnimationFrame(start)
  return {element, update() { if (vm) vm.widgetProps = props() }, dispose() { cancelAnimationFrame(frame); if (vm) vm.$destroy() }}
}
