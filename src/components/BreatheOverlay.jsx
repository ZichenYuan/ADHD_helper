import { useState, useEffect, useRef } from 'react'

/*
 * BreatheOverlay — full-screen calming breathe animation.
 *
 * Triggered by the AI's activate_stress_reset() tool call.
 * Runs ~60 seconds of box breathing (4 cycles × 15s each),
 * then auto-dismisses. User can exit early via "I feel better now".
 *
 * Breathing pattern per cycle (15s):
 *   Breathe in  — 4s (circle expands)
 *   Hold        — 4s (circle holds at max)
 *   Breathe out — 4s (circle contracts)
 *   Rest        — 3s (circle holds at min)
 */

const PHASES = [
  { label: 'breathe in',  duration: 4000 },
  { label: 'hold',        duration: 4000 },
  { label: 'breathe out', duration: 4000 },
  { label: 'rest',        duration: 3000 },
]

const CYCLE_MS = PHASES.reduce((sum, p) => sum + p.duration, 0) // 15000ms
const TOTAL_CYCLES = 4
const TOTAL_MS = CYCLE_MS * TOTAL_CYCLES // 60000ms

export default function BreatheOverlay({ onClose }) {
  const [phase, setPhase] = useState(0)        // 0-3 index into PHASES
  const [cycle, setCycle] = useState(0)         // 0-3 current cycle
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(TOTAL_MS / 1000))
  const [exiting, setExiting] = useState(false)
  const startTimeRef = useRef(Date.now())

  // Phase progression
  useEffect(() => {
    if (exiting) return

    const timer = setTimeout(() => {
      const nextPhase = phase + 1
      if (nextPhase >= PHASES.length) {
        // End of cycle
        const nextCycle = cycle + 1
        if (nextCycle >= TOTAL_CYCLES) {
          // All cycles done
          handleExit()
          return
        }
        setCycle(nextCycle)
        setPhase(0)
      } else {
        setPhase(nextPhase)
      }
    }, PHASES[phase].duration)

    return () => clearTimeout(timer)
  }, [phase, cycle, exiting])

  // Countdown timer
  useEffect(() => {
    if (exiting) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, Math.ceil((TOTAL_MS - elapsed) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 250)

    return () => clearInterval(interval)
  }, [exiting])

  const handleExit = () => {
    setExiting(true)
    // Wait for fade-out animation
    setTimeout(() => onClose(), 500)
  }

  const currentPhase = PHASES[phase]
  const isExpanding = phase === 0
  const isHoldBig = phase === 1
  const isContracting = phase === 2
  // phase === 3 is rest (hold small)

  // Circle animation class
  let circleClass = 'breathe-circle'
  if (isExpanding) circleClass += ' breathe-circle--expand'
  else if (isHoldBig) circleClass += ' breathe-circle--hold-big'
  else if (isContracting) circleClass += ' breathe-circle--contract'
  else circleClass += ' breathe-circle--hold-small'

  // Progress dots for cycles
  const dots = Array.from({ length: TOTAL_CYCLES }, (_, i) => (
    <span
      key={i}
      className={`breathe-dot ${i < cycle ? 'breathe-dot--done' : ''} ${i === cycle ? 'breathe-dot--active' : ''}`}
    />
  ))

  return (
    <div className={`breathe-overlay ${exiting ? 'breathe-overlay--exit' : ''}`}>
      {/* Ambient background */}
      <div className="breathe-bg" />

      {/* Breathing circle */}
      <div className="breathe-center">
        <div className={circleClass} style={{ '--phase-duration': `${currentPhase.duration}ms` }}>
          <div className="breathe-circle__inner" />
          <div className="breathe-circle__glow" />
        </div>

        <p className="breathe-label" key={`${cycle}-${phase}`}>
          {currentPhase.label}
        </p>

        <div className="breathe-dots">{dots}</div>

        <p className="breathe-timer">{secondsLeft}s</p>
      </div>

      {/* Exit button */}
      <button className="breathe-exit" onClick={handleExit}>
        I feel better now
      </button>
    </div>
  )
}
