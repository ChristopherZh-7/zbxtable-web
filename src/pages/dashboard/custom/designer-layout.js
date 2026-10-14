function arrangeNodes(nodes, action, gap, canvas) {
  if (!Array.isArray(nodes) || nodes.length < 2) throw new Error('请先选择至少两个组件')
  const result = nodes.map(node => ({...node}))
  if (result.some(n => ![n.x, n.y, n.width, n.height].every(Number.isFinite) || n.width <= 0 || n.height <= 0)) throw new Error('组件尺寸无效')
  const left = Math.min(...result.map(n => n.x)), top = Math.min(...result.map(n => n.y))
  const right = Math.max(...result.map(n => n.x + n.width)), bottom = Math.max(...result.map(n => n.y + n.height))
  if (action === 'horizontal-gap' || action === 'vertical-gap') {
    if (!Number.isFinite(gap) || gap < 0 || gap > 200) throw new Error('间距须在 0–200 像素之间')
    const horizontal = action === 'horizontal-gap', axis = horizontal ? 'x' : 'y', size = horizontal ? 'width' : 'height'
    result.sort((a, b) => a[axis] - b[axis])
    let cursor = horizontal ? left : top
    result.forEach(node => { node[axis] = cursor; cursor += node[size] + gap })
  } else {
    if (!['left', 'center', 'right', 'top', 'middle', 'bottom'].includes(action)) throw new Error('请选择对齐方式')
    result.forEach(node => {
      if (action === 'left') node.x = left
      if (action === 'center') node.x = (left + right - node.width) / 2
      if (action === 'right') node.x = right - node.width
      if (action === 'top') node.y = top
      if (action === 'middle') node.y = (top + bottom - node.height) / 2
      if (action === 'bottom') node.y = bottom - node.height
    })
  }
  if (result.some(n => n.x < 0 || n.y < 0 || n.x + n.width > canvas.width || n.y + n.height > canvas.height)) throw new Error('调整后会超出画布，请减少间距或调整组件大小')
  return result
}

function presentationTransform(canvas, viewport, nodes = [], padding = 16) {
  const width = Math.max(canvas.width, ...nodes.map(n => n.x + n.width), 1)
  const height = Math.max(canvas.height, ...nodes.map(n => n.y + n.height), 1)
  const scale = Math.max(0.01, Math.min((viewport.width - padding * 2) / width, (viewport.height - padding * 2) / height))
  return {scale, x: (viewport.width - width * scale) / 2, y: (viewport.height - height * scale) / 2}
}

module.exports = {arrangeNodes, presentationTransform}
