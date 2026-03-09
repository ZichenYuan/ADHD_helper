export default function PulseButton({ isActive, isListening, onToggle, statusText }) {
  return (
    <div className="pulse-section">
      <div className="pulse-wrapper">
        <div className="pulse-orbit pulse-orbit--1">
          <div className="pulse-orbit-dot" />
        </div>
        <div className="pulse-orbit pulse-orbit--2">
          <div className="pulse-orbit-dot" />
        </div>
        <div className="pulse-orbit pulse-orbit--3">
          <div className="pulse-orbit-dot" />
        </div>

        <div className={`pulse-glow ${isActive ? 'pulse-glow--active' : ''}`} />
        <div className={`pulse-ring ${isListening ? 'pulse-ring--active' : ''}`} />

        <button
          className={`pulse-button ${isActive ? 'pulse-button--active' : ''}`}
          onClick={onToggle}
          aria-label={isActive ? 'Stop voice session' : 'Start voice session'}
        >
          <div className="pulse-icon">
            {isActive && isListening ? (
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect x="6" y="13" width="3.5" height="10" rx="1.75" fill="rgba(255,255,255,0.9)">
                  <animate attributeName="height" values="10;18;10" dur="1.2s" repeatCount="indefinite" begin="0s" />
                  <animate attributeName="y" values="13;9;13" dur="1.2s" repeatCount="indefinite" begin="0s" />
                </rect>
                <rect x="12.5" y="10" width="3.5" height="16" rx="1.75" fill="rgba(255,255,255,0.9)">
                  <animate attributeName="height" values="16;8;16" dur="1.2s" repeatCount="indefinite" begin="0.15s" />
                  <animate attributeName="y" values="10;14;10" dur="1.2s" repeatCount="indefinite" begin="0.15s" />
                </rect>
                <rect x="19" y="8" width="3.5" height="20" rx="1.75" fill="rgba(255,255,255,0.9)">
                  <animate attributeName="height" values="20;12;20" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
                  <animate attributeName="y" values="8;12;8" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
                </rect>
                <rect x="25.5" y="11" width="3.5" height="14" rx="1.75" fill="rgba(255,255,255,0.9)">
                  <animate attributeName="height" values="14;20;14" dur="1.2s" repeatCount="indefinite" begin="0.45s" />
                  <animate attributeName="y" values="11;8;11" dur="1.2s" repeatCount="indefinite" begin="0.45s" />
                </rect>
              </svg>
            ) : isActive ? (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" fill="none" />
                <path d="M16 6 A10 10 0 0 1 26 16" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" fill="none">
                  <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="1s" repeatCount="indefinite" />
                </path>
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <defs>
                  <linearGradient id="micGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E8927C" />
                    <stop offset="100%" stopColor="#B8A9D4" />
                  </linearGradient>
                </defs>
                <rect x="12" y="4" width="10" height="17" rx="5" fill="url(#micGrad)" opacity="0.6" />
                <path d="M8 17C8 21.9706 12.0294 26 17 26C21.9706 26 26 21.9706 26 17" stroke="url(#micGrad)" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
                <line x1="17" y1="26" x2="17" y2="30" stroke="url(#micGrad)" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
                <line x1="13" y1="30" x2="21" y2="30" stroke="url(#micGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Unified status label — replaces the old separate status bar */}
      <div className="pulse-status">
        {isActive && <span className="pulse-status__dot" />}
        <span className={`pulse-status__text ${isActive ? 'pulse-status__text--active' : ''}`}>
          {statusText}
        </span>
      </div>
    </div>
  )
}
