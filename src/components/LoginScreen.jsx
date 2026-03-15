import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, signUp, error, clearError } = useAuth()
  const [showEmail, setShowEmail] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    if (isSignUp) {
      await signUp(email, password)
    } else {
      await signInWithEmail(email, password)
    }
    setSubmitting(false)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Waving blob buddy hero */}
        <div className="login-blob-hero">
          <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="loginBlobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E8927C" />
                <stop offset="100%" stopColor="#B8A9D4" />
              </linearGradient>
            </defs>
            {/* Main body */}
            <path
              className="login-blob-body"
              d="M70 20C95 18 115 35 118 58C121 80 110 105 85 115C65 122 40 118 28 100C16 82 18 50 35 32C48 20 60 19 70 20Z"
              fill="url(#loginBlobGrad)"
            />
            {/* Waving arm */}
            <path
              className="login-blob-arm"
              d="M112 52C120 42 130 38 132 28C133 23 128 22 126 27C124 32 122 36 118 42"
              stroke="url(#loginBlobGrad)"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            {/* Left eye */}
            <circle cx="55" cy="60" r="4.5" fill="#5D4E43" />
            {/* Right eye */}
            <circle cx="82" cy="58" r="4.5" fill="#5D4E43" />
            {/* Eye sparkles */}
            <circle cx="56.5" cy="58.5" r="1.2" fill="white" />
            <circle cx="83.5" cy="56.5" r="1.2" fill="white" />
            {/* Smile */}
            <path d="M58 76C63 84 78 84 83 76" stroke="#5D4E43" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Cheek blush */}
            <circle cx="48" cy="74" r="6" fill="#E8927C" opacity="0.25" />
            <circle cx="90" cy="72" r="6" fill="#E8927C" opacity="0.25" />
          </svg>
        </div>

        <h1 className="login-title">brain dump</h1>
        <p className="login-subtitle">built by ADHD, for your ADHD brain</p>

        <div className="login-accent">
          <div className="login-accent__line" style={{ background: 'linear-gradient(90deg, transparent, #E8927C)' }} />
          <div className="login-accent__dot" style={{ background: '#E8927C' }} />
          <div className="login-accent__dot" style={{ background: '#B8A9D4' }} />
          <div className="login-accent__dot" style={{ background: '#E8C86A' }} />
          <div className="login-accent__dot" style={{ background: '#8DB48E' }} />
          <div className="login-accent__line" style={{ background: 'linear-gradient(90deg, #8DB48E, transparent)' }} />
        </div>

        <button className="login-google" onClick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <button
          className="login-email-toggle"
          onClick={() => { setShowEmail(v => !v); clearError() }}
        >
          {showEmail ? 'hide' : 'or use email'}
        </button>

        {showEmail && (
          <form className="login-email-form" onSubmit={handleEmailSubmit}>
            <input
              className="login-input"
              type="email"
              placeholder="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              className="login-input"
              type="password"
              placeholder="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? '...' : isSignUp ? 'create account' : 'sign in'}
            </button>
            <button
              type="button"
              className="login-mode-toggle"
              onClick={() => { setIsSignUp(v => !v); clearError() }}
            >
              {isSignUp ? 'already have an account? sign in' : "don't have an account? sign up"}
            </button>
          </form>
        )}

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  )
}
