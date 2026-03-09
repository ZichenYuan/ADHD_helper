import { useState, useRef, useEffect } from 'react'
import { LANGUAGES } from '../hooks/useVoiceSession'

const langEntries = Object.entries(LANGUAGES)

export default function LanguageSelector({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentLang = LANGUAGES[value] || LANGUAGES.en

  return (
    <div className="settings-corner" ref={ref}>
      <button
        className={`settings-trigger ${isOpen ? 'settings-trigger--open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Language settings"
        disabled={disabled}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.2" />
          <ellipse cx="9" cy="9" rx="3.5" ry="7.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1.5" y1="9" x2="16.5" y2="9" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span className="settings-trigger__lang">{currentLang.label}</span>
      </button>

      {isOpen && (
        <div className="settings-popover">
          {langEntries.map(([code, cfg]) => (
            <button
              key={code}
              className={`settings-popover__item ${value === code ? 'settings-popover__item--active' : ''}`}
              onClick={() => { onChange(code); setIsOpen(false) }}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
