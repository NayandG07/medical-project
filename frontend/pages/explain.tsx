import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { parseMarkdown } from '@/lib/markdown'
import { Check, X, ChevronRight, Send, Search, MoreHorizontal, BookOpen, Clock, Activity, ArrowRight, Sparkles, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SessionSidebar, { ChatSession } from '@/components/SessionSidebar'

// Tailwind class mappings
// Premium styles (for consistency)
const styles = {
  container: "max-w-[1200px] mx-auto",
  mainArea: "flex-1 flex flex-col overflow-y-auto p-4 pt-20 sm:p-10 custom-scrollbar bg-[#F8FAF9]", // Increased top padding for mobile to avoid overlap
  searchOnlyState: "bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-20 text-center shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-[#E2E8F0] mt-4 sm:mt-10 w-full max-w-[850px] mx-auto",
  sparkleIcon: "w-12 h-12 sm:w-16 sm:h-16 bg-[#F0FDF4] rounded-xl sm:rounded-2xl mx-auto mb-4 sm:mb-6 flex items-center justify-center",
  h1: "text-2xl sm:text-3xl font-[800] mb-2 sm:mb-3 text-[#064E3B]",
  p: "text-sm sm:text-base text-[#64748B] mb-6 sm:mb-8",
  largeSearch: "bg-white border-[1.5px] border-[#E2E8F0] p-1.5 pl-4 sm:p-2 sm:pl-6 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-4 shadow-sm focus-within:border-[#10B981] focus-within:ring-4 focus-within:ring-[#10B981]/5 transition-all outline-none",
  topicInput: "border-none bg-transparent flex-1 text-sm sm:text-base font-medium outline-none text-[#1E293B] placeholder:text-slate-400 min-w-0",
  generateBtn: "bg-gradient-to-r from-[#10B981] to-[#059669] text-white border-none px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold cursor-pointer hover:shadow-lg hover:shadow-[#10B981]/25 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm sm:text-base",
  activeHeader: "flex flex-col gap-3 mb-6 sm:mb-10 w-full",
  breadcrumb: "flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-[#94A3B8] pl-1 tracking-wider uppercase",
  miniSearch: "flex items-center justify-between bg-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl border-2 border-[#10B981]/20 shadow-sm w-full",
  aiMessage: "flex flex-col gap-3 mb-6 sm:mb-10 items-start",
  aiAvatar: "hidden",
  aiBubble: "bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-[#E2E8F0] w-full text-[#1E293B] leading-relaxed text-sm sm:text-[17px]",
  resultCard: "bg-[#FFFFFF] rounded-2xl sm:rounded-3xl p-6 sm:p-12 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.08)] border border-[#DCFCE7] border-2",
  citations: "mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-[#F1F5F9]",
  citation: "bg-[#FBFDFB] px-3 py-2 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl mb-2 text-[#64748B] font-medium border border-[#F1F5F9] flex items-center gap-2 text-xs sm:text-sm"
}

export default function Explain() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
    loadSessions(session.access_token)
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const loadSessions = async (token?: string) => {
    try {
      setSessionsLoading(true)
      const authToken = token || await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions?feature=explain`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setSessionsLoading(false)
    }
  }

  const loadSessionMaterials = async (sessionId: string) => {
    try {
      setGenerating(true)
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions/${sessionId}/materials`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        const materials = await response.json()
        if (materials && materials.length > 0) {
          const material = materials[0]
          setTopic(material.topic)
          setResult(material)
        }
      }
    } catch (err) {
      console.error('Failed to load material:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId)
    await loadSessionMaterials(sessionId)
  }

  const handleNewSession = () => {
    setCurrentSessionId(null)
    setResult(null)
    setTopic('')
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          handleNewSession()
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const handleDeleteAllSessions = async () => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions/all?feature=explain`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        setSessions([])
        handleNewSession()
      }
    } catch (err) {
      console.error('Failed to delete all sessions:', err)
    }
  }

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(
        `${API_URL}/api/study-tools/explain`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: topic,
            session_id: currentSessionId,
            format: 'interactive'
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate explanation')
      }

      const data = await response.json()
      setResult(data)

      if (!currentSessionId) {
        setCurrentSessionId(data.session_id)
        loadSessions(authToken)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate explanation')
    } finally {
      setGenerating(false)
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
        <title>Explain - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="page-layout">
          {/* Main Content Area */}
          <div className="content-area">
            {!result && !generating ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.searchOnlyState}
              >
                <div className={styles.sparkleIcon}>
                  <Sparkles size={32} color="#6366F1" />
                </div>
                <h1 className={styles.h1}>Detailed Explanations</h1>
                <p className={styles.p}>Enter any medical topic for a comprehensive breakdown</p>
                <div className={styles.largeSearch}>
                  <input
                    type="text"
                    placeholder="e.g. Heart Failure, Renal Physiology, Pharmacology..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                    className={styles.topicInput}
                  />
                  <button
                    className={styles.generateBtn}
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    Explain
                  </button>
                </div>
              </motion.div>
            ) : generating ? (
              <div className="flex flex-col items-center justify-center flex-1 h-full">
                <Clock size={48} className="animate-spin mb-4 text-[#6366F1]" />
                <h3 className="text-xl font-bold text-[#1E293B]">Analyzing topic...</h3>
                <p className="text-[#64748B]">Synthesizing evidence-based explanation for {topic}</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-[1240px] mx-auto w-full"
              >
                <div className={styles.activeHeader}>
                  <div className={styles.breadcrumb}>
                    <span>{topic}</span>
                    <ChevronRight size={14} />
                  </div>
                </div>

                <div className={styles.aiMessage}>
                  <div className={styles.aiBubble}>
                    <p>I've prepared a detailed clinical breakdown of <strong>{topic}</strong>. Review the sections below for high-yield insights.</p>
                  </div>
                </div>

                <div className={styles.resultCard}>
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#E2E8F0]">
                    <h3 className="text-lg font-bold text-[#1E293B]">Comprehensive Explanation</h3>
                    <button
                      onClick={handleNewSession}
                      className="text-xs font-bold text-[#64748B] hover:text-white hover:bg-red-500 px-4 py-2 rounded-lg transition-all cursor-pointer uppercase tracking-tighter"
                    >
                      CLEAR
                    </button>
                  </div>
                  <div className="prose prose-slate max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(result.content) }} />
                  </div>

                  {result.citations && (
                    <div className={styles.citations}>
                      <h4 className="text-sm font-bold text-[#1E293B] mb-4">Sources:</h4>
                      {result.citations.sources?.map((source: any, idx: number) => (
                        <div key={idx} className={styles.citation}>
                          <BookOpen size={14} className="text-[#6366F1]" />
                          <span className="text-sm">{source.document_filename}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          <div className="fixed-sidebar-wrap">
            <SessionSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              onDeleteAllSessions={handleDeleteAllSessions}
              loading={sessionsLoading}
              error={sessionsError}
              position="right"
              newSessionLabel="New Topic"
              untitledLabel="Untitled Explanation"
              isCollapsed={isSidebarCollapsed}
              onToggleCollapsed={setIsSidebarCollapsed}
            />
          </div>
        </div>

        <style jsx>{`
          .page-layout {
            display: flex;
            min-height: calc(100vh - 64px);
            position: relative;
            background-color: #F1F5F9; /* Neutral slate background for high card contrast */
          }

          .content-area {
            flex: 1;
            padding: 40px;
            margin-right: ${isSidebarCollapsed ? '80px' : '320px'};
            transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .fixed-sidebar-wrap {
            position: fixed;
            top: 64px;
            right: 0;
            bottom: 0;
            z-index: 10;
            background-color: #fdfbf7;
          }

          @media (max-width: 1024px) {
            .content-area {
              margin-right: 0;
              padding: 20px;
            }
            .fixed-sidebar-wrap {
              position: static;
            }
          }
        `}</style>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
          .animate-spin { animation: spin 1.5s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </DashboardLayout>
    </>
  )
}
