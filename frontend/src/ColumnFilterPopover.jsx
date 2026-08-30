import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import ConditionEditor from './ConditionEditor'

/**
 * Excel-style "click a column header to filter it" popup. Rendered via a
 * portal so the scrollable/sticky-header preview table can't clip it, and
 * positioned from the trigger element's own bounding rect rather than the
 * raw click coordinate — stays anchored correctly even if the mouse moves
 * before the value is set.
 */
function ColumnFilterPopover({ anchorRect, condition, domainState, onChange, onRemove, onClose }) {
  const popoverRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [onClose])

  const style = {
    position: 'fixed',
    top: anchorRect.bottom + 6,
    left: anchorRect.left,
  }

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
      <ConditionEditor condition={condition} domainState={domainState} onChange={onChange} />
    </div>,
    document.body,
  )
}

export default ColumnFilterPopover
