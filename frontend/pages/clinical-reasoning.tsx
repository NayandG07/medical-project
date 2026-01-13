import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

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
        <title>Clinical Reasoning - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="max-w-[1200px] mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-4xl text-slate-700 mb-2">🧠 Clinical Reasoning</h1>
            <p className="text-lg text-slate-500">Practice diagnostic thinking with case scenarios</p>
          </div>

          {!sessionActive && (
            <>
              <div className="text-center mb-8">
                <button
                  onClick={startSession}
                  disabled={generating}
                  className="bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-12 py-5 rounded-xl text-lg font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(102,126,234,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating Case...' : 'Start Clinical Case'}
                </button>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                <h3 className="text-slate-700 mb-4 text-2xl">🧠 Clinical Reasoning Mode</h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  You will be presented with a patient case. Ask questions, request investigations, and work through your diagnostic reasoning. The case will unfold based on your decisions.
                </p>
                <ul className="list-none p-0">
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Take a focused history</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Request relevant examinations</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Order appropriate investigations</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Formulate differential diagnoses</li>
                  <li className="py-3 pl-8 relative text-slate-600 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold">Develop a management plan</li>
                </ul>
              </div>
            </>
          )}

          {sessionActive && (
            <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.1)] overflow-hidden">
              <div className="flex justify-between items-center px-8 py-6 bg-gradient-to-br from-medical-indigo to-medical-purple text-white">
                <h3 className="text-xl">📋 Clinical Case</h3>
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
                  placeholder="Ask a question or state your diagnosis..."
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
