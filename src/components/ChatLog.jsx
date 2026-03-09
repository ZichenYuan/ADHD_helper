import { useEffect, useRef } from 'react'

export default function ChatLog({ messages, isActive }) {
  const scrollRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages])

  return (
    <div className="chat-log-section">
      <div className="chat-log" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-log__empty">
            {isActive ? (
              <>
                <span className="chat-log__empty-dot" />
                <span className="chat-log__empty-text">Waiting for you to speak...</span>
              </>
            ) : (
              <span className="chat-log__empty-text">Your conversation will appear here</span>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble chat-bubble--${msg.role} ${msg.interrupted ? 'chat-bubble--interrupted' : ''} ${msg.live ? 'chat-bubble--live' : ''}`}
            style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
          >
            <span className="chat-bubble__role">
              {msg.role === 'user' ? 'You' : 'Brain Dump'}
            </span>
            <p className="chat-bubble__text">
              {msg.text}
              {msg.live && <span className="chat-bubble__cursor" />}
            </p>
            {msg.interrupted && (
              <span className="chat-bubble__interrupted-tag">interrupted</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
