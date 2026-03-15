import './BlobBuddy.css'

// Gradient configs per mood
const GRADIENTS = {
  idle:      ['#C4B8DC', '#B8A9D4'], // lavender
  low:       ['#F2B5A5', '#E8927C'], // coral
  calm:      ['#F2DFA0', '#E8C86A'], // marigold
  energized: ['#B5D1B6', '#6E9A6F'], // sage
  listening: null,                     // uses fuel-based
  thinking:  null,                     // uses fuel-based
  breathing: ['#D4CCE8', '#B8A9D4'], // lavender
}

function deriveMood({ fuelLevel, isListening, isThinking, isBreathing, isConnected }) {
  if (isBreathing) return 'breathing'
  if (isThinking) return 'thinking'
  if (isListening) return 'listening'
  if (!fuelLevel) return 'idle'
  if (fuelLevel <= 2) return 'low'
  if (fuelLevel === 3) return 'calm'
  return 'energized'
}

function fuelMood(fuelLevel) {
  if (!fuelLevel || fuelLevel <= 2) return 'low'
  if (fuelLevel === 3) return 'calm'
  return 'energized'
}

function getGradient(mood, fuelLevel) {
  if (GRADIENTS[mood]) return GRADIENTS[mood]
  // For listening/thinking, use the fuel-based color
  const fm = fuelMood(fuelLevel)
  return GRADIENTS[fm] || GRADIENTS.idle
}

export default function BlobBuddy({
  fuelLevel = null,
  isListening = false,
  isThinking = false,
  isBreathing = false,
  isConnected = false,
  sidebarOpen = false,
}) {
  const mood = deriveMood({ fuelLevel, isListening, isThinking, isBreathing, isConnected })
  const [color1, color2] = getGradient(mood, fuelLevel)

  return (
    <div className={`blob-buddy blob-buddy--${mood} ${sidebarOpen ? 'blob-buddy--sidebar-open' : ''}`}>
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color1} />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
          <radialGradient id="bbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color2} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color2} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow behind blob (listening state) */}
        <circle className="blob-buddy__glow" cx="35" cy="38" r="32" fill="url(#bbGlow)" />

        {/* Main blob body */}
        <path
          d="M35 12C48 10 60 18 62 30C64 42 57 54 45 58C36 61 25 59 18 51C11 43 10 30 16 21C21 14 28 12 35 12Z"
          fill="url(#bbGrad)"
        />

        {/* Subtle highlight */}
        <ellipse cx="28" cy="24" rx="8" ry="5" fill="white" opacity="0.18" transform="rotate(-20 28 24)" />

        {/* === Eyes === */}
        {mood === 'breathing' ? (
          /* Peaceful ^^ eyes */
          <>
            <path d="M25 33C26 31 28 31 29 33" stroke="#5D4E43" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M39 32C40 30 42 30 43 32" stroke="#5D4E43" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        ) : mood === 'low' ? (
          /* Sleepy half-closed eyes */
          <>
            <ellipse cx="27" cy="33" rx="3" ry="1.5" fill="#5D4E43" />
            <ellipse cx="41" cy="32" rx="3" ry="1.5" fill="#5D4E43" />
          </>
        ) : mood === 'thinking' ? (
          /* Eyes look up-right */
          <>
            <circle cx="28" cy="31" r="2.5" fill="#5D4E43" />
            <circle cx="42" cy="30" r="2.5" fill="#5D4E43" />
          </>
        ) : mood === 'energized' ? (
          /* Wide open sparkly eyes */
          <>
            <circle cx="27" cy="33" r="3.2" fill="#5D4E43" />
            <circle cx="41" cy="32" r="3.2" fill="#5D4E43" />
            <circle cx="28.5" cy="31.5" r="1" fill="white" />
            <circle cx="42.5" cy="30.5" r="1" fill="white" />
          </>
        ) : mood === 'listening' ? (
          /* Wide attentive eyes */
          <>
            <circle cx="27" cy="33" r="3" fill="#5D4E43" />
            <circle cx="41" cy="32" r="3" fill="#5D4E43" />
            <circle cx="28" cy="32" r="0.8" fill="white" />
            <circle cx="42" cy="31" r="0.8" fill="white" />
          </>
        ) : (
          /* Default/idle/calm eyes */
          <>
            <circle cx="27" cy="33" r="2.5" fill="#5D4E43" />
            <circle cx="41" cy="32" r="2.5" fill="#5D4E43" />
          </>
        )}

        {/* === Mouth === */}
        {mood === 'low' ? (
          <path d="M30 41C32 40 36 40 38 41" stroke="#5D4E43" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        ) : mood === 'energized' ? (
          <path d="M28 40C31 45 37 45 40 40" stroke="#5D4E43" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        ) : mood === 'breathing' ? (
          <ellipse cx="34" cy="41" rx="2.5" ry="2" fill="#5D4E43" opacity="0.5" />
        ) : (
          <path d="M29 40C32 43 36 43 39 40" stroke="#5D4E43" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        )}

        {/* Cheek blush */}
        <circle cx="21" cy="39" r="4" fill="#E8927C" opacity="0.2" />
        <circle cx="47" cy="38" r="4" fill="#E8927C" opacity="0.2" />

        {/* === Zzz (low energy only) === */}
        <text className="blob-buddy__zzz" x="50" y="18" fill="#B8A9D4" fontSize="10" fontWeight="600" fontFamily="var(--font-body)">
          z
        </text>
        <text className="blob-buddy__zzz" x="56" y="12" fill="#B8A9D4" fontSize="8" fontWeight="600" fontFamily="var(--font-body)" opacity="0.7">
          z
        </text>

        {/* === Thinking dots === */}
        <circle className="blob-buddy__dot blob-buddy__dot--1" cx="50" cy="18" r="2" fill="#B8A9D4" />
        <circle className="blob-buddy__dot blob-buddy__dot--2" cx="55" cy="13" r="2.5" fill="#B8A9D4" />
        <circle className="blob-buddy__dot blob-buddy__dot--3" cx="61" cy="9" r="3" fill="#B8A9D4" />
      </svg>
    </div>
  )
}
