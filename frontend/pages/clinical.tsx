import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

type ModeType = 'reasoning' | 'osce'

export default function Clinical() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ModeType>('reasoning')
  const [sessionActive, setSessionActive] = useState(false)
  const [caseData, setCaseData] = useState<any>(null)
  const [userInput, setUserInput] = useState('')
  const [conversation, setConversation] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [useCustomCondition, setUseCustomCondition] = useState(false)
  const [customCondition, setCustomCondition] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const queryMode = router.query.mode as ModeType
    if (queryMode) {
      setMode(queryMode)
    }
  }, [router.query])

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
    if (useCustomCondition && !customCondition.trim()) {
      alert('Please enter a condition or select random case')
      return
    }
    
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const prompt = mode === 'reasoning'
        ? 'Generate a clinical case scenario for medical student practice. Present the case progressively, starting with chief complaint and basic history. Wait for the student to ask questions or make decisions before revealing more information.'
        : 'Generate an OSCE examination scenario. You are the examiner. Present the station instructions and wait for the student to begin the examination.'

      // Create chat session
      const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: `${mode === 'reasoning' ? 'Clinical Case' : 'OSCE'} - ${new Date().toLocaleDateString()}` })
      })

      const sessionData = await sessionResponse.json()
      setCaseData(sessionData)

      // Get initial case
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
    setUseCustomCondition(false)
    setCustomCondition('')
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
        <title>Clinical Practice - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="max-w-[1200px] mx-auto p-8 max-md:p-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 max-md:text-3xl">Clinical Practice 🏥</h1>
          <p className="text-lg text-slate-700">Practice clinical reasoning and OSCE examinations</p>
        </div>

        {!sessionActive && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 mb-8 max-md:grid-cols-1">
              <button
                className={`bg-white border-2 rounded-xl p-8 cursor-pointer transition-all flex flex-col items-center gap-3 text-center hover:-translate-y-0.5 shadow-md hover:shadow-lg ${mode === 'reasoning' ? 'border-medical-indigo bg-gradient-to-br from-medical-indigo to-medical-purple text-white' : 'border-slate-300 hover:border-medical-indigo hover:shadow-[0_4px_12px_rgba(102,126,234,0.2)]'}`}
                onClick={() => setMode('reasoning')}
              >
                <span className="text-5xl">🧠</span>
                <span className={`font-bold text-xl ${mode === 'reasoning' ? 'text-white' : 'text-slate-800'}`}>Clinical Reasoning</span>
                <span className={`text-[0.95rem] leading-normal ${mode === 'reasoning' ? 'text-white opacity-90' : 'text-slate-600'}`}>Practice diagnostic thinking with case scenarios</span>
              </button>
              <button
                className={`bg-white border-2 rounded-xl p-8 cursor-pointer transition-all flex flex-col items-center gap-3 text-center hover:-translate-y-0.5 shadow-md hover:shadow-lg ${mode === 'osce' ? 'border-medical-indigo bg-gradient-to-br from-medical-indigo to-medical-purple text-white' : 'border-slate-300 hover:border-medical-indigo hover:shadow-[0_4px_12px_rgba(102,126,234,0.2)]'}`}
                onClick={() => setMode('osce')}
              >
                <span className="text-5xl">👨‍⚕️</span>
                <span className={`font-bold text-xl ${mode === 'osce' ? 'text-white' : 'text-slate-800'}`}>OSCE Simulator</span>
                <span className={`text-[0.95rem] leading-normal ${mode === 'osce' ? 'text-white opacity-90' : 'text-slate-600'}`}>Simulate structured clinical examinations</span>
              </button>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border border-slate-300 mb-6">
              <h3 className="text-slate-800 font-bold mb-4 text-xl">Case Selection</h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="random-case"
                    name="case-type"
                    checked={!useCustomCondition}
                    onChange={() => {
                      setUseCustomCondition(false)
                      setCustomCondition('')
                    }}
                    className="w-5 h-5 cursor-pointer accent-medical-indigo"
                  />
                  <label htmlFor="random-case" className="text-slate-700 cursor-pointer font-medium">
                    Random Case (AI selects condition based on specialty)
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="custom-case"
                    name="case-type"
                    checked={useCustomCondition}
                    onChange={() => setUseCustomCondition(true)}
                    className="w-5 h-5 cursor-pointer accent-medical-indigo"
                  />
                  <label htmlFor="custom-case" className="text-slate-700 cursor-pointer font-medium">
                    Custom Condition (Practice specific condition)
                  </label>
                </div>
                {useCustomCondition && (
                  <div className="ml-8 mt-2">
                    <input
                      type="text"
                      placeholder="Enter condition (e.g., acute myocardial infarction, pneumonia)"
                      value={customCondition}
                      onChange={(e) => setCustomCondition(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg text-base text-slate-800 transition-colors focus:outline-none focus:border-medical-indigo"
                    />
                    <p className="text-sm text-slate-600 mt-2">
                      Enter the specific medical condition you want to practice
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center mb-8">
              <button
                onClick={startSession}
                disabled={generating}
                className="bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-12 py-5 rounded-xl text-lg font-bold cursor-pointer transition-all shadow-md hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(102,126,234,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating Case...' : `Start ${mode === 'reasoning' ? 'Clinical Case' : 'OSCE Station'}`}
              </button>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-md border border-slate-300">
              <h3 className="text-slate-800 font-bold mb-4 text-2xl">
                {mode === 'reasoning' ? '🧠 Clinical Reasoning Mode' : '👨‍⚕️ OSCE Simulator Mode'}
              </h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                {mode === 'reasoning'
                  ? 'You will be presented with a patient case. Ask questions, request investigations, and work through your diagnostic reasoning. The case will unfold based on your decisions.'
                  : 'You will be given an OSCE station scenario. Perform the examination or task as you would in a real OSCE. The AI examiner will respond to your actions and provide feedback.'}
              </p>
              <ul className="list-none p-0">
                {mode === 'reasoning' ? (
                  <>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Take a focused history</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Request relevant examinations</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Order appropriate investigations</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Formulate differential diagnoses</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Develop a management plan</li>
                  </>
                ) : (
                  <>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Read the station instructions carefully</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Introduce yourself to the patient/examiner</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Perform the required examination or task</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Communicate clearly throughout</li>
                    <li className="py-3 pl-8 relative text-slate-700 before:content-['✓'] before:absolute before:left-0 before:text-medical-indigo before:font-bold before:text-lg">Summarize your findings</li>
                  </>
                )}
              </ul>
            </div>
          </>
        )}

        {sessionActive && (
          <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
            <div className="flex justify-between items-center px-8 py-6 bg-gradient-to-br from-medical-indigo to-medical-purple text-white">
              <h3 className="text-xl font-bold">{mode === 'reasoning' ? '📋 Clinical Case' : '🏥 OSCE Station'}</h3>
              <button onClick={endSession} className="bg-white/20 text-white border-0 px-6 py-2 rounded-lg cursor-pointer font-bold transition-all hover:bg-white/30 shadow-md">
                End Session
              </button>
            </div>

            <div className="p-8 max-h-[500px] overflow-y-auto flex flex-col gap-4">
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`max-w-[80%] px-6 py-4 rounded-xl leading-relaxed max-md:max-w-[90%] ${
                    msg.role === 'user'
                      ? 'self-end bg-gradient-to-br from-medical-indigo to-medical-purple text-white shadow-md'
                      : 'self-start bg-slate-50 text-slate-800 border-2 border-slate-300'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              {generating && (
                <div className="max-w-[80%] px-6 py-4 rounded-xl leading-relaxed self-start bg-slate-50 text-slate-800 border-2 border-slate-300">
                  <div className="whitespace-pre-wrap">Thinking...</div>
                </div>
              )}
            </div>

            <div className="flex gap-4 px-8 py-6 border-t-2 border-slate-300 max-md:flex-col">
              <input
                type="text"
                placeholder={mode === 'reasoning' ? 'Ask a question or state your diagnosis...' : 'Describe your action or examination...'}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 px-6 py-4 border-2 border-slate-300 rounded-xl text-base text-slate-800 transition-colors focus:outline-none focus:border-medical-indigo"
              />
              <button
                onClick={sendMessage}
                disabled={generating || !userInput.trim()}
                className="bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-8 py-4 rounded-xl font-bold cursor-pointer transition-all shadow-md hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)] disabled:opacity-60 disabled:cursor-not-allowed max-md:w-full"
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
