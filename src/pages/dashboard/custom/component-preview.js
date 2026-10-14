// Decorative component previews only: no monitor values or series are generated.
const PREVIEWS = {
  line: `<path d="M24 24V168H336" fill="none" stroke="currentColor" opacity=".25"/>
    <path d="M24 60H336M24 108H336" stroke="currentColor" opacity=".1"/>
    <path d="M24 143L65 123L106 132L147 78L188 94L229 52L270 67L311 29L336 43V168H24Z" fill="currentColor" opacity=".12"/>
    <path d="M24 143L65 123L106 132L147 78L188 94L229 52L270 67L311 29L336 43" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 152L65 141L106 150L147 117L188 129L229 103L270 112L311 84L336 96" fill="none" stroke="#ff9248" stroke-width="2"/>`,
  bar: `<path d="M24 24V168H336M24 60H336M24 108H336" fill="none" stroke="currentColor" opacity=".13"/>
    <g fill="currentColor" opacity=".8"><rect x="45" y="100" width="20" height="68"/><rect x="87" y="68" width="20" height="100"/>
    <rect x="129" y="85" width="20" height="83"/><rect x="171" y="50" width="20" height="118"/><rect x="213" y="62" width="20" height="106"/>
    <rect x="255" y="35" width="20" height="133"/><rect x="297" y="48" width="20" height="120"/></g>`,
  pie: `<g fill="none" stroke-width="22" transform="rotate(-90 180 86)" style="filter:drop-shadow(0 0 5px rgba(0,230,255,.3))">
    <circle cx="180" cy="86" r="55" stroke="currentColor" opacity=".12"/>
    <circle cx="180" cy="86" r="55" stroke="currentColor" stroke-dasharray="151 346"/>
    <circle cx="180" cy="86" r="55" stroke="#1f7bff" stroke-dasharray="100 346" stroke-dashoffset="-157"/>
    <circle cx="180" cy="86" r="55" stroke="#7c3cff" stroke-dasharray="77 346" stroke-dashoffset="-263"/></g>
    <text x="180" y="94" text-anchor="middle" fill="currentColor" font-size="22">—</text>
    <g fill="currentColor"><rect x="77" y="172" width="9" height="9"/><rect x="92" y="174" width="36" height="5" opacity=".35"/>
    <rect x="152" y="172" width="9" height="9" fill="#1f7bff"/><rect x="167" y="174" width="36" height="5" opacity=".35"/>
    <rect x="227" y="172" width="9" height="9" fill="#7c3cff"/><rect x="242" y="174" width="36" height="5" opacity=".35"/></g>`,
  gauge: `<path d="M93 155 A100 100 0 1 1 267 155" fill="none" stroke="currentColor" opacity=".12" stroke-width="18"/>
    <path d="M93 155 A100 100 0 0 1 180 5" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>
    <path d="M112 144 A78 78 0 1 1 248 144" fill="none" stroke="currentColor" opacity=".45" stroke-width="4" stroke-dasharray="2 12"/>
    <text x="180" y="110" text-anchor="middle" fill="currentColor" font-size="36">—</text>
    <rect x="146" y="131" width="68" height="6" rx="3" fill="currentColor" opacity=".25"/>`,
  table: `<path d="M20 55H340" stroke="currentColor" opacity=".35" stroke-dasharray="4 3"/>
    <g fill="currentColor" opacity=".55"><rect x="34" y="37" width="65" height="6"/><rect x="258" y="37" width="48" height="6"/></g>
    <path d="M20 91H340M20 126H340M20 161H340" stroke="currentColor" opacity=".13"/>
    <g fill="currentColor" opacity=".3"><rect x="34" y="70" width="130" height="6"/><rect x="34" y="105" width="130" height="6"/><rect x="34" y="140" width="130" height="6"/></g>
    <g fill="currentColor" opacity=".8"><rect x="258" y="70" width="48" height="6"/><rect x="258" y="105" width="48" height="6"/><rect x="258" y="140" width="48" height="6"/></g>`,
  topology: `<path d="M124 100H236L226 94M236 100L226 106" fill="none" stroke="currentColor" stroke-width="2" opacity=".6"/>
    <g fill="currentColor" fill-opacity=".06" stroke="currentColor"><rect x="24" y="60" width="100" height="80" rx="2"/><rect x="236" y="60" width="100" height="80" rx="2"/></g>
    <g stroke="currentColor" opacity=".65"><path d="M44 86H104M44 100H104M44 114H84M256 86H316M256 100H316M256 114H296"/></g>`,
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
