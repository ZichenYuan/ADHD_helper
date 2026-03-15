import { useState } from 'react'

const CATEGORIES = [
  {
    key: 'tasks',
    label: 'Tasks',
    color: '#E8927C',
    bg: '#FFF5F2',
    borderColor: 'rgba(232, 146, 124, 0.3)',
    rotation: '-2.2deg',
    emptyHint: 'no action items yet...',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4.5 8.5L7 11L11.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'ideas',
    label: 'Ideas',
    color: '#D4A020',
    bg: '#FFFCF0',
    borderColor: 'rgba(232, 200, 106, 0.35)',
    rotation: '1.8deg',
    emptyHint: 'no sparks yet...',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 7.8 4.6 9.3 6.2 10V12C6.2 12.4 6.5 12.7 6.9 12.7H9.1C9.5 12.7 9.8 12.4 9.8 12V10C11.4 9.3 12.5 7.8 12.5 6C12.5 3.5 10.5 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="6.5" y1="14.5" x2="9.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'thoughts',
    label: 'Thoughts',
    color: '#8A7BB8',
    bg: '#F8F5FF',
    borderColor: 'rgba(184, 169, 212, 0.35)',
    rotation: '-1.3deg',
    emptyHint: 'nothing noted yet...',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 10C2.3 10 1 8.7 1 7C1 5.5 2 4.2 3.3 4C3.5 2.3 5 1 6.8 1C7.9 1 8.9 1.5 9.5 2.3C9.8 2.2 10.1 2.1 10.5 2.1C12.4 2.1 14 3.7 14 5.6C14 5.8 14 6 13.9 6.2C14.6 6.8 15 7.6 15 8.5C15 10 13.8 11.2 12.3 11.2H4V10Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <circle cx="5" cy="13" r="0.8" fill="currentColor" opacity="0.5" />
        <circle cx="3.5" cy="14.5" r="0.5" fill="currentColor" opacity="0.35" />
      </svg>
    ),
  },
  {
    key: 'emotions',
    label: 'Emotions',
    color: '#6E9A6F',
    bg: '#F3FAF3',
    borderColor: 'rgba(141, 180, 142, 0.35)',
    rotation: '2.5deg',
    emptyHint: 'all clear...',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 14.5C8 14.5 1.5 10 1.5 5.8C1.5 3.5 3.3 2 5.2 2C6.5 2 7.5 2.7 8 3.5C8.5 2.7 9.5 2 10.8 2C12.7 2 14.5 3.5 14.5 5.8C14.5 10 8 14.5 8 14.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function BrainBoard({
  categories,
  completedItems,
  isLoading,
  onComplete,
  onDelete,
  onRestore,
}) {
  const [fadingOut, setFadingOut] = useState({}) // { [itemId]: true }
  const [expandedCompleted, setExpandedCompleted] = useState({}) // { [catKey]: true }

  const hasAnyContent = categories &&
    Object.values(categories).some(arr => arr && arr.length > 0)

  const handleComplete = (id) => {
    setFadingOut(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      onComplete?.(id)
      setFadingOut(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 500)
  }

  const handleDelete = (id) => {
    setFadingOut(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      onDelete?.(id)
      setFadingOut(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 500)
  }

  const toggleCompleted = (catKey) => {
    setExpandedCompleted(prev => ({ ...prev, [catKey]: !prev[catKey] }))
  }

  return (
    <div className="brain-board">
      <h2 className="brain-board__title">Your Brain, Sorted</h2>
      <div className="brain-board__grid">
        {CATEGORIES.map((cat, idx) => {
          const items = categories?.[cat.key] || []
          const completed = completedItems?.[cat.key] || []
          const isExpanded = expandedCompleted[cat.key]

          return (
            <div
              key={cat.key}
              className={`sticky-note ${isLoading ? 'sticky-note--loading' : ''} ${items.length > 0 ? 'sticky-note--has-items' : ''}`}
              style={{
                '--note-color': cat.color,
                '--note-bg': cat.bg,
                '--note-border': cat.borderColor,
                '--note-rotation': cat.rotation,
                animationDelay: `${idx * 0.08}s`,
              }}
            >
              {/* Decorative tape strip */}
              <div className="sticky-note__tape" />

              <div className="sticky-note__header">
                <span className="sticky-note__icon">{cat.icon}</span>
                <span className="sticky-note__label">{cat.label}</span>
                {items.length > 0 && (
                  <span className="sticky-note__count">{items.length}</span>
                )}
              </div>

              <div className="sticky-note__body">
                {isLoading ? (
                  <div className="sticky-note__shimmer">
                    <div className="sticky-note__shimmer-line" style={{ width: '80%' }} />
                    <div className="sticky-note__shimmer-line" style={{ width: '60%' }} />
                  </div>
                ) : items.length > 0 ? (
                  <ul className="sticky-note__list">
                    {items.map((item, i) => {
                      const text = typeof item === 'string' ? item : item.text
                      const id = typeof item === 'string' ? i : item.id
                      const isFading = fadingOut[id]

                      return (
                        <li
                          key={id}
                          className={`sticky-note__item sticky-note__item--interactive ${isFading ? 'sticky-note__item--fade-out' : ''}`}
                          style={{ animationDelay: `${(idx * 0.08) + (i * 0.06)}s` }}
                        >
                          {cat.key === 'tasks' ? (
                            <button
                              className="sticky-note__checkbox"
                              onClick={() => handleComplete(id)}
                              aria-label={`Complete: ${text}`}
                            >
                              <span className="sticky-note__checkbox-box" />
                            </button>
                          ) : (
                            <span className="sticky-note__bullet">·</span>
                          )}
                          <span
                            className="sticky-note__text"
                            onClick={cat.key === 'tasks' ? () => handleComplete(id) : undefined}
                          >
                            {text}
                          </span>
                          <button
                            className="sticky-note__delete"
                            onClick={() => handleDelete(id)}
                            aria-label={`Remove: ${text}`}
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="sticky-note__empty">{cat.emptyHint}</p>
                )}

                {/* Completed items toggle */}
                {completed.length > 0 && (
                  <div className="sticky-note__completed-section">
                    <button
                      className="sticky-note__completed-toggle"
                      onClick={() => toggleCompleted(cat.key)}
                    >
                      {completed.length} completed {isExpanded ? '▾' : '▸'}
                    </button>
                    {isExpanded && (
                      <ul className="sticky-note__list sticky-note__list--completed">
                        {completed.map((item) => (
                          <li key={item.id} className="sticky-note__item sticky-note__item--completed">
                            <span className="sticky-note__bullet sticky-note__bullet--done">✓</span>
                            <span className="sticky-note__text sticky-note__text--done">{item.text}</span>
                            <button
                              className="sticky-note__restore"
                              onClick={() => onRestore?.(item.id)}
                              aria-label={`Restore: ${item.text}`}
                            >
                              ↩
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!hasAnyContent && !isLoading && (
        <p className="brain-board__hint">
          Start a voice session and dump your thoughts — I'll sort them here
        </p>
      )}
    </div>
  )
}
