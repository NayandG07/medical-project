import { useState, useEffect } from 'react'
import { Menu, X, ChevronLeft, ChevronRight, MessageSquare, Trash2, Plus } from 'lucide-react'

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
  onDeleteAllSessions?: () => void
  isNewChatDisabled?: boolean
  loading?: boolean
  error?: string | null
  position?: 'left' | 'right'
  newSessionLabel?: string
  untitledLabel?: string
  isCollapsed?: boolean
  onToggleCollapsed?: (collapsed: boolean) => void
}

export default function SessionSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onDeleteAllSessions,
  isNewChatDisabled = false,
  loading = false,
  error = null,
  position = 'left',
  newSessionLabel = 'New Chat',
  untitledLabel = 'Untitled Chat',
  isCollapsed: propIsCollapsed,
  onToggleCollapsed
}: SessionSidebarProps) {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isCollapsed = propIsCollapsed ?? internalIsCollapsed

  const setIsCollapsed = (val: boolean) => {
    if (onToggleCollapsed) {
      onToggleCollapsed(val)
    } else {
      setInternalIsCollapsed(val)
    }
  }

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
  const [deleteAllConfirmation, setDeleteAllConfirmation] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Mobile Hamburger Trigger (Attached to Left as requested)
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsMobileOpen(true)}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 40,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            color: '#1e293b'
          }}
        >
          <Menu size={20} />
        </button>

        {isMobileOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setIsMobileOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 50,
              backdropFilter: 'blur(4px)'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="mobile-sidebar"
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: '80%',
                maxWidth: '300px',
                background: 'white',
                zIndex: 51,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>History</h3>
                <button onClick={() => setIsMobileOpen(false)} style={{ background: 'none', border: 'none', padding: '4px' }}>
                  <X size={24} color="#64748b" />
                </button>
              </div>

              <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                <button
                  onClick={() => { onNewSession(); setIsMobileOpen(false); }}
                  disabled={isNewChatDisabled}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: '700',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <Plus size={20} /> {newSessionLabel}
                </button>

                <div className="session-list">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => { onSelectSession(session.id); setIsMobileOpen(false); }}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        marginBottom: '8px',
                        background: currentSessionId === session.id ? '#f8fafc' : 'transparent',
                        border: currentSessionId === session.id ? '1px solid #e2e8f0' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: currentSessionId === session.id ? '700' : '500', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title || untitledLabel}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{formatDate(session.updated_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <style jsx>{`
              @keyframes slideIn {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
              }
            `}</style>
          </div>
        )}
      </>
    )
  }

  // Desktop Collapsed State
  if (isCollapsed) {
    return (
      <div style={{
        width: '70px',
        backgroundColor: '#fdfbf7',
        borderLeft: position === 'right' ? '1px solid rgba(0,0,0,0.06)' : 'none',
        borderRight: position === 'left' ? '1px solid rgba(0,0,0,0.06)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 0',
        transition: 'all 0.3s ease',
        height: '100%',
        zIndex: 20
      }}>
        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            background: 'white',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '12px',
            cursor: 'pointer',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            marginBottom: '24px',
            transition: 'all 0.2s'
          }}
        >
          {position === 'right' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
        <button
          onClick={onNewSession}
          disabled={isNewChatDisabled}
          style={{
            background: isNewChatDisabled ? '#e2e8f0' : '#3b82f6',
            border: 'none',
            borderRadius: '12px',
            cursor: isNewChatDisabled ? 'not-allowed' : 'pointer',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: isNewChatDisabled ? 'none' : '0 8px 20px -4px rgba(59, 130, 246, 0.4)'
          }}
          title="New Chat"
        >
          <Plus size={24} />
        </button>
      </div>
    )
  }

  // Desktop Expanded State
  return (
    <div style={{
      width: '320px',
      backgroundColor: '#fdfbf7', // Matches chat bg slightly
      borderLeft: position === 'right' ? '1px solid rgba(0,0,0,0.06)' : 'none',
      borderRight: position === 'left' ? '1px solid rgba(0,0,0,0.06)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      zIndex: 20
    }}>
      {/* Header */}
      <div style={{
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1E293B', letterSpacing: '-0.02em' }}>
          History
        </h3>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            transition: 'all 0.2s'
          }}
        >
          {position === 'right' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* New Session Button */}
      <div style={{ padding: '0 20px 24px' }}>
        <button
          onClick={onNewSession}
          disabled={loading || isNewChatDisabled}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '14px',
            fontWeight: '700',
            background: isNewChatDisabled ? '#e2e8f0' : '#3b82f6',
            color: isNewChatDisabled ? '#94a3b8' : '#ffffff',
            border: 'none',
            borderRadius: '14px',
            cursor: loading || isNewChatDisabled ? 'not-allowed' : 'pointer',
            boxShadow: isNewChatDisabled ? 'none' : '0 10px 25px -5px rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
        >
          <Plus size={20} />
          <span>{newSessionLabel}</span>
        </button>
      </div>

      {/* Sessions List */}
      <div
        data-lenis-prevent
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
        className="custom-scrollbar"
      >
        {error && (
          <div style={{
            padding: '12px',
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
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Loading history...
          </div>
        )}

        {!loading && (!Array.isArray(sessions) || sessions.length === 0) && !error && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            No sessions yet
          </div>
        )}

        {Array.isArray(sessions) && sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            onMouseEnter={() => setHoveredSessionId(session.id)}
            onMouseLeave={() => setHoveredSessionId(null)}
            style={{
              padding: '14px 16px',
              backgroundColor: currentSessionId === session.id ? '#ffffff' : (hoveredSessionId === session.id ? 'rgba(0,0,0,0.03)' : 'transparent'),
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              border: currentSessionId === session.id ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
              boxShadow: currentSessionId === session.id ? '0 4px 12px rgba(0,0,0,0.03)' : 'none',
              position: 'relative'
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: currentSessionId === session.id ? '700' : '500',
                color: currentSessionId === session.id ? '#1e293b' : '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {session.title || untitledLabel}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', fontWeight: '500' }}>
                {formatDate(session.updated_at)}
              </div>
            </div>

            {(hoveredSessionId === session.id || currentSessionId === session.id) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirmationId(session.id)
                }}
                className="delete-btn"
                style={{
                  background: 'white',
                  border: '1px solid rgba(0,0,0,0.06)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 1
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer - Delete All Button */}
      <div style={{
        padding: '20px',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        backgroundColor: '#fdfbf7'
      }}>
        <button
          onClick={() => setDeleteAllConfirmation(true)}
          disabled={!sessions || sessions.length === 0}
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            color: '#ef4444',
            fontSize: '13px',
            fontWeight: '700',
            cursor: (!sessions || sessions.length === 0) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: (!sessions || sessions.length === 0) ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (sessions && sessions.length > 0) {
              e.currentTarget.style.backgroundColor = '#fef2f2'
              e.currentTarget.style.borderColor = '#ef4444'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'
          }}
        >
          <Trash2 size={16} />
          Delete All Chats
        </button>
      </div>

      {/* Delete Single Confirmation Modal */}
      {deleteConfirmationId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
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
              borderRadius: '20px',
              padding: '24px',
              width: '320px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Delete Chat?</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>Permanently remove this conversation?</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmationId(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { if (deleteConfirmationId) onDeleteSession(deleteConfirmationId); setDeleteConfirmationId(null); }}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: '700', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete ALL Confirmation Modal */}
      {deleteAllConfirmation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          backdropFilter: 'blur(4px)'
        }}
          onClick={(e) => {
            e.stopPropagation()
            setDeleteAllConfirmation(false)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '32px',
              width: '380px',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              background: '#fef2f2',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#ef4444'
            }}>
              <Trash2 size={32} />
            </div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>Delete All Chats?</h3>
            <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748b', lineHeight: '1.5' }}>
              This action cannot be undone. All your chat history will be permanently erased.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  if (onDeleteAllSessions) onDeleteAllSessions();
                  setDeleteAllConfirmation(false);
                }}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '14px',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '15px'
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setDeleteAllConfirmation(false)}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  fontWeight: '700',
                  cursor: 'pointer',
                  color: '#1e293b',
                  fontSize: '15px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}
