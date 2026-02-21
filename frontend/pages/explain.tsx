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
  mainArea: "flex-1 flex flex-col overflow-y-auto p-4 pt-20 sm:p-10 custom-scrollbar bg-[#fdfbf7]", // Matches chat theme color
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

      // If document is active, search for relevant context
      let documentContext = ''
      if (activeDocument) {
        try {
          const searchResponse = await fetch(
            `${API_URL}/api/documents/search?query=${encodeURIComponent(topic)}&feature=explain&top_k=5`,
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
            format: 'interactive',
            document_context: documentContext || undefined
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
                border: '2px solid #EF4444',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(239,68,68,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              }}
              title={`Using context from: ${activeDocument.filename}`}
            >
              <BookOpen size={16} color="#EF4444" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#EF4444' }}>
                {activeDocument.filename.length > 20 
                  ? activeDocument.filename.substring(0, 20) + '...' 
                  : activeDocument.filename}
              </span>
              <button
                onClick={() => {
                  setActiveDocument(null)
                  sessionStorage.removeItem('activeDocument')
                  router.push('/explain')
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
                  <div className="flex justify-between items-center mb-8 pb-6 border-b-2 border-[#F0FDF4]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-xl flex items-center justify-center">
                        <BookOpen size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-[#064E3B]">Comprehensive Explanation</h3>
                        <p className="text-xs text-[#64748B] mt-0.5">Evidence-based clinical breakdown</p>
                      </div>
                    </div>
                    <button
                      onClick={handleNewSession}
                      className="text-xs font-bold text-[#64748B] hover:text-white hover:bg-gradient-to-r hover:from-[#EF4444] hover:to-[#DC2626] px-5 py-2.5 rounded-xl transition-all cursor-pointer uppercase tracking-wide shadow-sm hover:shadow-md"
                    >
                      New Topic
                    </button>
                  </div>
                  
                  <div className="explanation-content">
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(result.content) }} />
                  </div>

                  {result.citations && (
                    <div className={styles.citations}>
                      <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 bg-[#EEF2FF] rounded-lg flex items-center justify-center">
                          <BookOpen size={16} className="text-[#6366F1]" />
                        </div>
                        <h4 className="text-base font-bold text-[#1E293B]">Referenced Sources</h4>
                      </div>
                      <div className="grid gap-3">
                        {result.citations.sources?.map((source: any, idx: number) => (
                          <div key={idx} className="bg-gradient-to-r from-[#F8FAFC] to-[#F1F5F9] px-4 py-3 rounded-xl border border-[#E2E8F0] flex items-center gap-3 hover:shadow-md transition-shadow">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                              <span className="text-xs font-bold text-[#6366F1]">{idx + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-[#475569]">{source.document_filename}</span>
                          </div>
                        ))}
                      </div>
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
            background-color: #fdfbf7; /* Matches chat theme color */
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
          .animate-spin { animation: spin 1.5s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          
          /* Enhanced Explanation Content Styling */
          .explanation-content {
            font-size: 17px;
            line-height: 1.9;
            color: #334155;
            max-width: 100%;
          }
          
          .explanation-content h1 {
            font-size: 28px;
            font-weight: 800;
            color: #064E3B;
            margin-top: 48px;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 3px solid #10B981;
            letter-spacing: -0.02em;
            line-height: 1.3;
          }
          
          .explanation-content h1:first-child {
            margin-top: 0;
          }
          
          .explanation-content h2 {
            font-size: 22px;
            font-weight: 700;
            color: #065F46;
            margin-top: 36px;
            margin-bottom: 16px;
            padding-left: 14px;
            border-left: 4px solid #10B981;
            letter-spacing: -0.01em;
            line-height: 1.4;
          }
          
          .explanation-content h3 {
            font-size: 19px;
            font-weight: 600;
            color: #047857;
            margin-top: 28px;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            line-height: 1.4;
          }
          
          .explanation-content h3::before {
            content: "▸";
            color: #10B981;
            font-size: 18px;
            flex-shrink: 0;
          }
          
          .explanation-content p {
            margin-bottom: 18px;
            color: #475569;
            text-align: left;
            line-height: 1.9;
            letter-spacing: 0.01em;
          }
          
          .explanation-content strong {
            font-weight: 700;
            color: #0F172A;
            background: linear-gradient(120deg, #D1FAE5 0%, #A7F3D0 100%);
            padding: 2px 6px;
            border-radius: 4px;
          }
          
          .explanation-content em {
            font-style: italic;
            color: #64748B;
          }
          
          .explanation-content code {
            background: #F1F5F9;
            color: #6366F1;
            padding: 4px 8px;
            border-radius: 6px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 15px;
            font-weight: 600;
            border: 1px solid #E2E8F0;
          }
          
          .explanation-content pre {
            background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
            padding: 20px;
            border-radius: 12px;
            overflow-x: auto;
            margin: 20px 0;
            border: 2px solid #E2E8F0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
          }
          
          .explanation-content pre code {
            background: transparent;
            padding: 0;
            border: none;
            color: #334155;
            font-size: 14px;
            line-height: 1.7;
          }
          
          .explanation-content ul {
            margin: 20px 0;
            padding-left: 0;
            list-style: none;
          }
          
          .explanation-content ul li {
            position: relative;
            padding-left: 36px;
            margin-bottom: 14px;
            color: #475569;
            line-height: 1.8;
            letter-spacing: 0.01em;
          }
          
          .explanation-content ul li::before {
            content: "✓";
            position: absolute;
            left: 0;
            top: 2px;
            width: 22px;
            height: 22px;
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(16, 185, 129, 0.15);
            flex-shrink: 0;
          }
          
          .explanation-content ol {
            margin: 20px 0;
            padding-left: 0;
            list-style: none;
            counter-reset: item;
          }
          
          .explanation-content ol li {
            position: relative;
            padding-left: 40px;
            margin-bottom: 14px;
            color: #475569;
            line-height: 1.8;
            counter-increment: item;
            letter-spacing: 0.01em;
          }
          
          .explanation-content ol li::before {
            content: counter(item);
            position: absolute;
            left: 0;
            top: 2px;
            width: 26px;
            height: 26px;
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            color: white;
            border-radius: 7px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(99, 102, 241, 0.15);
            flex-shrink: 0;
          }
          
          .explanation-content br {
            display: block;
            content: "";
            margin-top: 10px;
          }
          
          .explanation-content blockquote {
            background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
            border-left: 4px solid #F59E0B;
            padding: 18px 20px;
            margin: 20px 0;
            border-radius: 10px;
            font-style: italic;
            color: #78350F;
            box-shadow: 0 2px 6px rgba(245, 158, 11, 0.08);
            line-height: 1.8;
          }
          
          .explanation-content table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 20px 0;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
          }
          
          .explanation-content th {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            padding: 14px 16px;
            text-align: left;
            font-weight: 700;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .explanation-content td {
            padding: 14px 16px;
            border-bottom: 1px solid #E2E8F0;
            background: white;
            color: #475569;
            line-height: 1.7;
          }
          
          .explanation-content tr:last-child td {
            border-bottom: none;
          }
          
          .explanation-content tr:nth-child(even) td {
            background: #F8FAFC;
          }
          
          .explanation-content a {
            color: #6366F1;
            text-decoration: none;
            font-weight: 600;
            border-bottom: 2px solid transparent;
            transition: border-color 0.2s;
          }
          
          .explanation-content a:hover {
            border-bottom-color: #6366F1;
          }
          
          /* Responsive adjustments */
          @media (max-width: 768px) {
            .explanation-content {
              font-size: 16px;
              line-height: 1.8;
            }
            
            .explanation-content h1 {
              font-size: 24px;
            }
            
            .explanation-content h2 {
              font-size: 20px;
            }
            
            .explanation-content h3 {
              font-size: 18px;
            }
            
            .explanation-content ul li,
            .explanation-content ol li {
              padding-left: 32px;
            }
          }
        `}</style>
      </DashboardLayout>
    </>
  )
}
