import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { isFirebaseConfigured } from './firebase'
import useFirestoreItems, { ensureUserProfile, saveLastFuelLevel } from './hooks/useFirestoreItems'
import BackgroundBlobs from './components/BackgroundBlobs'
import BreatheOverlay from './components/BreatheOverlay'
import FuelGauge from './components/FuelGauge'
import LanguageSelector from './components/LanguageSelector'
import LoginScreen from './components/LoginScreen'
import PulseButton from './components/PulseButton'
import ChatLog from './components/ChatLog'
import BrainBoard from './components/BrainBoard'
import UndoToast from './components/UndoToast'
import useVoiceSession from './hooks/useVoiceSession'
import './App.css'

function App() {
  const { user, loading } = useAuth()
  const [fuelLevel, setFuelLevel] = useState(null)
  const [language, setLanguage] = useState('en')
  const [showBreathe, setShowBreathe] = useState(false)
  const [undoState, setUndoState] = useState(null) // { message, undoFn }

  // Firestore-backed board items
  const {
    categories,
    completedItems,
    addItem,
    completeItem,
    deleteItem,
    restoreItem,
    reAddItem,
    isLoading: itemsLoading,
  } = useFirestoreItems(user?.uid)

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

  // Create profile doc on first sign-in
  useEffect(() => {
    if (!user) return
    ensureUserProfile(user.uid, user)
  }, [user])

  // Persist last fuel level whenever it changes
  useEffect(() => {
    if (!user || fuelLevel == null) return
    saveLastFuelLevel(user.uid, fuelLevel)
  }, [user, fuelLevel])

  // Handle real-time tool events from the backend
  useEffect(() => {
    onToolEvent((event) => {
      switch (event.type) {
        case 'categorize':
          addItem(event.category, event.text)
          break

        case 'stress_reset':
          setShowBreathe(true)
          break

        case 'task_steps':
          console.log('[App] Task steps:', event)
          break

        case 'suggestions':
          console.log('[App] Suggestions:', event)
          break
      }
    })
  }, [onToolEvent, addItem])

  // ── Item action handlers ──

  const handleComplete = useCallback(async (id) => {
    await completeItem(id)
    setUndoState({
      message: 'Marked as done',
      undoFn: () => restoreItem(id),
    })
  }, [completeItem, restoreItem])

  const handleDelete = useCallback(async (id) => {
    const data = await deleteItem(id)
    if (data) {
      setUndoState({
        message: 'Removed',
        undoFn: () => reAddItem(data.category, data.text),
      })
    }
  }, [deleteItem, reAddItem])

  const handleRestore = useCallback(async (id) => {
    await restoreItem(id)
  }, [restoreItem])

  const handleUndo = useCallback(() => {
    if (undoState?.undoFn) {
      undoState.undoFn()
    }
    setUndoState(null)
  }, [undoState])

  const handleDismissUndo = useCallback(() => {
    setUndoState(null)
  }, [])

  const handleToggle = useCallback(() => {
    if (isConnected) {
      stop()
    } else {
      start(fuelLevel)
    }
  }, [isConnected, fuelLevel, start, stop])

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="app">
        <BackgroundBlobs />
        <div className="app-content" style={{ justifyContent: 'center', minHeight: '60vh' }}>
          <p className="login-loading">loading...</p>
        </div>
      </div>
    )
  }

  // Show login screen when not authenticated (only if Firebase is configured)
  if (!user && isFirebaseConfigured) {
    return (
      <div className="app">
        <BackgroundBlobs />
        <LoginScreen />
      </div>
    )
  }

  const statusText = isConnected
    ? isListening
      ? 'speak freely'
      : 'connecting...'
    : fuelLevel
      ? 'ready when you are'
      : 'set your energy to start'

  return (
    <div className={`app ${isConnected ? 'app--session' : ''}`}>
      {showBreathe && <BreatheOverlay onClose={() => setShowBreathe(false)} />}
      <BackgroundBlobs />
      <LanguageSelector value={language} onChange={setLanguage} disabled={isConnected} user={user} />

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
          <BrainBoard
            categories={categories}
            completedItems={completedItems}
            isLoading={itemsLoading}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onRestore={handleRestore}
          />
        </div>
      </div>

      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={handleUndo}
          onDismiss={handleDismissUndo}
        />
      )}
    </div>
  )
}

export default App
