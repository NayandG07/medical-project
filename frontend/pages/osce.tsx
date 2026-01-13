import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

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
        <div className="max-w-[1200px] mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-4xl text-slate-700 mb-2">👨‍⚕️ OSCE Simulator</h1>
            <p className="text-lg text-slate-500">Simulate structured clinical examinations</p>
          </div>

          {!sessionActive && (
            <>
              <div className="text-center mb-8">
                <button
                  onClick={startSession}
                  disabled={generating}
                  className="bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-12 py-5 rounded-xl text-lg font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(102,126,234,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating Station...' : 'Start OSCE Station'}
                </button>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                <h3 className="text-slate-700 mb-4 text-2xl">👨‍⚕️ OSCE Simulator Mode</h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  You will be given an OSCE station scenario. Perform the examination or task as you would in a real OSCE. The AI examiner will respond to your actions and provide feedback.
                </p>
                <ul className="list-none p-0">
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Read the station instructions carefully</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Introduce yourself to the patient/examiner</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Perform the required examination or task</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Communicate clearly throughout</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Summarize your findings</li>
                </ul>
              </div>
            </>
          )}

          {sessionActive && (
            <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.1)] overflow-hidden">
              <div className="flex justify-between items-center px-8 py-6 bg-gradient-to-br from-medical-indigo to-medical-purple text-white">
                <h3 className="text-xl">🏥 OSCE Station</h3>
                <button onClick={endSession} className="bg-white/20 text-white border-0 px-6 py-2 rounded-lg cursor-pointer font-medium transition-colors hover:bg-white/30">
                  End Session
                </button>
              </div>

              <div className="p-8 max-h-[500px] overflow-y-auto flex flex-col gap-4">
                {conversation.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`max-w-[80%] px-6 py-4 rounded-xl leading-relaxed ${
                      msg.role === 'user'
                        ? 'self-end bg-gradient-to-br from-medical-indigo to-medical-purple text-white'
                        : 'self-start bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ))}
                {generating && (
                  <div className="max-w-[80%] px-6 py-4 rounded-xl leading-relaxed self-start bg-slate-50 text-slate-700 border border-slate-200">
                    <div className="whitespace-pre-wrap">Thinking...</div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 px-8 py-6 border-t-2 border-slate-200">
                <input
                  type="text"
                  placeholder="Describe your action or examination..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 px-6 py-4 border-2 border-slate-200 rounded-xl text-base transition-colors focus:outline-none focus:border-medical-indigo"
                />
                <button
                  onClick={sendMessage}
                  disabled={generating || !userInput.trim()}
                  className="bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-8 py-4 rounded-xl font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
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
