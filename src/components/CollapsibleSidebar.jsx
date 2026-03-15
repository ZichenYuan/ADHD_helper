import { useEffect, useCallback } from 'react'
import './CollapsibleSidebar.css'

export default function CollapsibleSidebar({ children, itemCount = 0, isOpen, onToggle }) {
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) onToggle()
  }, [isOpen, onToggle])

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  return (
    <>
      {/* Backdrop (mobile) */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onToggle} />
      )}

      {/* Toggle tab on right edge */}
      <button
        className={`sidebar-toggle ${isOpen ? 'sidebar-toggle--open' : ''}`}
        onClick={onToggle}
        aria-label="Toggle brain board sidebar"
      >
        <span className="sidebar-toggle__arrow">{isOpen ? '\u203A' : '\u2039'}</span>
        <span className="sidebar-toggle__label">Board</span>
        {itemCount > 0 && !isOpen && (
          <span className="sidebar-toggle__badge">{itemCount > 99 ? '99+' : itemCount}</span>
        )}
      </button>

      {/* Sidebar panel */}
      <aside
        className={`sidebar-panel ${isOpen ? 'sidebar-panel--open' : ''}`}
        role="complementary"
        aria-label="Brain board"
      >
        <div className="sidebar-panel__header">
          <h2 className="sidebar-panel__title">Your Brain, Sorted</h2>
          <button
            className="sidebar-panel__close"
            onClick={onToggle}
            aria-label="Close sidebar"
          >
            &times;
          </button>
        </div>
        <div className="sidebar-panel__content">
          {children}
        </div>
      </aside>
    </>
  )
}
