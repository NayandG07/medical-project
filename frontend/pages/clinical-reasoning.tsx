import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import styles from '@/styles/Clinical.module.css'

export default function ClinicalReasoning() {
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

      const prompt = 'Generate a clinical case scenario for medical student practice. Present the case progressively, starting with chief complaint and basic history. Wait for the student to ask questions or make decisions before revealing more information.'

      const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: `Clinical Case - ${new Date().toLocaleDateString()}` })
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

  return (
    <>
      <Head>
        <title>Clinical Reasoning - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user} loading={loading}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>🧠 Clinical Reasoning</h1>
            <p>Practice diagnostic thinking with case scenarios</p>
          </div>

          {!sessionActive && (
            <>
              <div className={styles.startSection}>
                <button
                  onClick={startSession}
                  disabled={generating}
                  className={styles.startBtn}
                >
                  {generating ? 'Generating Case...' : 'Start Clinical Case'}
                </button>
              </div>

              <div className={styles.infoCard}>
                <h3>🧠 Clinical Reasoning Mode</h3>
                <p>
                  You will be presented with a patient case. Ask questions, request investigations, and work through your diagnostic reasoning. The case will unfold based on your decisions.
                </p>
                <ul>
                  <li>Take a focused history</li>
                  <li>Request relevant examinations</li>
                  <li>Order appropriate investigations</li>
                  <li>Formulate differential diagnoses</li>
                  <li>Develop a management plan</li>
                </ul>
              </div>
            </>
          )}

          {sessionActive && (
            <div className={styles.sessionContainer}>
              <div className={styles.sessionHeader}>
                <h3>📋 Clinical Case</h3>
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
                  placeholder="Ask a question or state your diagnosis..."
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
