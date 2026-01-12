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
    isNewChat?: boolean
}

export default function ChatWindow({ messages, loading, isTyping, error, isNewChat }: ChatWindowProps) {
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
            className="chat-scroll-container"
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                scrollBehavior: 'smooth',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none'
            }}
        >
            {isNewChat && messages.length === 0 && !loading && !error && (
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
                        backgroundColor: '#F7F9FB',
                        width: '80px',
                        height: '80px',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.04)',
                        border: '1px solid #E9ECEF'
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
                    className={`message-row ${message.role === 'user' ? 'message-row-user' : 'message-row-assistant'}`}
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
                    <div className="avatar-container" style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 4px 12px -1px rgba(0, 0, 0, 0.08)',
                        marginTop: '4px',
                        color: message.role === 'user' ? '#4F46E5' : '#0D9488',
                        transition: 'transform 0.2s ease'
                    }}>
                        {message.role === 'user' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                                <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" fill="currentColor"></path>
                            </svg>
                        )}
                    </div>

                    <div className="message-content-wrapper" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxWidth: '78%',
                        alignItems: message.role === 'user' ? 'flex-end' : 'flex-start'
                    }}>
                        {/* Role Label - Hidden on mobile */}
                        <div className="role-label" style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: '4px',
                            marginLeft: message.role === 'user' ? '0' : '4px',
                            marginRight: message.role === 'user' ? '4px' : '0'
                        }}>
                            {message.role === 'user' ? 'You' : 'Vaidya AI'}
                        </div>
                        <div className={`message-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`} style={{
                            backgroundColor: message.role === 'user' ? '#4F46E5' : '#F7F3EB',
                            backgroundImage: message.role === 'user'
                                ? 'linear-gradient(135deg, #6366f1 0%, #3730a3 100%)'
                                : 'linear-gradient(135deg, #FDFBF7 0%, #E8EAEF 100%)',
                            color: message.role === 'user' ? '#ffffff' : '#1e293b',
                            padding: '12px 20px',
                            borderRadius: message.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                            boxShadow: message.role === 'user'
                                ? '0 10px 20px -8px rgba(79, 70, 229, 0.3)'
                                : '0 4px 12px -2px rgba(0, 0, 0, 0.04)',
                            border: message.role === 'user' ? 'none' : '1px solid #E2E8F0',
                            lineHeight: '1.6',
                            fontSize: '15px',
                            position: 'relative',
                            width: 'fit-content',
                            maxWidth: '100%'
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
                        backgroundColor: '#FDFCFB',
                        padding: '16px 24px',
                        borderRadius: '4px 20px 20px 20px',
                        border: '1px solid #E9ECEF',
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
                .chat-scroll-container::-webkit-scrollbar {
                    display: none;
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                .typing-dot {
                    display: inline-block;
                }
                .prose ul, .prose ol {
                    padding-left: 20px !important;
                    margin-left: 0 !important;
                    margin-bottom: 12px !important;
                }
                .prose li {
                    margin-bottom: 6px !important;
                }
                @media (max-width: 640px) {
                    .chat-scroll-container {
                        padding: 16px 20px !important;
                        gap: 32px !important;
                    }
                    .message-row {
                        flex-direction: column !important;
                        gap: 4px !important;
                    }
                    .message-row-user {
                        align-items: flex-end !important;
                    }
                    .message-row-assistant {
                        align-items: flex-start !important;
                    }
                    .message-content-wrapper {
                        max-width: 85% !important;
                    }
                    .avatar-container {
                        width: 32px !important;
                        height: 32px !important;
                        margin-bottom: 2px;
                        display: flex !important;
                    }
                    .role-label {
                        display: block !important;
                        font-size: 10px !important;
                    }
                    .user-bubble, .assistant-bubble {
                        padding: 12px 16px !important;
                        border-radius: 16px !important;
                        font-size: 14.5px !important;
                    }
                }
            `}</style>
        </div >
    )
}