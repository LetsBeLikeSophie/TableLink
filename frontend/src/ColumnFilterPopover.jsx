import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ConditionEditor from './ConditionEditor'

const MARGIN = 12

/**
 * Excel-style "click a column header to filter it" popup. Rendered via a
 * portal so the scrollable/sticky-header preview table can't clip it, and
 * positioned from the trigger element's own bounding rect rather than the
 * raw click coordinate — stays anchored correctly even if the mouse moves
 * before the value is set.
 */
function ColumnFilterPopover({ anchorRect, condition, domainState, onChange, onRemove, onClose }) {
  const popoverRef = useRef(null)
  // Render once off-screen to measure actual size, then place it — avoids
  // hardcoding the popover's width/height to keep it clear of the viewport
  // edge (e.g. a column near the right edge of a wide, scrolled-right table).
  const [style, setStyle] = useState({ position: 'fixed', top: -9999, left: -9999, visibility: 'hidden' })

  useLayoutEffect(() => {
    const el = popoverRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()

    let left = anchorRect.left
    if (left + width + MARGIN > window.innerWidth) {
      left = anchorRect.right - width // hug the header's right edge instead
    }
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))

    let top = anchorRect.bottom + 6
    if (top + height + MARGIN > window.innerHeight) {
      top = anchorRect.top - height - 6 // flip above the header
    }
    top = Math.max(MARGIN, top)

    setStyle({ position: 'fixed', top, left, visibility: 'visible' })
  }, [anchorRect])

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [onClose])

  return createPortal(
    <div className="column-filter-popover" style={style} ref={popoverRef}>
      <div className="column-filter-popover-header">
        <span className="mono">
          <span className="muted">{condition.tableName}.</span>
          {condition.column}
        </span>
        <button type="button" className="link-button" onClick={onRemove}>
          제거
        </button>
      </div>
      <ConditionEditor condition={condition} domainState={domainState} onChange={onChange} onComplete={onClose} />
    </div>,
    document.body,
  )
}

export default ColumnFilterPopover
