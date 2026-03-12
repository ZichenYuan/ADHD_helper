import { createContext, useContext, useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../firebase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // No Firebase config — skip auth, treat as signed-in anonymous user
      console.warn('[auth] Firebase not configured. Running without authentication.')
      setUser(null)
      return
    }
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
    })
    return unsub
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setError(e.message)
    }
  }

  const signInWithEmail = async (email, password) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError(e.message)
    }
  }

  const signUp = async (email, password) => {
    setError(null)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError(e.message)
    }
  }

  const signOut = async () => {
    setError(null)
    try {
      await firebaseSignOut(auth)
    } catch (e) {
      setError(e.message)
    }
  }

  const getIdToken = async () => {
    if (!auth || !auth.currentUser) return null
    return auth.currentUser.getIdToken()
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading: user === undefined,
      error,
      clearError: () => setError(null),
      signInWithGoogle,
      signInWithEmail,
      signUp,
      signOut,
      getIdToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
