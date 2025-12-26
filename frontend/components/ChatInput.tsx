import { useState, FormEvent, KeyboardEvent } from 'react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({ 
  onSendMessage, 
  disabled = false,
  placeholder = 'Type your message or use /flashcard, /mcq, /explain...'
}: ChatInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    const trimmedMessage = message.trim()
    if (!trimmedMessage || disabled) return

    onSendMessage(trimmedMessage)
    setMessage('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <form 
      onSubmit={handleSubmit}
      style={{
        padding: '15px 20px',
        borderTop: '1px solid #dee2e6',
        backgroundColor: '#ffffff',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end'
      }}
    >
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          padding: '10px 12px',
          fontSize: '15px',
          border: '1px solid #ced4da',
          borderRadius: '8px',
          resize: 'none',
          fontFamily: 'inherit',
          lineHeight: '1.5',
          minHeight: '44px',
          maxHeight: '120px',
          overflowY: 'auto',
          backgroundColor: disabled ? '#e9ecef' : '#ffffff',
          cursor: disabled ? 'not-allowed' : 'text'
        }}
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        style={{
          padding: '10px 20px',
          fontSize: '15px',
          fontWeight: '600',
          backgroundColor: disabled || !message.trim() ? '#6c757d' : '#007bff',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: disabled || !message.trim() ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          minWidth: '80px',
          height: '44px'
        }}
        onMouseEnter={(e) => {
          if (!disabled && message.trim()) {
            e.currentTarget.style.backgroundColor = '#0056b3'
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && message.trim()) {
            e.currentTarget.style.backgroundColor = '#007bff'
          }
        }}
      >
        Send
      </button>
    </form>
  )
}
