import { useState } from 'react'

export interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface SessionSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  loading?: boolean
  error?: string | null
}

export default function SessionSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  loading = false,
  error = null
}: SessionSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  if (isCollapsed) {
    return (
      <div style={{
        width: '50px',
        borderRight: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0'
      }}>
        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '10px'
          }}
          title="Expand sidebar"
        >
          ☰
        </button>
      </div>
    )
  }

  return (
    <div style={{
      width: '280px',
      borderRight: '1px solid #dee2e6',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Chat Sessions
        </h3>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '5px'
          }}
          title="Collapse sidebar"
        >
          ‹
        </button>
      </div>

      {/* New Session Button */}
      <div style={{ padding: '15px' }}>
        <button
          onClick={onNewSession}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: '#007bff',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          + New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 10px'
      }}>
        {error && (
          <div style={{
            padding: '10px',
            margin: '10px 0',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '6px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {loading && sessions.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '14px'
          }}>
            Loading sessions...
          </div>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '14px'
          }}>
            No sessions yet. Start a new chat!
          </div>
        )}

        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            style={{
              padding: '12px',
              marginBottom: '8px',
              backgroundColor: currentSessionId === session.id ? '#e7f3ff' : '#ffffff',
              border: currentSessionId === session.id ? '2px solid #007bff' : '1px solid #dee2e6',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (currentSessionId !== session.id) {
                e.currentTarget.style.backgroundColor = '#f1f3f5'
              }
            }}
            onMouseLeave={(e) => {
              if (currentSessionId !== session.id) {
                e.currentTarget.style.backgroundColor = '#ffffff'
              }
            }}
          >
            <div style={{
              fontSize: '14px',
              fontWeight: currentSessionId === session.id ? '600' : '500',
              color: '#212529',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {session.title || 'Untitled Chat'}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6c757d'
            }}>
              {formatDate(session.updated_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
