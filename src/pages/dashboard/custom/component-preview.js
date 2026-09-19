// Decorative component previews only: no monitor values or series are generated.
const PREVIEWS = {
  line: `<path d="M24 24V168H336" fill="none" stroke="currentColor" opacity=".25"/>
    <path d="M24 60H336M24 108H336" stroke="currentColor" opacity=".1"/>
    <path d="M24 143L65 123L106 132L147 78L188 94L229 52L270 67L311 29L336 43V168H24Z" fill="currentColor" opacity=".12"/>
    <path d="M24 143L65 123L106 132L147 78L188 94L229 52L270 67L311 29L336 43" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 152L65 141L106 150L147 117L188 129L229 103L270 112L311 84L336 96" fill="none" stroke="#5795ff" stroke-width="2" stroke-dasharray="5 5"/>
    <circle cx="229" cy="52" r="5" fill="currentColor"/><circle cx="311" cy="29" r="5" fill="currentColor"/>`,
  bar: `<path d="M82 30V177M155 30V177M230 30V177M306 30V177" stroke="currentColor" opacity=".1"/>
    <g fill="currentColor"><rect x="24" y="42" width="34" height="7" rx="3" opacity=".35"/><rect x="82" y="34" width="246" height="23" rx="4" opacity=".9"/>
    <rect x="24" y="78" width="34" height="7" rx="3" opacity=".35"/><rect x="82" y="70" width="198" height="23" rx="4" opacity=".7"/>
    <rect x="24" y="114" width="34" height="7" rx="3" opacity=".35"/><rect x="82" y="106" width="155" height="23" rx="4" opacity=".5"/>
    <rect x="24" y="150" width="34" height="7" rx="3" opacity=".35"/><rect x="82" y="142" width="113" height="23" rx="4" opacity=".3"/></g>`,
  pie: `<g fill="none" stroke-width="24" transform="rotate(-90 136 100)">
    <circle cx="136" cy="100" r="62" stroke="currentColor" opacity=".12"/>
    <circle cx="136" cy="100" r="62" stroke="currentColor" stroke-dasharray="172 390"/>
    <circle cx="136" cy="100" r="62" stroke="#5795ff" stroke-dasharray="113 390" stroke-dashoffset="-178"/>
    <circle cx="136" cy="100" r="62" stroke="#9775fa" stroke-dasharray="86 390" stroke-dashoffset="-297"/></g>
    <text x="136" y="107" text-anchor="middle" fill="currentColor" font-size="22">—</text>
    <g fill="currentColor"><rect x="241" y="62" width="9" height="9" rx="2"/><rect x="263" y="64" width="55" height="6" rx="3" opacity=".3"/>
    <rect x="241" y="95" width="9" height="9" rx="2" fill="#5795ff"/><rect x="263" y="97" width="43" height="6" rx="3" opacity=".3"/>
    <rect x="241" y="128" width="9" height="9" rx="2" fill="#9775fa"/><rect x="263" y="130" width="49" height="6" rx="3" opacity=".3"/></g>`,
  gauge: `<path d="M93 155 A100 100 0 1 1 267 155" fill="none" stroke="currentColor" opacity=".12" stroke-width="18"/>
    <path d="M93 155 A100 100 0 0 1 180 5" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>
    <path d="M112 144 A78 78 0 1 1 248 144" fill="none" stroke="currentColor" opacity=".45" stroke-width="4" stroke-dasharray="2 12"/>
    <text x="180" y="110" text-anchor="middle" fill="currentColor" font-size="36">—</text>
    <rect x="146" y="131" width="68" height="6" rx="3" fill="currentColor" opacity=".25"/>`,
  table: `<rect x="20" y="25" width="320" height="30" rx="4" fill="currentColor" opacity=".16"/>
    <g fill="currentColor" opacity=".65"><rect x="34" y="37" width="54" height="6" rx="3"/><rect x="143" y="37" width="54" height="6" rx="3"/><rect x="266" y="37" width="40" height="6" rx="3"/></g>
    <path d="M20 91H340M20 126H340M20 161H340" stroke="currentColor" opacity=".13"/>
    <g fill="currentColor" opacity=".2"><rect x="34" y="70" width="65" height="6" rx="3"/><rect x="143" y="70" width="78" height="6" rx="3"/>
    <rect x="34" y="105" width="54" height="6" rx="3"/><rect x="143" y="105" width="62" height="6" rx="3"/>
    <rect x="34" y="140" width="69" height="6" rx="3"/><rect x="143" y="140" width="83" height="6" rx="3"/></g>
    <g fill="currentColor" opacity=".45"><rect x="266" y="64" width="50" height="17" rx="8"/><rect x="266" y="99" width="50" height="17" rx="8"/><rect x="266" y="134" width="50" height="17" rx="8"/></g>`,
  topology: `<path d="M70 100H170M190 100L280 45M190 100L280 155" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 4" opacity=".6"/>
    <g fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="2"><rect x="24" y="75" width="68" height="50" rx="8"/>
    <circle cx="180" cy="100" r="27"/><rect x="267" y="20" width="68" height="50" rx="8"/><rect x="267" y="130" width="68" height="50" rx="8"/></g>
    <g stroke="currentColor" opacity=".65"><path d="M41 90H75M41 100H75M41 110H61M284 35H318M284 45H318M284 55H304M284 145H318M284 155H318M284 165H304"/></g>
    <circle cx="180" cy="100" r="8" fill="currentColor"/>`,
}

function previewGraphic(type) {
  return `<svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:100%;height:100%;display:block">${PREVIEWS[type] || PREVIEWS.line}</svg>`
}

function darkBackground(value) {
  if (!/^#[0-9a-f]{6}$/i.test(value || '')) return false
  const rgb = [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16))
  return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 < 128
}

module.exports = {previewGraphic, darkBackground}
