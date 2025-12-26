import { useEffect, useRef } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  tokens_used?: number
  citations?: any
}

interface ChatWindowProps {
  messages: Message[]
  loading?: boolean
  error?: string | null
}

export default function ChatWindow({ messages, loading, error }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSenderLabel = (role: string) => {
    switch (role) {
      case 'user':
        return 'You'
      case 'assistant':
        return 'AI Assistant'
      case 'system':
        return 'System'
      default:
        return role
    }
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      {messages.length === 0 && !loading && !error && (
        <div style={{
          textAlign: 'center',
          color: '#6c757d',
          marginTop: '50px'
        }}>
          <p>No messages yet. Start a conversation!</p>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          data-testid={`message-${message.id}`}
          data-role={message.role}
          data-timestamp={message.created_at}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '70%',
            minWidth: '200px'
          }}
        >
          <div style={{
            backgroundColor: message.role === 'user' ? '#007bff' : '#ffffff',
            color: message.role === 'user' ? '#ffffff' : '#212529',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            wordWrap: 'break-word'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '6px',
              opacity: 0.8
            }}>
              {getSenderLabel(message.role)}
            </div>
            <div style={{
              fontSize: '15px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {message.content}
            </div>
            {message.citations && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                opacity: 0.7,
                fontStyle: 'italic'
              }}>
                Citations: {JSON.stringify(message.citations)}
              </div>
            )}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#6c757d',
            marginTop: '4px',
            marginLeft: message.role === 'user' ? 'auto' : '0',
            marginRight: message.role === 'user' ? '0' : 'auto'
          }}>
            {formatTimestamp(message.created_at)}
            {message.tokens_used && ` • ${message.tokens_used} tokens`}
          </div>
        </div>
      ))}

      {loading && (
        <div style={{
          alignSelf: 'flex-start',
          maxWidth: '70%',
          backgroundColor: '#ffffff',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '6px',
            opacity: 0.8
          }}>
            AI Assistant
          </div>
          <div style={{ fontSize: '15px', color: '#6c757d' }}>
            Thinking...
          </div>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
