import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LANGUAGES } from '../hooks/useVoiceSession'

const langEntries = Object.entries(LANGUAGES)

export default function LanguageSelector({ value, onChange, disabled, user }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)
  const { signOut } = useAuth()

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
  const initial = user?.displayName?.[0] || user?.email?.[0] || '?'

  return (
    <div className="settings-corner" ref={ref}>
      <button
        className={`settings-trigger ${isOpen ? 'settings-trigger--open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Settings"
        disabled={disabled}
      >
        {user?.photoURL ? (
          <img className="settings-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="settings-avatar settings-avatar--initial">{initial}</span>
        )}
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
          <div className="settings-popover__divider" />
          <button
            className="settings-popover__item settings-popover__item--signout"
            onClick={() => { signOut(); setIsOpen(false) }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
