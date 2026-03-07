import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import FlashcardViewer from '@/components/FlashcardViewer'
import { Check, X, ChevronRight, Send, Search, MoreHorizontal, BookOpen, Clock, Activity, ArrowRight, Sparkles, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SessionSidebar, { ChatSession } from '@/components/SessionSidebar'

// Tailwind class mappings
// Premium styles (similar to MCQs for consistency)
const styles = {
  container: "max-w-[1200px] mx-auto",
  mainArea: "flex-1 flex flex-col overflow-y-auto p-4 pt-12 sm:p-8 custom-scrollbar bg-[#fdfbf7]", // Matches chat theme color
  searchOnlyState: "bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 text-center border border-[#E2E8F0] mt-4 sm:mt-0 w-full max-w-[750px] mx-auto",
  sparkleIcon: "w-10 h-10 sm:w-14 sm:h-14 bg-[#EEF2FF] rounded-xl sm:rounded-2xl mx-auto mb-3 sm:mb-4 flex items-center justify-center", // Reduced size and margin
  h1: "text-2xl sm:text-2xl font-[800] mb-1 sm:mb-2 text-[#0F172A]", // Reduced text size and margin
  p: "text-sm sm:text-base text-[#64748B] mb-5 sm:mb-6", // Reduced margin
  largeSearch: "bg-white border-[1.5px] border-[#E2E8F0] p-1.5 pl-4 sm:p-1.5 sm:pl-5 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 focus-within:border-[#6366F1] focus-within:ring-4 focus-within:ring-[#6366F1]/5 transition-all outline-none", // Reduced padding
  topicInput: "border-none bg-transparent flex-1 text-sm sm:text-base font-medium outline-none text-[#1E293B] placeholder:text-slate-400 min-w-0",
  generateBtn: "bg-gradient-to-br from-[#6366F1] to-[#4F46E5] text-white border-none px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-2xl font-bold cursor-pointer hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm sm:text-base",
  activeHeader: "flex flex-col gap-3 mb-6 sm:mb-10 w-full",
  breadcrumb: "flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-[#94A3B8] pl-1 tracking-wider uppercase",
  miniSearch: "flex items-center justify-between bg-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl border-2 border-[#6366F1]/20 w-full",
  aiMessage: "flex flex-col gap-3 mb-6 sm:mb-10 items-start",
  aiAvatar: "hidden",
  aiBubble: "bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-[#E2E8F0] w-full text-[#334155] leading-relaxed text-sm sm:text-[17px]",
  resultCard: "bg-[#FFFFFF] rounded-2xl sm:rounded-3xl p-6 sm:p-12 border border-[#E2E8F0] border-2",
  citations: "mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-[#F1F5F9]",
  citation: "bg-[#F8FAFC] px-4 py-3 rounded-xl mb-2 text-[#64748B] font-medium border border-[#F1F5F9] flex items-center gap-2 text-xs sm:text-sm"
}

export default function Flashcards() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [isCustomCount, setIsCustomCount] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeDocument, setActiveDocument] = useState<any>(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    checkAuth()
  }, [])

  // Check for document context
  useEffect(() => {
    const documentId = router.query.document as string
    if (documentId) {
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

  const checkAuth = async () => {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        console.warn('Auth session missing or Supabase unreachable')
        router.push('/')
        return
      }
      setUser(data.session.user as AuthUser)
      loadSessions(data.session.access_token)
    } catch (err) {
      console.error('Supabase auth failure (flashcards):', err)
      setError('Connection failed: Identity service unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const loadSessions = async (token?: string) => {
    try {
      setSessionsLoading(true)
      setSessionsError(null)
      const authToken = token || await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions?feature=flashcard`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(err => {
        throw new Error('Connection failed: Backend server unreachable.')
      })

      if (response && response.ok) {
        const data = await response.json()
        setSessions(data)
      } else {
        setSessionsError('Failed to load sessions')
      }
    } catch (err: any) {
      console.error('Failed to load sessions:', err)
      setSessionsError(err.message || 'Connection failed: Backend server unreachable.')
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
      }).catch(err => {
        console.warn('Network error fetching session materials:', err)
        return null
      })

      if (response && response.ok) {
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

      const response = await fetch(`${API_URL}/api/study-tools/sessions/all?feature=flashcard`, {
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

    let finalCount = count;
    if (finalCount < 1) finalCount = 1;
    if (finalCount > 100) finalCount = 100;
    setCount(finalCount);

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      // If document is active, search for relevant context
      let documentContext = ''
      if (activeDocument) {
        try {
          const searchResponse = await fetch(
            `${API_URL}/api/documents/search?query=${encodeURIComponent(topic)}&feature=flashcard&top_k=5`,
            {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }
          )
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            if (searchData.results && searchData.results.length > 0) {
              documentContext = searchData.results.map((r: any) => r.content).join('\n\n')
            }
          }
        } catch (err) {
          console.error('Failed to fetch document context:', err)
        }
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/flashcards`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: topic,
            session_id: currentSessionId,
            count: count,
            format: 'interactive',
            document_context: documentContext || undefined
          })
        }
      ).catch(err => {
        throw new Error('Connection failed. Backend server might be offline.')
      })

      if (response && !response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate flashcards')
      }

      const data = await response.json()
      setResult(data)

      if (!currentSessionId) {
        setCurrentSessionId(data.session_id)
        loadSessions(authToken)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards')
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
        <title>Flashcards - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="page-layout" style={{ position: 'relative' }}>
          {/* Floating Document Badge */}
          {activeDocument && (
            <div
              style={{
                position: 'fixed',
                top: '80px',
                right: '24px',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'white',
                padding: '8px 16px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                border: '2px solid #6366F1',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(99,102,241,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              }}
              title={`Using context from: ${activeDocument.filename}`}
            >
              <BookOpen size={16} color="#6366F1" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#6366F1' }}>
                {activeDocument.filename.length > 20
                  ? activeDocument.filename.substring(0, 20) + '...'
                  : activeDocument.filename}
              </span>
              <button
                onClick={() => {
                  setActiveDocument(null)
                  sessionStorage.removeItem('activeDocument')
                  router.push('/flashcards')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '18px',
                  lineHeight: 1
                }}
                title="Clear document context"
              >
                ×
              </button>
            </div>
          )}

          {/* Main Content */}
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
                <h1 className={styles.h1}>Generate flashcards</h1>
                <p className={styles.p}>Enter any medical topic to create interactive study cards</p>

                {/* Count selector */}
                <div className="mb-4 flex items-center justify-center gap-3">
                  <label className="text-sm font-medium text-gray-600">Number of cards:</label>
                  {!isCustomCount ? (
                    <select
                      value={[5, 10, 15, 20].includes(count) ? count : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setIsCustomCount(true)
                        } else {
                          setCount(Number(e.target.value))
                        }
                      }}
                      className="px-4 py-2 border-2 border-gray-200 rounded-lg font-medium text-gray-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                    >
                      <option value={5}>5 cards</option>
                      <option value={10}>10 cards</option>
                      <option value={15}>15 cards</option>
                      <option value={20}>20 cards</option>
                      <option value="custom">Custom...</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={count || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          setCount(isNaN(val) ? 0 : val)
                        }}
                        onBlur={() => {
                          if (count < 1) setCount(1)
                          if (count > 100) setCount(100)
                        }}
                        placeholder="Max 100"
                        className="px-4 py-2 border-2 border-gray-200 rounded-lg font-medium text-gray-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all w-[100px]"
                      />
                      <button
                        onClick={() => {
                          setIsCustomCount(false)
                          const presetMap = [5, 10, 15, 20]
                          const closest = presetMap.reduce((prev, curr) =>
                            Math.abs(curr - count) < Math.abs(prev - count) ? curr : prev
                          )
                          setCount(closest)
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center"
                        title="Back to Presets"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.largeSearch}>
                  <input
                    type="text"
                    placeholder="e.g. Cardiac Cycle, Neurology, Pharmacology..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                    className={styles.topicInput}
                  />
                  <button
                    className={styles.generateBtn}
                    onClick={handleGenerate}
                    disabled={generating || !topic.trim()}
                  >
                    Generate
                  </button>
                </div>
              </motion.div>
            ) : generating ? (
              <div className="flex flex-col items-center justify-center flex-1 h-full">
                <Clock size={48} className="animate-spin mb-4 text-[#6366F1]" />
                <h3 className="text-xl font-bold text-[#1E293B]">Creating flashcards...</h3>
                <p className="text-[#64748B]">Analyzing high-yield topics for {topic}</p>
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
                    <p>I've generated comprehensive flashcards for <strong>{topic}</strong>. Review each card to strengthen your clinical foundation.</p>
                  </div>
                </div>

                <div className={styles.resultCard}>
                  <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#E2E8F0]">
                    <h3 className="text-lg font-bold text-[#1E293B]">Generated Flashcards</h3>
                    <button
                      onClick={handleNewSession}
                      className="text-xs font-bold text-[#64748B] hover:text-white hover:bg-red-500 px-4 py-2 rounded-lg transition-all cursor-pointer uppercase tracking-tighter"
                    >
                      CLEAR
                    </button>
                  </div>

                  {result.flashcards && result.flashcards.length > 0 ? (
                    <FlashcardViewer flashcards={result.flashcards} />
                  ) : result.content ? (
                    <div className="text-center py-8 text-gray-600">
                      <p className="mb-4">Unable to parse flashcards. Here's the raw content:</p>
                      <div className="text-left bg-gray-50 p-6 rounded-xl border border-gray-200 max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm">{result.content}</pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No flashcards generated
                    </div>
                  )}

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
              newSessionLabel="New Cards"
              untitledLabel="Untitled Deck"
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
            background-color: #fdfbf7; /* Consistent with main app theme */
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
            background-color: #F7F7F6;
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
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          
          /* Hide number input arrows */
          input::-webkit-outer-spin-button,
          input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type=number] {
            -moz-appearance: textfield;
          }
        `}</style>
      </DashboardLayout>
    </>
  )
}
