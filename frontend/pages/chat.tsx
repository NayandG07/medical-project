import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ChatWindow, { Message } from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import SessionSidebar, { ChatSession } from '@/components/SessionSidebar'

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
  const [activeDocument, setActiveDocument] = useState<any>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Check for document context on mount
  useEffect(() => {
    const documentId = router.query.document as string
    if (documentId) {
      // Try to load from sessionStorage
      const stored = sessionStorage.getItem('activeDocument')
      if (stored) {
        try {
          const docData = JSON.parse(stored)
          if (docData.id === documentId) {
            setActiveDocument(docData)
          }
        } catch (e) {
          console.error('Failed to parse document data:', e)
        }
      }
    }
  }, [router.query.document])

  // Helper function to get auth token
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

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
  }, [router])

  // Load sessions from backend
  const loadSessions = async (token?: string) => {
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

      // If no current session and sessions exist, select the first one
      if (!currentSessionId && data.length > 0) {
        await selectSession(data[0].id, authToken)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setSessionsError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  // Load messages for a session
  const loadMessages = async (sessionId: string, token?: string) => {
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
  }

  // Select a session and load its messages
  const selectSession = async (sessionId: string, token?: string) => {
    setCurrentSessionId(sessionId)
    await loadMessages(sessionId, token)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

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

      // If current session deleted, select first available or clear
      if (currentSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId)
        if (remaining.length > 0) {
          selectSession(remaining[0].id, authToken)
        } else {
          setCurrentSessionId(null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
      setError('Failed to delete session')
    }
  }

  const handleNewSession = async () => {
    // Unfunctional until conversation starts
    if (messages.length === 0) return;

    try {
      setSessionsLoading(true)
      setSessionsError(null)

      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'New Chat'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const newSession = await response.json()

      // Add new session to the list
      setSessions(prev => [newSession, ...prev])

      // Select the new session
      await selectSession(newSession.id, authToken)
    } catch (err) {
      console.error('Failed to create session:', err)
      setSessionsError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    await selectSession(sessionId)
  }

  const handleDeleteAllSessions = async () => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) throw new Error('No authentication token available')

      // Optimistic update
      const sessionsToDelete = [...sessions]
      setSessions([])
      setCurrentSessionId(null)
      setMessages([])

      // Delete all sessions in parallel
      await Promise.all(sessionsToDelete.map(session =>
        fetch(`${API_URL}/api/chat/sessions/${session.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
      ))

      // Sync state to ensure everything is clean
      await loadSessions(authToken)

    } catch (err) {
      console.error('Failed to delete all sessions:', err)
      setError('Failed to delete all sessions')
      // Restore state if failed
      const token = await getAuthToken()
      if (token) loadSessions(token)
    }
  }

  const handleSendMessage = async (content: string) => {
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
            title: content.slice(0, 30) || 'New Chat' // Use first few words as title
          })
        })

        if (!createResponse.ok) {
          throw new Error('Failed to create new session')
        }

        const newSession = await createResponse.json()
        setSessions(prev => [newSession, ...prev])
        setCurrentSessionId(newSession.id)
        activeSessionId = newSession.id
      }

      // Add user message to UI immediately for better UX
      const tempUserMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, tempUserMessage])

      // If document is active, search for relevant context
      let documentContext = ''
      if (activeDocument) {
        try {
          const searchResponse = await fetch(
            `${API_URL}/api/documents/search?query=${encodeURIComponent(content)}&feature=chat&top_k=3`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          )

          if (searchResponse.ok) {
            const searchResults = await searchResponse.json()
            if (searchResults.length > 0) {
              documentContext = '\n\n[Document Context]\n' + searchResults.map((r: any) => r.content).join('\n\n')
            }
          }
        } catch (searchErr) {
          console.error('Document search failed:', searchErr)
          // Continue without context
        }
      }

      // Send message to backend with document context
      const messageContent = documentContext ? content + documentContext : content

      const response = await fetch(`${API_URL}/api/chat/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageContent,
          role: 'user'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to send message')
      }

      const savedMessage = await response.json()

      // Replace temp message with saved message
      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id ? savedMessage : msg
      ))

      // Check if the message is a greeting
      const lowerContent = content.toLowerCase().trim().replace(/[!.]+$/, '')
      const greetingPatterns = [
        /^hi+$/,
        /^he+l+o+$/,
        /^he+y+$/,
        /^yo+$/,
        /^g(ood)?\s*m(orning)?$/,
        /^gm$/
      ]

      const isGreeting = greetingPatterns.some(pattern => pattern.test(lowerContent))

      let assistantContent = 'AI response will be implemented when the model router is integrated in Phase 2.'

      if (isGreeting) {
        const greetingReplies = [
          "Hello! How can I assist you with your medical studies today?",
          "Hi there! Ready to dive into some clinical cases?",
          "Hey! What medical concepts are we exploring today?",
          "Greetings! I'm here to support your learning journey."
        ]
        assistantContent = greetingReplies[Math.floor(Math.random() * greetingReplies.length)]
      }

      // Attempt to save assistant message to backend (especially for greetings)
      try {
        // Only verify persistence for greetings now as the other is a placeholder
        // But if the backend supports it, we might as well save both to maintain flow
        // For now, let's persist the greeting to make it a "real" cheap interaction

        if (isGreeting) {
          const aiResponse = await fetch(`${API_URL}/api/chat/sessions/${activeSessionId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: assistantContent,
              role: 'assistant'
            })
          })

          if (aiResponse.ok) {
            const savedAiMessage = await aiResponse.json()
            setMessages(prev => [...prev, savedAiMessage])
            return
          }
        }
      } catch (e) {
        console.error("Error saving AI response", e)
      }

      // Fallback / Local display if save failed or for placeholder
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (err) {
      console.error('Failed to send message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')

      // Remove the temporary message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Chat - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        {/* Full Page Chat Container */}
        <div style={{
          height: 'calc(100vh - 64px)', // Exact height minus top bar (64px)
          display: 'flex',
          backgroundColor: '#fdfbf7',
          overflow: 'hidden', // Contain scrolling within this app-like view
          position: 'relative' // Create stacking context
        }}>
          {/* Main Chat Area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Document Context Banner */}
            {activeDocument && (
              <div style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                color: 'white',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                zIndex: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>📚 RAG Enabled</div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>{activeDocument.filename}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveDocument(null)
                    sessionStorage.removeItem('activeDocument')
                    router.push('/chat')
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  Disable RAG
                </button>
              </div>
            )}

            <ChatWindow
              messages={messages}
              loading={messagesLoading}
              isTyping={sendingMessage}
              error={error}
            />

            {/* Input Area - Fixed at bottom */}
            <div style={{
              flexShrink: 0, // Prevent shrinking
              padding: '24px',
              paddingTop: '0', // Let ChatWindow bottom padding handle spacing
              background: 'linear-gradient(to bottom, rgba(253, 251, 247, 0) 0%, #fdfbf7 20%)',
              zIndex: 10
            }}>
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={sendingMessage}
                />
              </div>
            </div>
          </div>

          {/* Session Sidebar - Now on the right */}
          <SessionSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onDeleteAllSessions={handleDeleteAllSessions}
            isNewChatDisabled={false}
            loading={sessionsLoading}
            error={sessionsError}
            position="right"
          />
        </div>
      </DashboardLayout>
    </>
  )
}
