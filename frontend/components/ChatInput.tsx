import { useState, FormEvent, KeyboardEvent, useRef, useEffect } from 'react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask anything medical...'
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [message])

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()

    const trimmedMessage = message.trim()
    if (!trimmedMessage || disabled) return

    onSendMessage(trimmedMessage)
    setMessage('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '24px',
      padding: '10px 10px 10px 24px',
      display: 'flex',
      alignItems: 'flex-end',
      boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
      border: '1px solid #e2e8f0',
      gap: '12px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
      cursor: 'text'
    }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#6366f1'
        e.currentTarget.style.boxShadow = '0 12px 40px -12px rgba(99, 102, 241, 0.15), 0 4px 12px -2px rgba(0,0,0,0.03)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#e2e8f0'
        e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)'
      }}
    >
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          padding: '12px 0',
          fontSize: '16px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
          lineHeight: '1.5',
          minHeight: '24px',
          backgroundColor: 'transparent',
          cursor: disabled ? 'not-allowed' : 'text',
          color: '#1e293b'
        }}
      />

      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={disabled || !message.trim()}
        style={{
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: disabled || !message.trim() ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
          color: disabled || !message.trim() ? '#94a3b8' : 'white',
          border: 'none',
          borderRadius: '16px',
          cursor: disabled || !message.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: disabled || !message.trim() ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          if (!disabled && message.trim()) {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)'
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && message.trim()) {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  )
}
