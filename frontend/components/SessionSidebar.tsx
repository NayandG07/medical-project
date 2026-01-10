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
  onDeleteSession: (sessionId: string) => void
  isNewChatDisabled?: boolean
  loading?: boolean
  error?: string | null
}

export default function SessionSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isNewChatDisabled = false,
  loading = false,
  error = null
}: SessionSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)

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
      return `${diffDays}d ago`
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
        width: '64px',
        backgroundColor: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            cursor: 'pointer',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            marginBottom: '20px'
          }}
          title="Expand sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <button
          onClick={onNewSession}
          disabled={isNewChatDisabled}
          style={{
            background: isNewChatDisabled ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
            border: 'none',
            borderRadius: '10px',
            cursor: isNewChatDisabled ? 'not-allowed' : 'pointer',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isNewChatDisabled ? '#94a3b8' : 'white',
            fontSize: '20px',
            boxShadow: isNewChatDisabled ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}
          title={isNewChatDisabled ? "Start current chat first" : "New Chat"}
        >
          +
        </button>
      </div>
    )
  }

  return (
    <div style={{
      width: '280px',
      backgroundColor: '#f8fafc',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.02em' }}>
          CHATS
        </h3>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#64748b',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Collapse sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            <path d="m14 9-3 3 3 3" />
          </svg>
        </button>
      </div>

      {/* New Session Button */}
      <div style={{ padding: '0 12px 20px 12px' }}>
        <button
          onClick={onNewSession}
          disabled={loading || isNewChatDisabled}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            background: isNewChatDisabled ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
            color: isNewChatDisabled ? '#94a3b8' : '#ffffff',
            border: 'none',
            borderRadius: '12px',
            cursor: loading || isNewChatDisabled ? 'not-allowed' : 'pointer',
            boxShadow: isNewChatDisabled ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!loading && !isNewChatDisabled) {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.3)'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && !isNewChatDisabled) {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.2)'
            }
          }}
          title={isNewChatDisabled ? "Start conversation in current chat to create new one" : "New Chat"}
        >
          <span style={{ fontSize: '18px' }}>+</span>
          New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div
        data-lenis-prevent
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px 20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {error && (
          <div style={{
            padding: '12px',
            margin: '8px 0',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            borderRadius: '10px',
            fontSize: '13px',
            border: '1px solid #fee2e2'
          }}>
            {error}
          </div>
        )}

        {loading && (!Array.isArray(sessions) || sessions.length === 0) && (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '13px'
          }}>
            Loading history...
          </div>
        )}

        {!loading && (!Array.isArray(sessions) || sessions.length === 0) && !error && (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '13px'
          }}>
            No chats yet
          </div>
        )}

        {Array.isArray(sessions) && sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            onMouseEnter={() => setHoveredSessionId(session.id)}
            onMouseLeave={() => setHoveredSessionId(null)}
            style={{
              padding: '12px 16px',
              backgroundColor: currentSessionId === session.id ? '#ffffff' : (hoveredSessionId === session.id ? '#f1f5f9' : 'transparent'),
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              border: '1px solid',
              borderColor: currentSessionId === session.id ? '#e2e8f0' : 'transparent',
              boxShadow: currentSessionId === session.id ? '0 4px 12px rgba(0,0,0,0.03)' : 'none',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {currentSessionId === session.id && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '4px',
                height: '16px',
                backgroundColor: '#6366f1',
                borderRadius: '0 4px 4px 0'
              }} />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: currentSessionId === session.id ? '600' : '500',
                color: currentSessionId === session.id ? '#1e293b' : '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {session.title || 'Untitled Chat'}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#94a3b8',
                fontWeight: '500',
                marginTop: '2px'
              }}>
                {formatDate(session.updated_at)}
              </div>
            </div>

            {/* Delete Button - Only show on hover or active */}
            {(hoveredSessionId === session.id || currentSessionId === session.id) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirmationId(session.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fef2f2'
                  e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.opacity = '0.8'
                }}
                title="Delete chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}
          onClick={(e) => {
            e.stopPropagation()
            setDeleteConfirmationId(null)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '320px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
              Delete Chat?
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
              This will permanently delete this chat session and all its messages. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmationId(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmationId) onDeleteSession(deleteConfirmationId)
                  setDeleteConfirmationId(null)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )
      }
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div >
  )
}
