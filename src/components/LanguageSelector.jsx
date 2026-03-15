import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LANGUAGES } from '../hooks/useVoiceSession'
import { saveDigestPreferences } from '../hooks/useFirestoreItems'

const langEntries = Object.entries(LANGUAGES)

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const ampm = i < 12 ? 'AM' : 'PM'
  const h = i === 0 ? 12 : i > 12 ? i - 12 : i
  return { value: i, label: `${h} ${ampm}` }
})

const DAYS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
]

export default function LanguageSelector({ value, onChange, disabled, user, digestPrefs }) {
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

  const handleFrequency = (freq) => {
    if (!user) return
    saveDigestPreferences(user.uid, { digestFrequency: freq })
  }

  const handleHour = (e) => {
    if (!user) return
    saveDigestPreferences(user.uid, { digestHour: parseInt(e.target.value, 10) })
  }

  const handleDay = (e) => {
    if (!user) return
    saveDigestPreferences(user.uid, { digestDay: e.target.value })
  }

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

          {/* Digest settings — only shown when logged in */}
          {user && digestPrefs && (
            <>
              <div className="settings-popover__divider" />
              <div className="settings-popover__section-label">📧 Brain Dispatch</div>

              <div className="digest-freq-row">
                {['daily', 'weekly', 'never'].map(freq => (
                  <button
                    key={freq}
                    className={`digest-freq-btn ${digestPrefs.digestFrequency === freq ? 'digest-freq-btn--active' : ''}`}
                    onClick={() => handleFrequency(freq)}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </button>
                ))}
              </div>

              {digestPrefs.digestFrequency !== 'never' && (
                <div className="digest-options">
                  {digestPrefs.digestFrequency === 'weekly' && (
                    <select
                      className="digest-select"
                      value={digestPrefs.digestDay}
                      onChange={handleDay}
                    >
                      {DAYS.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  )}
                  <select
                    className="digest-select"
                    value={digestPrefs.digestHour}
                    onChange={handleHour}
                  >
                    {HOURS.map(h => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

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
