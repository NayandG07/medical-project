import { useEffect, useRef } from 'react'
import { parseMarkdown } from '@/lib/markdown'

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
  isTyping?: boolean
  error?: string | null
}

export default function ChatWindow({ messages, loading, isTyping, error }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div
      data-lenis-prevent
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px', // Standard padding
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        scrollBehavior: 'smooth'
      }}
    >
      {messages.length === 0 && !loading && !error && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60%',
          color: '#94a3b8',
          gap: '16px'
        }}>
          <div style={{
            fontSize: '48px',
            backgroundColor: 'white',
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9'
          }}>
            🩺
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#1e293b', fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>How can Vaidya help you?</h2>
            <p style={{ margin: 0, fontSize: '15px' }}>Ask me about medical concepts, clinical cases, or study summaries.</p>
          </div>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          style={{
            display: 'flex',
            gap: '16px',
            flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            maxWidth: '1000px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          {/* Avatar Icon */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
            backgroundColor: message.role === 'user' ? '#eef2ff' : '#ffffff',
            border: '1px solid',
            borderColor: message.role === 'user' ? '#e0e7ff' : '#f1f5f9',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            {message.role === 'user' ? '🩺' : '⚕️'}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxWidth: '80%',
            alignItems: message.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              backgroundColor: message.role === 'user' ? '#6366f1' : '#ffffff',
              color: message.role === 'user' ? '#ffffff' : '#334155',
              padding: '16px 20px',
              borderRadius: message.role === 'user' ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
              boxShadow: message.role === 'user' ? '0 4px 12px rgba(99, 102, 241, 0.2)' : '0 4px 12px rgba(0,0,0,0.03)',
              border: message.role === 'user' ? 'none' : '1px solid #f1f5f9',
              lineHeight: '1.6',
              fontSize: '15.5px'
            }}>
              <div
                className="prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
                style={{
                  color: message.role === 'user' ? 'white' : 'inherit'
                }}
              />
            </div>

            {/* Citations Chip Component (Placeholder for future) */}
            {message.citations && (
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '4px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  fontSize: '11px',
                  backgroundColor: '#f1f5f9',
                  padding: '4px 10px',
                  borderRadius: '100px',
                  color: '#64748b',
                  fontWeight: '600'
                }}>
                  Source Integrated
                </span>
              </div>
            )}

            <div style={{
              fontSize: '11px',
              color: '#94a3b8',
              fontWeight: '500',
              padding: '0 4px'
            }}>
              {formatTimestamp(message.created_at)}
              {message.tokens_used && ` • ${message.tokens_used} tokens`}
            </div>
          </div>
        </div>
      ))}

      {isTyping && (
        <div style={{
          display: 'flex',
          gap: '16px',
          maxWidth: '1000px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #f1f5f9'
          }}>
            ⚕️
          </div>
          <div style={{
            backgroundColor: '#ffffff',
            padding: '16px 24px',
            borderRadius: '4px 20px 20px 20px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#cbd5e1', borderRadius: '50%', animation: 'bounce 1s infinite 0.1s' }} />
            <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#cbd5e1', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }} />
            <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#cbd5e1', borderRadius: '50%', animation: 'bounce 1s infinite 0.3s' }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          maxWidth: '600px',
          margin: '20px auto',
          padding: '12px 20px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fee2e2',
          borderRadius: '12px',
          color: '#991b1b',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div ref={messagesEndRef} />

      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .typing-dot {
          display: inline-block;
        }
      `}</style>
    </div>
  )
}
