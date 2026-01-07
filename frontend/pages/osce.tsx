import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import styles from '@/styles/Clinical.module.css'

export default function OSCE() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionActive, setSessionActive] = useState(false)
  const [caseData, setCaseData] = useState<any>(null)
  const [userInput, setUserInput] = useState('')
  const [conversation, setConversation] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user as AuthUser)
    setLoading(false)
  }

  const startSession = async () => {
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const prompt = 'Generate an OSCE examination scenario. You are the examiner. Present the station instructions and wait for the student to begin the examination.'

      const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: `OSCE - ${new Date().toLocaleDateString()}` })
      })

      const sessionData = await sessionResponse.json()
      setCaseData(sessionData)

      const messageResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions/${sessionData.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: prompt })
        }
      )

      const messageData = await messageResponse.json()
      setConversation([{ role: 'assistant', content: messageData.content }])
      setSessionActive(true)
    } catch (error) {
      console.error('Failed to start session:', error)
    } finally {
      setGenerating(false)
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() || !caseData) return

    const newMessage = { role: 'user', content: userInput }
    setConversation([...conversation, newMessage])
    setUserInput('')
    setGenerating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const messageResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions/${caseData.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: userInput })
        }
      )

      const messageData = await messageResponse.json()
      setConversation(prev => [...prev, { role: 'assistant', content: messageData.content }])
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setGenerating(false)
    }
  }

  const endSession = () => {
    setSessionActive(false)
    setCaseData(null)
    setConversation([])
    setUserInput('')
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
        <title>OSCE - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>👨‍⚕️ OSCE Simulator</h1>
            <p>Simulate structured clinical examinations</p>
          </div>

          {!sessionActive && (
            <>
              <div className={styles.startSection}>
                <button
                  onClick={startSession}
                  disabled={generating}
                  className={styles.startBtn}
                >
                  {generating ? 'Generating Station...' : 'Start OSCE Station'}
                </button>
              </div>

              <div className={styles.infoCard}>
                <h3>👨‍⚕️ OSCE Simulator Mode</h3>
                <p>
                  You will be given an OSCE station scenario. Perform the examination or task as you would in a real OSCE. The AI examiner will respond to your actions and provide feedback.
                </p>
                <ul>
                  <li>Read the station instructions carefully</li>
                  <li>Introduce yourself to the patient/examiner</li>
                  <li>Perform the required examination or task</li>
                  <li>Communicate clearly throughout</li>
                  <li>Summarize your findings</li>
                </ul>
              </div>
            </>
          )}

          {sessionActive && (
            <div className={styles.sessionContainer}>
              <div className={styles.sessionHeader}>
                <h3>🏥 OSCE Station</h3>
                <button onClick={endSession} className={styles.endBtn}>
                  End Session
                </button>
              </div>

              <div className={styles.conversation}>
                {conversation.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                  >
                    <div className={styles.messageContent}>{msg.content}</div>
                  </div>
                ))}
                {generating && (
                  <div className={`${styles.message} ${styles.assistantMessage}`}>
                    <div className={styles.messageContent}>Thinking...</div>
                  </div>
                )}
              </div>

              <div className={styles.inputSection}>
                <input
                  type="text"
                  placeholder="Describe your action or examination..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className={styles.messageInput}
                />
                <button
                  onClick={sendMessage}
                  disabled={generating || !userInput.trim()}
                  className={styles.sendBtn}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
