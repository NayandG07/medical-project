import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Send,
  XCircle,
  User,
  Stethoscope,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  AlertCircle,
  Loader2,
  Clock
} from 'lucide-react'

export default function OSCE() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionActive, setSessionActive] = useState(false)
  const [caseData, setCaseData] = useState<any>(null)
  const [userInput, setUserInput] = useState('')
  const [conversation, setConversation] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes in seconds

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (sessionActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      // Session naturally ends or alerts user
    }
    return () => clearInterval(timer)
  }, [sessionActive, timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')} Remaining`
  }

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
      setTimeLeft(600) // Reset to 10 minutes when starting
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
    setTimeLeft(600)
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-medical-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-medical-indigo" />
          <p className="text-lg font-medium text-slate-600">Loading simulator...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>OSCE Station | Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="min-h-[calc(100vh-64px)] bg-[#fafafa] relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-medical-indigo/5 rounded-full blur-[120px] -mr-64 -mt-64" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-medical-purple/5 rounded-full blur-[120px] -ml-64 -mb-64" />

          <div className="relative z-10 p-4 md:p-8 lg:p-12 !pt-0">
            {/* Header Outside Container */}
            <div className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm border border-slate-100 text-medical-indigo text-xs font-bold mb-5 tracking-wider uppercase">
                  <div className="w-2 h-2 rounded-full bg-medical-indigo animate-pulse" />
                  <Stethoscope size={14} className="ml-1" />
                  <span>OSCE Simulator v2.0</span>
                </div>
                <h1 className="text-3xl md:text-6xl font-[800] text-slate-900 tracking-tight leading-[1.1]">
                  OSCE <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 via-indigo-900 to-slate-900">Station</span>
                </h1>
                <p className="mt-4 text-xl text-slate-500 max-w-2xl leading-relaxed font-medium">
                  High-fidelity clinical examination simulations powered by advanced medical intelligence.
                </p>
              </motion.div>

              {sessionActive && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={endSession}
                  className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-rose-600 border border-rose-100 font-bold transition-all hover:bg-rose-50 hover:border-rose-200 shadow-sm hover:shadow-md"
                >
                  <XCircle size={20} className="transition-transform group-hover:rotate-90 text-rose-400 group-hover:text-rose-600" />
                  End Station
                </motion.button>
              )}
            </div>

            <div className="max-w-6xl mx-auto">
              <AnimatePresence mode="wait">
                {!sessionActive ? (
                  <motion.div
                    key="start-screen"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    transition={{ duration: 0.5 }}
                    className="grid lg:grid-cols-5 gap-8 items-start"
                  >
                    {/* Left: Info Card */}
                    <div className="lg:col-span-3">
                      <div className="bg-white rounded-[2.5rem] p-10 md:p-12 shadow-[0_20px_80px_rgba(0,0,0,0.08)] border border-slate-200/60 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-medical-indigo/[0.03] rounded-full -mr-40 -mt-40 blur-3xl transition-transform duration-1000 group-hover:scale-110" />

                        <h3 className="text-3xl font-bold text-slate-800 mb-8 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-medical-indigo/10 flex items-center justify-center">
                            <MessageSquare className="text-medical-indigo" size={24} />
                          </div>
                          Examination Protocol
                        </h3>

                        <div className="space-y-6">
                          {[
                            { title: "Review Context", text: "Carefully analyze the patient case and clinical instructions." },
                            { title: "Professionalism", text: "Maintain medical etiquette and use clear, patient-centered language." },
                            { title: "Clinical Depth", text: "Specify examinations, request labs, and state your diagnostic reasoning." },
                            { title: "Synthesis", text: "Conclude by summarizing findings and proposing a management plan." }
                          ].map((item, idx) => (
                            <div key={idx} className="flex gap-5 group/item">
                              <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover/item:bg-medical-indigo group-hover/item:text-white group-hover/item:border-medical-indigo transition-all duration-300">
                                <CheckCircle2 size={16} />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 group-hover/item:text-medical-indigo transition-colors">{item.title}</h4>
                                <p className="text-slate-500 text-[1.05rem] leading-relaxed mt-1">
                                  {item.text}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Card */}
                    <div className="lg:col-span-2">
                      <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-medical-indigo/20 to-medical-purple/20 opacity-50" />
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />

                        <div className="relative z-10 flex flex-col h-full">
                          <div className="w-20 h-20 rounded-[2rem] bg-indigo-500 flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/30 self-center">
                            <Play fill="white" size={28} className="ml-1" />
                          </div>
                          <h4 className="text-3xl font-bold mb-5 leading-tight ml-5">Begin Evaluation</h4>
                          <p className="text-slate-400 mb-12 text-lg leading-relaxed font-medium">
                            Your virtual station is well prepared. Enter the room when you're ready to start the clinical encounter.
                          </p>

                          <button
                            onClick={startSession}
                            disabled={generating}
                            className="w-full bg-white text-slate-900 py-5 px-8 rounded-[1.5rem] font-bold text-xl shadow-lg hover:shadow-white/10 transition-all flex items-center justify-center gap-3 group/btn disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]"
                          >
                            {generating ? (
                              <>
                                <Loader2 className="animate-spin" size={24} />
                                Preparing...
                              </>
                            ) : (
                              <>
                                Start Station
                                <ChevronRight className="transition-transform group-hover/btn:translate-x-1" size={24} />
                              </>
                            )}
                          </button>

                          <p className="mt-8 text-center text-slate-500 text-sm font-semibold tracking-wide pb-6">
                            Estimated duration: 10-15 mins
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="active-session"
                    initial={{ opacity: 0, scale: 0.98, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 20 }}
                    className="space-y-6"
                  >
                    {/* Standalone Immersive Header (Moved out of chat container) */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[2rem] px-10 py-6 border border-slate-100 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner relative">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">Live Encounter</p>
                          <p className="text-lg font-bold text-slate-900">Virtual Patient Station</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-6 py-3 bg-slate-50/80 rounded-2xl border border-slate-100/50 backdrop-blur-sm">
                        <Clock size={16} className="text-slate-400" />
                        <span className="text-base font-bold text-slate-700 tabular-nums">{formatTime(timeLeft)}</span>
                      </div>
                    </motion.div>

                    {/* Chat Messages - Now directly on page */}
                    <div
                      ref={scrollRef}
                      className="flex-1 overflow-y-auto space-y-8 scroll-smooth min-h-[500px] max-h-[600px] pr-4 no-scrollbar"
                      data-lenis-prevent
                    >
                      {conversation.map((msg, idx) => (
                        <motion.div
                          initial={{ opacity: 0, y: 15, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-center gap-2 mb-2 px-2`}>
                              {msg.role === 'assistant' ? (
                                <>
                                  <div className="w-6 h-6 rounded-lg bg-medical-indigo/10 flex items-center justify-center">
                                    <User size={12} className="text-medical-indigo" />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">AI Examiner</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[11px] font-bold text-medical-indigo uppercase tracking-widest">Candidate</span>
                                </>
                              )}
                            </div>

                            <div
                              className={`px-8 py-5 rounded-[2rem] text-[1.1rem] leading-relaxed shadow-sm transition-all hover:shadow-md ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-indigo-100'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-slate-100'
                                }`}
                            >
                              <div className="whitespace-pre-wrap">{msg.content || (msg as any).detail || "..."}</div>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {generating && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex justify-start"
                        >
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-2 px-2">
                              <div className="w-6 h-6 rounded-lg bg-medical-indigo/10 flex items-center justify-center">
                                <Loader2 size={12} className="text-medical-indigo animate-spin" />
                              </div>
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest italic animate-pulse">Examiner is typing</span>
                            </div>
                            <div className="px-8 py-5 rounded-[2rem] bg-white border border-slate-200 rounded-tl-none flex gap-1.5 items-center shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-medical-indigo/40 animate-bounce [animation-duration:1s]"></span>
                              <span className="w-1.5 h-1.5 rounded-full bg-medical-indigo/40 animate-bounce [animation-duration:1s] [animation-delay:0.2s]"></span>
                              <span className="w-1.5 h-1.5 rounded-full bg-medical-indigo/40 animate-bounce [animation-duration:1s] [animation-delay:0.4s]"></span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Input Area - Now directly on page */}
                    <div className="pt-8 mt-auto">
                      <div className="flex gap-5">
                        <div className="relative flex-1 group">
                          <input
                            type="text"
                            placeholder="Type your response or clinical action..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            className="w-full px-8 py-6 bg-white border-2 border-slate-200 rounded-[2rem] text-[1.1rem] text-slate-900 transition-all outline-none focus:border-medical-indigo focus:ring-4 focus:ring-medical-indigo/5 shadow-sm placeholder:text-slate-400 hover:border-slate-300"
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center text-slate-300 pointer-events-none group-focus-within:text-medical-indigo/40">
                            <kbd className="hidden md:inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-[11px] font-bold text-slate-500 shadow-sm">
                              Return
                            </kbd>
                          </div>
                        </div>

                        <button
                          onClick={sendMessage}
                          disabled={generating || !userInput.trim()}
                          className="h-[76px] aspect-square rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:scale-[0.92] disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-indigo-100"
                        >
                          <Send size={28} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
