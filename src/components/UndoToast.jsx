import { useEffect, useRef } from 'react'

/**
 * UndoToast — fixed toast at bottom-center.
 *
 * Props:
 *   message   — e.g. "Marked as done" or "Removed"
 *   onUndo    — callback when "Undo" is clicked
 *   onDismiss — callback when the toast auto-dismisses or is manually closed
 *   duration  — ms before auto-dismiss (default 5000)
 */
export default function UndoToast({ message, onUndo, onDismiss, duration = 5000 }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss()
    }, duration)

    return () => clearTimeout(timerRef.current)
  }, [onDismiss, duration])

  const handleUndo = () => {
    clearTimeout(timerRef.current)
    onUndo()
  }

  return (
    <div className="undo-toast">
      <span className="undo-toast__message">{message}</span>
      <span className="undo-toast__separator">·</span>
      <button className="undo-toast__action" onClick={handleUndo}>
        Undo
      </button>
    </div>
  )
}
