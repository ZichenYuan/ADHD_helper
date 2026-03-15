import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Manages Firestore persistence for brain board items.
 *
 * Returns:
 *   categories      — { tasks: [{id, text}], ideas: [...], thoughts: [...], emotions: [...] }
 *   completedItems  — { tasks: [{id, text, completedAt}], ... } (last 7 days)
 *   addItem         — (category, text) => Promise<void>
 *   completeItem    — (id) => Promise<void>
 *   deleteItem      — (id) => Promise<{category, text}> (returns deleted data for undo)
 *   restoreItem     — (id) => Promise<void>   (un-completes)
 *   reAddItem       — (category, text) => Promise<string> (re-creates a deleted doc, returns new id)
 *   isLoading       — true while initial snapshot is loading
 */
export default function useFirestoreItems(uid) {
  const [categories, setCategories] = useState(null)
  const [completedItems, setCompletedItems] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Real-time listener on active (not completed) items
  useEffect(() => {
    if (!db || !uid) {
      setCategories(null)
      return
    }

    setIsLoading(true)

    const itemsRef = collection(db, 'users', uid, 'items')
    const q = query(itemsRef, where('completed', '==', false))

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const cats = { tasks: [], ideas: [], thoughts: [], emotions: [] }

        const docs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0
            const bTime = b.createdAt?.toMillis?.() ?? 0
            return aTime - bTime
          })

        docs.forEach(item => {
          const key = item.category + 's'
          if (cats[key]) {
            cats[key].push({ id: item.id, text: item.text })
          }
        })

        setCategories(cats)
        setIsLoading(false)
      },
      (err) => {
        console.error('[useFirestoreItems] Snapshot error:', err)
        setIsLoading(false)
      }
    )

    return unsub
  }, [uid])

  // Real-time listener on completed items (last 7 days)
  useEffect(() => {
    if (!db || !uid) {
      setCompletedItems(null)
      return
    }

    const itemsRef = collection(db, 'users', uid, 'items')
    const sevenDaysAgo = Timestamp.fromDate(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    )
    const q = query(
      itemsRef,
      where('completed', '==', true),
      where('completedAt', '>=', sevenDaysAgo)
    )

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const cats = { tasks: [], ideas: [], thoughts: [], emotions: [] }

        const docs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const bTime = b.completedAt?.toMillis?.() ?? 0
            const aTime = a.completedAt?.toMillis?.() ?? 0
            return bTime - aTime // newest first
          })

        docs.forEach(item => {
          const key = item.category + 's'
          if (cats[key]) {
            cats[key].push({ id: item.id, text: item.text, completedAt: item.completedAt })
          }
        })

        setCompletedItems(cats)
      },
      (err) => {
        console.error('[useFirestoreItems] Completed snapshot error:', err)
      }
    )

    return unsub
  }, [uid])

  const addItem = useCallback(async (category, text) => {
    if (!db || !uid) return
    const itemsRef = collection(db, 'users', uid, 'items')
    await addDoc(itemsRef, {
      text,
      category,
      completed: false,
      createdAt: serverTimestamp(),
      completedAt: null,
    })
  }, [uid])

  const completeItem = useCallback(async (id) => {
    if (!db || !uid) return
    const itemRef = doc(db, 'users', uid, 'items', id)
    await updateDoc(itemRef, {
      completed: true,
      completedAt: serverTimestamp(),
    })
  }, [uid])

  const deleteItem = useCallback(async (id) => {
    if (!db || !uid) return null
    const itemRef = doc(db, 'users', uid, 'items', id)
    // Read the doc first so we can return data for undo
    const snap = await getDoc(itemRef)
    const data = snap.exists() ? snap.data() : null
    await deleteDoc(itemRef)
    return data ? { category: data.category, text: data.text } : null
  }, [uid])

  const restoreItem = useCallback(async (id) => {
    if (!db || !uid) return
    const itemRef = doc(db, 'users', uid, 'items', id)
    await updateDoc(itemRef, {
      completed: false,
      completedAt: null,
    })
  }, [uid])

  // Re-creates a deleted item (for undo of delete)
  const reAddItem = useCallback(async (category, text) => {
    if (!db || !uid) return null
    const itemsRef = collection(db, 'users', uid, 'items')
    const ref = await addDoc(itemsRef, {
      text,
      category,
      completed: false,
      createdAt: serverTimestamp(),
      completedAt: null,
    })
    return ref.id
  }, [uid])

  return {
    categories,
    completedItems,
    addItem,
    completeItem,
    deleteItem,
    restoreItem,
    reAddItem,
    isLoading,
  }
}

/**
 * Creates the user profile document on first sign-in.
 * Safe to call repeatedly — only writes if the doc doesn't exist.
 */
export async function ensureUserProfile(uid, user) {
  if (!db || !uid) return
  const profileRef = doc(db, 'users', uid)
  const snap = await getDoc(profileRef)
  if (!snap.exists()) {
    await setDoc(profileRef, {
      displayName: user.displayName || '',
      email: user.email || '',
      createdAt: serverTimestamp(),
      preferences: {
        language: 'en',
        lastFuelLevel: null,
        digestFrequency: 'daily',
        digestDay: 'monday',
        digestHour: 9,
      },
    })
  }
}

/**
 * Persists the user's last selected fuel level to their profile.
 */
export async function saveLastFuelLevel(uid, fuelLevel) {
  if (!db || !uid || fuelLevel == null) return
  const profileRef = doc(db, 'users', uid)
  await setDoc(profileRef, { preferences: { lastFuelLevel: fuelLevel } }, { merge: true })
}
