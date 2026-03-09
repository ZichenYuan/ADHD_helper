import { useState, useCallback, useEffect } from 'react'
import BackgroundBlobs from './components/BackgroundBlobs'
import FuelGauge from './components/FuelGauge'
import LanguageSelector from './components/LanguageSelector'
import PulseButton from './components/PulseButton'
import ChatLog from './components/ChatLog'
import BrainBoard from './components/BrainBoard'
import useVoiceSession from './hooks/useVoiceSession'
import './App.css'

function App() {
  const [fuelLevel, setFuelLevel] = useState(null)
  const [language, setLanguage] = useState('en')
  const [categories, setCategories] = useState(null)

  const {
    isConnected,
    isListening,
    messages,
    error,
    start,
    stop,
    clearMessages,
    onToolEvent,
  } = useVoiceSession(language)

  // Handle real-time tool events from the backend (replaces post-session categorization)
  useEffect(() => {
    onToolEvent((event) => {
      switch (event.type) {
        case 'categorize':
          setCategories(prev => {
            const base = prev || { tasks: [], ideas: [], thoughts: [], emotions: [] }
            const key = event.category + 's' // "task" → "tasks"
            if (!base[key]) return base
            return { ...base, [key]: [...base[key], event.text] }
          })
          break

        case 'stress_reset':
          // TODO: trigger breathe animation component (Phase 1 Step 3)
          console.log('[App] Stress reset triggered')
          break

        case 'task_steps':
          // TODO: show micro-steps checklist component (Phase 1 Step 3)
          console.log('[App] Task steps:', event)
          break

        case 'suggestions':
          // TODO: show energy-matched suggestions UI (Phase 1 Step 3)
          console.log('[App] Suggestions:', event)
          break
      }
    })
  }, [onToolEvent])

  const handleToggle = useCallback(() => {
    if (isConnected) {
      stop()
    } else {
      start(fuelLevel)
    }
  }, [isConnected, fuelLevel, start, stop])

  // Keep a ref of messages so we can access them in the timeout

  const statusText = isConnected
    ? isListening
      ? 'speak freely'
      : 'connecting...'
    : fuelLevel
      ? 'ready when you are'
      : 'set your energy to start'

  return (
    <div className={`app ${isConnected ? 'app--session' : ''}`}>
      <BackgroundBlobs />
      <LanguageSelector value={language} onChange={setLanguage} disabled={isConnected} />

      <div className="app-content">
        <header className="header">
          <h1 className="header__title">brain dump</h1>
          <p className="header__subtitle">built by ADHD, for your ADHD brain</p>
          <div className="header__accent">
            <div className="header__accent-line" style={{ background: 'linear-gradient(90deg, transparent, #E8927C)' }} />
            <div className="header__accent-dot" style={{ background: '#E8927C' }} />
            <div className="header__accent-dot" style={{ background: '#B8A9D4' }} />
            <div className="header__accent-dot" style={{ background: '#E8C86A' }} />
            <div className="header__accent-dot" style={{ background: '#8DB48E' }} />
            <div className="header__accent-line" style={{ background: 'linear-gradient(90deg, #8DB48E, transparent)' }} />
          </div>
        </header>

        <FuelGauge value={fuelLevel} onChange={setFuelLevel} />

        <PulseButton
          isActive={isConnected}
          isListening={isListening}
          onToggle={handleToggle}
          statusText={statusText}
        />

        {error && <div className="error-banner">{error}</div>}

        <div className="app-panels">
          <ChatLog messages={messages} isActive={isConnected} />
          <BrainBoard categories={categories} />
        </div>
      </div>
    </div>
  )
}

export default App
