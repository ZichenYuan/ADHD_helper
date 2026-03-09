import { useState } from 'react'

const FUEL_LEVELS = [
  { level: 1, label: 'Fried — survival mode', color: '#E8927C', gradient: ['#F2B5A5', '#E8927C'], glow: 'rgba(232, 146, 124, 0.25)' },
  { level: 2, label: 'Low battery', color: '#F5C8A8', gradient: ['#FAE0CC', '#E8B07A'], glow: 'rgba(245, 200, 168, 0.25)' },
  { level: 3, label: 'Stable — cruising', color: '#E8C86A', gradient: ['#F2DFA0', '#D4B44E'], glow: 'rgba(232, 200, 106, 0.25)' },
  { level: 4, label: 'Good energy', color: '#8DB48E', gradient: ['#B5D1B6', '#7AA37B'], glow: 'rgba(141, 180, 142, 0.25)' },
  { level: 5, label: 'On fire — let\'s go', color: '#6E9A6F', gradient: ['#8DB48E', '#5A845B'], glow: 'rgba(110, 154, 111, 0.3)' },
]

const PEBBLE_PATHS = [
  'M22 6C28 2 38 3 42 8C47 14 46 26 42 34C38 40 28 44 22 42C14 39 6 32 4 24C2 16 8 10 14 7C18 5 20 5 22 6Z',
  'M24 4C32 2 40 6 44 14C47 20 46 30 40 36C34 42 24 44 18 40C10 36 4 28 3 20C2 12 8 6 16 4C20 3 22 3 24 4Z',
  'M20 5C28 1 38 4 43 10C48 18 47 28 42 35C37 42 26 45 18 42C10 38 4 30 3 22C2 14 6 8 14 5C17 4 18 4 20 5Z',
  'M23 3C30 1 40 5 44 12C48 20 48 30 42 37C36 43 26 46 18 42C10 38 3 28 2 20C1 12 6 6 14 4C18 2 21 2 23 3Z',
  'M21 5C29 1 39 3 44 10C48 16 48 28 43 35C38 42 28 45 20 43C12 40 5 32 3 24C1 16 5 8 12 5C16 3 19 4 21 5Z',
]

const INACTIVE_COLOR = '#E8E2D8'

export default function FuelGauge({ value, onChange }) {
  const [hoveredLevel, setHoveredLevel] = useState(null)

  const displayLevel = hoveredLevel || value
  const activeDescription = displayLevel
    ? FUEL_LEVELS[displayLevel - 1].label
    : 'How are you feeling?'

  return (
    <div className="fuel-section">
      <span className="fuel-label">Energy Level</span>
      <div className="fuel-gauge" role="radiogroup" aria-label="Energy level selector">
        {FUEL_LEVELS.map((fuel, i) => {
          const isActive = value >= fuel.level
          const gradientId = `fuel-gradient-${fuel.level}`

          return (
            <button
              key={fuel.level}
              className={`fuel-pebble ${isActive ? 'fuel-pebble--active' : ''}`}
              onClick={() => onChange(fuel.level === value ? null : fuel.level)}
              onMouseEnter={() => setHoveredLevel(fuel.level)}
              onMouseLeave={() => setHoveredLevel(null)}
              role="radio"
              aria-checked={value === fuel.level}
              aria-label={`Energy level ${fuel.level}: ${fuel.label}`}
              style={{ '--glow-color': fuel.glow }}
            >
              <svg
                className="fuel-pebble__shape"
                width="52"
                height="52"
                viewBox="0 0 48 48"
                fill="none"
              >
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={fuel.gradient[0]} />
                    <stop offset="100%" stopColor={fuel.gradient[1]} />
                  </linearGradient>
                </defs>
                <path
                  d={PEBBLE_PATHS[i]}
                  fill={isActive ? `url(#${gradientId})` : INACTIVE_COLOR}
                  stroke={isActive ? 'rgba(255,255,255,0.3)' : 'rgba(74, 63, 54, 0.04)'}
                  strokeWidth="1"
                />
              </svg>
              <span className="fuel-pebble__number">{fuel.level}</span>
            </button>
          )
        })}
      </div>
      <p className="fuel-description" style={{
        color: displayLevel ? FUEL_LEVELS[displayLevel - 1].color : undefined
      }}>
        {activeDescription}
      </p>
    </div>
  )
}
