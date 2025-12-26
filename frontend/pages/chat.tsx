import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

  const handleNewSession = async () => {
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

  const handleSendMessage = async (content: string) => {
    if (!currentSessionId) {
      setError('No session selected. Please create or select a session first.')
      return
    }

    try {
      setSendingMessage(true)
      setError(null)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      // Add user message to UI immediately for better UX
      const tempUserMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, tempUserMessage])

      // Send message to backend
      const response = await fetch(`${API_URL}/api/chat/sessions/${currentSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          role: 'user'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const savedMessage = await response.json()
      
      // Replace temp message with saved message
      setMessages(prev => prev.map(msg => 
        msg.id === tempUserMessage.id ? savedMessage : msg
      ))

      // TODO: In future tasks, this will trigger AI response via model router
      // For now, we'll add a placeholder assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'AI response will be implemented when the model router is integrated in Phase 2.',
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  return (
    <>
      <Head>
        <title>Chat - Medical AI Platform</title>
        <meta name="description" content="AI-powered medical education chat" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          padding: '15px 20px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <h1 style={{ margin: 0, fontSize: '20px' }}>Medical AI Platform</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span>Welcome, {user.user_metadata?.name || user.email}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Chat Interface */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden'
        }}>
          {/* Session Sidebar */}
          <SessionSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            loading={sessionsLoading}
            error={sessionsError}
          />

          {/* Main Chat Area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <ChatWindow
              messages={messages}
              loading={messagesLoading || sendingMessage}
              error={error}
            />
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={sendingMessage}
            />
          </div>
        </div>
      </main>
    </>
  )
}
