import Head from 'next/head'
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ChatWindow, { Message } from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import SessionSidebar, { ChatSession } from '@/components/SessionSidebar'
import { PanelLeftOpen, X, FileText, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'

export default function Chat() {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [messagesLoading, setMessagesLoading] = useState(false)
    const [sendingMessage, setSendingMessage] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [sessionsLoading, setSessionsLoading] = useState(false)
    const [sessionsError, setSessionsError] = useState<string | null>(null)

    // Mobile sidebar toggle state
    const [showMobileSidebar, setShowMobileSidebar] = useState(false)
    const [mounted, setMounted] = useState(false)

    // Document context from URL
    const [documentContext, setDocumentContext] = useState<{ docId: string, filename: string } | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    // Helper function to get auth token
    const getAuthToken = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token || null
    }, [])

    // Load messages for a session
    const loadMessages = useCallback(async (sessionId: string, token?: string) => {
        try {
            setMessagesLoading(true)
            setError(null)

            const authToken = token || await getAuthToken()
            if (!authToken) {
                throw new Error('No authentication token available')
            }

            const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to load messages')
            }

            const data = await response.json()
            setMessages(data)
        } catch (err) {
            console.error('Failed to load messages:', err)
            setError(err instanceof Error ? err.message : 'Failed to load messages')
        } finally {
            setMessagesLoading(false)
        }
    }, [API_URL, getAuthToken])

    // Select a session and load its messages
    const selectSession = useCallback(async (sessionId: string, token?: string) => {
        setCurrentSessionId(sessionId)
        setSendingMessage(false) // Stop any active typing indicators
        setError(null)
        await loadMessages(sessionId, token)
        // Close mobile sidebar when selecting a session
        setShowMobileSidebar(false)
    }, [loadMessages])

    // Load sessions from backend (only called on initial mount/auth)
    const loadSessions = useCallback(async (token?: string) => {
        try {
            setSessionsLoading(true)
            setSessionsError(null)

            const authToken = token || await getAuthToken()
            if (!authToken) {
                throw new Error('No authentication token available')
            }

            const response = await fetch(`${API_URL}/api/chat/sessions`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to load sessions')
            }

            const data = await response.json()
            setSessions(data)
        } catch (err) {
            console.error('Failed to load sessions:', err)
            setSessionsError(err instanceof Error ? err.message : 'Failed to load sessions')
        } finally {
            setSessionsLoading(false)
        }
    }, [API_URL, getAuthToken])

    useEffect(() => {
        // Check authentication status
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                // Not authenticated, redirect to login
                router.push('/')
                return
            }

            setUser(session.user as AuthUser)
            setLoading(false)

            // Load sessions after authentication
            await loadSessions(session.access_token)
        }

        checkAuth()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.push('/')
            } else {
                setUser(session.user as AuthUser)
                loadSessions(session.access_token)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [router, loadSessions])

    // Extract document context from URL
    useEffect(() => {
        const { docId, filename } = router.query
        if (docId && typeof docId === 'string') {
            setDocumentContext({
                docId,
                filename: (typeof filename === 'string' ? filename : 'Unknown Document')
            })
        } else {
            setDocumentContext(null)
        }
    }, [router.query])

    const handleDeleteSession = async (sessionId: string) => {
        try {
            const authToken = await getAuthToken()
            if (!authToken) throw new Error('No authentication token available')

            const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })

            if (!response.ok) throw new Error('Failed to delete session')

            // Remove from state
            setSessions(prev => prev.filter(s => s.id !== sessionId))

            // If current session deleted, clear to new chat
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null)
                setMessages([])
                setSendingMessage(false)
                setError(null)
            }
        } catch (err) {
            console.error('Failed to delete session:', err)
            setError('Failed to delete session')
        }
    }

    const handleNewSession = () => {
        // Simply clear the current state to show fresh chat
        // Don't create a backend session until first message is sent
        setCurrentSessionId(null)
        setMessages([])
        setSendingMessage(false)
        setError(null)
        setShowMobileSidebar(false)
    }

    const handleSelectSession = async (sessionId: string) => {
        await selectSession(sessionId)
    }

    const handleClearAllSessions = async () => {
        try {
            const authToken = await getAuthToken()
            if (!authToken) throw new Error('No authentication token available')

            // Delete each session
            for (const session of sessions) {
                await fetch(`${API_URL}/api/chat/sessions/${session.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                })
            }

            setSessions([])
            setCurrentSessionId(null)
            setMessages([])
            setSendingMessage(false)
            setError(null)
        } catch (err) {
            console.error('Failed to clear sessions:', err)
            setError('Failed to clear all sessions')
        }
    }

    const handleSendMessage = async (content: string) => {
        if (!content || !content.trim()) return

        try {
            setSendingMessage(true)
            setError(null)

            const authToken = await getAuthToken()
            if (!authToken) {
                throw new Error('No authentication token available')
            }

            let activeSessionId = currentSessionId

            // If no session is selected, create one automatically
            if (!activeSessionId) {
                const createResponse = await fetch(`${API_URL}/api/chat/sessions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: content.slice(0, 30) || 'New Chat'
                    })
                })

                if (!createResponse.ok) {
                    throw new Error('Failed to create new session')
                }

                const newSession = await createResponse.json()
                activeSessionId = newSession.id

                // Add to list and update ID immediately
                setSessions(prev => [newSession, ...prev])
                setCurrentSessionId(activeSessionId)
            }

            // Add user message to UI immediately
            const tempUserMessage: Message = {
                id: `temp-${Date.now()}`,
                role: 'user',
                content,
                created_at: new Date().toISOString()
            }
            setMessages(prev => [...prev, tempUserMessage])

            // Advanced Regex-based Check for all greeting/farewell variations (slang, elongation, misspellings)
            const createFlexibleRegex = (phrase: string) => {
                // Escape special characters and allow character repetition (e.g., "h+e+l+l+o+")
                const pattern = phrase.split('').map(char => {
                    if (char === ' ') return '\\s+'; // Flexible spaces
                    if (/[a-zA-Z]/.test(char)) return `${char}+`; // Allow repetition for letters
                    return `\\${char}`; // Escape others
                }).join('');
                return new RegExp(`^${pattern}`, 'i'); // Case insensitive, start of string
            };

            const greetingPhrases = [
                'hi', 'hello', 'helo', 'hey', 'hola', 'namste', 'namaste',
                'yo', 'sup', 'gm', 'good morning', 'good afternoon', 'good evening',
                'hey there', 'whats up', 'wazzup'
            ];

            const farewellPhrases = [
                'bye', 'goodbye', 'see you', 'cya', 'talk later',
                'goodnight', 'good night', 'gn', 'take care', 'tata'
            ];

            const matchInContent = (phrases: string[], text: string) => {
                // Normalize text: remove special chars (except space), trim
                const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '').trim();
                return phrases.some(phrase => {
                    const regex = createFlexibleRegex(phrase);
                    // Match if specific regex matches start of text (e.g., "yoo" matches "yooo")
                    // OR if the text contains the specific phrase as a word
                    return regex.test(cleanText) || cleanText.includes(phrase);
                });
            };

            const isGreeting = matchInContent(greetingPhrases, content);
            const isFarewell = matchInContent(farewellPhrases, content);

            if (isGreeting || isFarewell) {
                let responseContent = "";

                if (isGreeting) {
                    const responses = [
                        "Hello! I'm Vaidya AI. Ready to master some medical concepts?",
                        "Hi there! What topic shall we dive into today?",
                        "Namaste! I'm here to support your medical studies. How can I help?",
                        "Hey! I'm all set to help you with clinical cases or summaries. What's on your mind?"
                    ];
                    responseContent = responses[Math.floor(Math.random() * responses.length)];
                } else {
                    const responses = [
                        "Goodbye! Wish you productive studies ahead.",
                        "See you later! Feel free to return whenever you need a quick revision.",
                        "Bye! Take care and keep up the great work.",
                        "Good luck! I'll be here when you have more questions."
                    ];
                    responseContent = responses[Math.floor(Math.random() * responses.length)];
                }

                // Simulate a small delay for natural feeling
                setTimeout(() => {
                    const aiAutoResponse: Message = {
                        id: `auto-${Date.now()}`,
                        role: 'assistant',
                        content: responseContent,
                        created_at: new Date().toISOString()
                    };
                    setMessages(prev => [...prev, aiAutoResponse]);
                    setSendingMessage(false);
                }, 700);

                // Note: We intentionally DO NOT send this to the backend here to ensure 0 API key usage.
                // These conversational fillers stay local for the session.
                return;
            }

            // Normal AI Message flow for everything else (using API)
            const response = await fetch(`${API_URL}/api/chat/sessions/${activeSessionId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: content,
                    role: 'user',
                    document_id: documentContext?.docId || null
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || 'Failed to send message')
            }

            const aiResponse = await response.json()

            // Update messages: append the AI response
            setMessages(prev => [...prev, aiResponse])

        } catch (err) {
            console.error('Failed to send message:', err)
            setError(err instanceof Error ? err.message : 'Failed to send message')

            // Remove the temporary message on error
            setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
        } finally {
            setSendingMessage(false)
        }
    }

    return (
        <>
            <Head>
                <title>Chat - Vaidya AI</title>
            </Head>
            <Toaster position="top-right" richColors closeButton />
            <DashboardLayout user={user} loading={loading}>
                {/* Full Page Chat Container */}
                <div className="chat-page-container">
                    {/* Mobile Sidebar Toggle - Top Left Below Navbar */}
                    <button
                        className="mobile-sidebar-toggle"
                        onClick={() => setShowMobileSidebar(true)}
                        aria-label="Open chat history"
                    >
                        <PanelLeftOpen size={22} strokeWidth={2} />
                    </button>

                    {/* Main Chat Area */}
                    <div className="chat-main-area">
                        <ChatWindow
                            messages={messages}
                            loading={messagesLoading}
                            isTyping={sendingMessage}
                            error={error}
                            isNewChat={!currentSessionId}
                        />

                        {/* Input Area - Fixed at bottom */}
                        <div className="chat-input-area">
                            {documentContext && (
                                <div className="document-context-banner">
                                    <div className="context-icon">
                                        <FileText size={16} />
                                    </div>
                                    <div className="context-info">
                                        <span className="context-label">Discussing Document:</span>
                                        <span className="context-filename">{documentContext.filename}</span>
                                    </div>
                                    <button
                                        className="clear-context-btn"
                                        onClick={() => {
                                            router.push('/chat')
                                            setDocumentContext(null)
                                        }}
                                        title="Clear document context"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                            <div className="chat-input-wrapper">
                                <ChatInput
                                    onSendMessage={handleSendMessage}
                                    disabled={sendingMessage}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Session Sidebar - Desktop (always visible) */}
                    <div className="desktop-sidebar">
                        <SessionSidebar
                            sessions={sessions}
                            currentSessionId={currentSessionId}
                            onSelectSession={handleSelectSession}
                            onNewSession={handleNewSession}
                            onDeleteSession={handleDeleteSession}
                            onDeleteAllSessions={handleClearAllSessions}
                            loading={sessionsLoading}
                            error={sessionsError}
                        />
                    </div>

                    {/* Mobile Sidebar Overlay - Slides from LEFT */}
                    {mounted && createPortal(
                        <AnimatePresence>
                            {showMobileSidebar && (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="mobile-sidebar-backdrop"
                                        onClick={() => setShowMobileSidebar(false)}
                                        style={{
                                            position: 'fixed',
                                            inset: 0,
                                            background: 'rgba(15, 23, 42, 0.6)',
                                            backdropFilter: 'blur(12px)',
                                            WebkitBackdropFilter: 'blur(12px)',
                                            zIndex: 998
                                        }}
                                    />
                                    <motion.div
                                        initial={{ x: '-100%' }}
                                        animate={{ x: 0 }}
                                        exit={{ x: '-100%' }}
                                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                        className="mobile-sidebar-panel"
                                        style={{
                                            position: 'fixed',
                                            top: 0,
                                            left: 0,
                                            right: 'auto',
                                            bottom: 0,
                                            width: '320px',
                                            maxWidth: '85vw',
                                            background: '#FAFAFA',
                                            zIndex: 999,
                                            boxShadow: '20px 0 60px rgba(0, 0, 0, 0.15)',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <button
                                            className="close-mobile-sidebar"
                                            onClick={() => setShowMobileSidebar(false)}
                                        >
                                            <X size={22} />
                                        </button>
                                        <SessionSidebar
                                            sessions={sessions}
                                            currentSessionId={currentSessionId}
                                            onSelectSession={handleSelectSession}
                                            onNewSession={handleNewSession}
                                            onDeleteSession={handleDeleteSession}
                                            onDeleteAllSessions={handleClearAllSessions}
                                            loading={sessionsLoading}
                                            error={sessionsError}
                                            mobile={true}
                                        />
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
                </div>

                <style jsx>{`
                    .chat-page-container {
                        height: calc(100vh - 56px);
                        display: flex;
                        background-color: #F0F2F5;
                        overflow: hidden;
                        position: relative;
                    }

                    .chat-main-area {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        position: relative;
                        background-color: #F7F6F2;
                    }

                    .chat-input-area {
                        flex-shrink: 0;
                        padding: 24px;
                        padding-top: 0;
                        background: linear-gradient(to bottom, rgba(247, 246, 242, 0) 0%, #F7F6F2 20%);
                        z-index: 10;
                    }

                    .chat-input-wrapper {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    
                    .document-context-banner {
                        max-width: 800px;
                        margin: 0 auto 16px;
                        background: linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 100%);
                        border: 1px solid #C7D2FE;
                        border-radius: 12px;
                        padding: 10px 14px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
                    }
                    
                    .context-icon {
                        width: 32px;
                        height: 32px;
                        background: white;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #6366F1;
                        flex-shrink: 0;
                    }
                    
                    .context-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        min-width: 0;
                    }
                    
                    .context-label {
                        font-size: 10px;
                        font-weight: 700;
                        color: #6366F1;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    
                    .context-filename {
                        font-size: 13px;
                        font-weight: 600;
                        color: #1E293B;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    .clear-context-btn {
                        background: white;
                        border: 1px solid #E0E7FF;
                        width: 28px;
                        height: 28px;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #6366F1;
                        cursor: pointer;
                        transition: all 0.2s;
                        flex-shrink: 0;
                    }
                    
                    .clear-context-btn:hover {
                        background: #FEF2F2;
                        border-color: #FECACA;
                        color: #DC2626;
                    }

                    /* Desktop Sidebar */
                    .desktop-sidebar {
                        display: block;
                        height: 100%;
                        border-left: 1px solid #E2E8F0;
                        background: #F0F2F5;
                        z-index: 20;
                    }

                    /* Mobile Sidebar Toggle - Top Left */
                    .mobile-sidebar-toggle {
                        display: none;
                        position: absolute;
                        top: 16px;
                        left: 16px;
                        z-index: 100;
                        background: white;
                        color: #475569;
                        border: 1px solid #E2E8F0;
                        width: 48px;
                        height: 48px;
                        border-radius: 14px;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                        transition: all 0.2s;
                    }

                    .mobile-sidebar-toggle:hover {
                        background: #F8FAFC;
                        border-color: #CBD5E1;
                        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
                    }

                    .session-badge {
                        position: absolute;
                        top: -6px;
                        right: -6px;
                        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
                        color: white;
                        min-width: 20px;
                        height: 20px;
                        padding: 0 6px;
                        border-radius: 100px;
                        font-size: 11px;
                        font-weight: 800;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
                    }

                    .mobile-sidebar-backdrop {
                        position: fixed;
                        inset: 0;
                        background: rgba(15, 23, 42, 0.6); /* Slightly Darker for contrast */
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px); /* Safari support */
                        z-index: 998;
                    }

                    /* Mobile Sidebar Panel - Now from LEFT */
                    .mobile-sidebar-panel {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: auto;
                        bottom: 0;
                        bottom: 0;
                        width: 320px;
                        max-width: 85vw;
                        background: #FAFAFA;
                        z-index: 999;
                        box-shadow: 20px 0 60px rgba(0, 0, 0, 0.15);
                        display: flex;
                        flex-direction: column;
                    }

                    .close-mobile-sidebar {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        background: #F1F5F9;
                        border: none;
                        width: 40px;
                        height: 40px;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #64748B;
                        cursor: pointer;
                        z-index: 1000;
                        transition: all 0.2s;
                    }

                    .close-mobile-sidebar:hover {
                        background: #E2E8F0;
                        color: #1E293B;
                    }

                    /* Mobile Responsiveness */
                    @media (max-width: 768px) {
                        .desktop-sidebar {
                            display: none;
                        }

                        .mobile-sidebar-toggle {
                            display: flex;
                        }

                        .chat-input-area {
                            padding: 16px;
                            padding-top: 0;
                            padding-bottom: 24px;
                        }

                        .chat-main-area {
                            padding-top: 72px;
                        }
                    }

                    @media (max-width: 480px) {
                        .mobile-sidebar-toggle {
                            top: 12px;
                            left: 12px;
                            width: 44px;
                            height: 44px;
                            border-radius: 12px;
                        }

                        .mobile-sidebar-panel {
                            width: 100%;
                            max-width: 100%;
                        }

                        .chat-main-area {
                            padding-top: 64px;
                        }
                    }

                    /* Sonner Toast Close Button Customization */
                    :global([data-sonner-toast] [data-close-button]) {
                        left: auto !important;
                        right: -8px !important;
                        top: -8px !important;
                        background: #334155 !important;
                        color: white !important;
                        border: 1px solid #475569 !important;
                        opacity: 1 !important;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                    }
                `}</style>
            </DashboardLayout>
        </>
    )
}
