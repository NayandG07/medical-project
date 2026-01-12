import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
    loading?: boolean
    error?: string | null
    mobile?: boolean
}

export default function SessionSidebar({
    sessions,
    currentSessionId,
    onSelectSession,
    onNewSession,
    onDeleteSession,
    onDeleteAllSessions,
    loading = false,
    error = null,
    mobile = false
}: SessionSidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
    const [isClearingAll, setIsClearingAll] = useState(false)

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

    if (isCollapsed && !mobile) {
        return (
            <div style={{
                width: '64px',
                backgroundColor: '#F0F2F5', // Silvery
                borderLeft: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 0',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <button
                    onClick={() => setIsCollapsed(false)}
                    style={{
                        background: '#FDFBF7', // Creamy
                        border: '1px solid #D1D5DB',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        marginBottom: '20px',
                        color: '#475569'
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
                    style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '20px',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                    title="New Chat"
                >
                    +
                </button>
            </div>
        )
    }

    return (
        <div style={{
            width: mobile ? '100%' : '280px',
            height: '100%',
            backgroundColor: '#F0F2F5', // Silvery
            borderLeft: mobile ? 'none' : '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative'
        }}>
            {/* Header - Aligned for Right Sidebar */}
            <div style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                flexDirection: 'row', // [CHATS] ... [X]
                alignItems: 'center',
                borderBottom: '1px solid #E2E8F0'
            }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b', letterSpacing: '0.05em' }}>
                    CHATS
                </h3>
                {!mobile && (
                    <button
                        onClick={() => setIsCollapsed(true)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            color: '#475569',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Collapse sidebar"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <path d="M15 3v18" />
                            <path d="m8 9 3 3-3 3" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Top New Chat Button - Full Width */}
            <div style={{ padding: '20px 12px 10px 12px' }}>
                <button
                    onClick={onNewSession}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '14px',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        transition: 'all 0.2s ease'
                    }}
                    title="New Chat"
                >
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+</span>
                    New Chat
                </button>
            </div>

            {/* Sessions List */}
            <div
                data-lenis-prevent
                className="hide-scrollbar"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0 12px 10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none'
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
                            backgroundColor: currentSessionId === session.id ? '#FDFBF7' : (hoveredSessionId === session.id ? '#E2E8F0' : 'transparent'),
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            border: '1px solid',
                            borderColor: currentSessionId === session.id ? '#E2E8F0' : 'transparent',
                            boxShadow: currentSessionId === session.id ? '0 4px 12px rgba(0,0,0,0.03)' : 'none',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {currentSessionId === session.id && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '4px',
                                height: '24px',
                                backgroundColor: '#6366f1',
                                borderRadius: '4px 0 0 4px'
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

            {/* Bottom Clear All Button - Fixed at bottom via Flex layout */}
            <div style={{
                padding: '16px 12px 20px 12px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F0F2F5',
                width: '100%',
                zIndex: 10
            }}>
                <button
                    onClick={() => {
                        if (sessions.length === 0) {
                            toast.error("No conversations to delete", {
                                icon: '⚠️',
                                style: { borderRadius: '12px' }
                            })
                            return
                        }
                        setShowDeleteAllConfirm(true)
                    }}
                    style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: '#FEE2E2',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#FCA5A5'
                        e.currentTarget.style.color = '#7F1D1D'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#FEE2E2'
                        e.currentTarget.style.color = '#B91C1C'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete
                </button>
            </div>

            {/* Sonner Toaster is handled in the main page */}
            <style jsx global>{`
                /* Global scrollbar hiding for cleaner UI */
                /* Custom Slim Scrollbar for Sidebar */
                .hide-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .hide-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .hide-scrollbar::-webkit-scrollbar-thumb {
                    background: #CBD5E1;
                    border-radius: 4px;
                }
                .hide-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94A3B8;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>

            {/* Delete Confirmation Modal (Individual) */}
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
                    onClick={() => setDeleteConfirmationId(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '320px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #e2e8f0',
                            animation: 'fadeIn 0.2s ease-out'
                        }}
                    >
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                            Delete Chat?
                        </h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
                            This will permanently delete this chat session.
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
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (deleteConfirmationId) {
                                        setIsDeletingId(deleteConfirmationId)
                                        try {
                                            await onDeleteSession(deleteConfirmationId)
                                            setDeleteConfirmationId(null)
                                        } finally {
                                            setIsDeletingId(null)
                                        }
                                    }
                                }}
                                disabled={isDeletingId !== null}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: isDeletingId ? '#fca5a5' : '#ef4444',
                                    color: 'white',
                                    fontSize: '14px',
                                    cursor: isDeletingId ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isDeletingId && <Loader2 size={14} className="spin" />}
                                {isDeletingId ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete All Confirmation Modal */}
            {showDeleteAllConfirm && (
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
                    zIndex: 1001,
                    backdropFilter: 'blur(4px)'
                }}
                    onClick={() => setShowDeleteAllConfirm(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            width: '400px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center',
                            animation: 'fadeIn 0.25s ease-out'
                        }}
                    >
                        <div style={{
                            width: '64px',
                            height: '64px',
                            backgroundColor: '#fee2e2',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto',
                            color: '#ef4444'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                            </svg>
                        </div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                            Clear all history?
                        </h3>
                        <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748b', lineHeight: '1.6' }}>
                            This will permanently delete all your conversation history data. This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setShowDeleteAllConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: 'white',
                                    color: '#64748b',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setIsClearingAll(true)
                                    try {
                                        await onDeleteAllSessions?.()
                                        setShowDeleteAllConfirm(false)
                                    } finally {
                                        setIsClearingAll(false)
                                    }
                                }}
                                disabled={isClearingAll}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: isClearingAll ? '#fca5a5' : '#ef4444',
                                    color: 'white',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    cursor: isClearingAll ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => !isClearingAll && (e.currentTarget.style.backgroundColor = '#dc2626')}
                                onMouseLeave={(e) => !isClearingAll && (e.currentTarget.style.backgroundColor = '#ef4444')}
                            >
                                {isClearingAll && <Loader2 size={16} className="spin" />}
                                {isClearingAll ? 'Deleting...' : 'Clear All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
