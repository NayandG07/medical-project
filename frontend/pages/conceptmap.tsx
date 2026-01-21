import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Search, History as HistoryIcon, Trash2, Map as MapIcon, Info, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ClinicalMapViewer, { parseClinicalMapData, MapNode, MapConnection } from '@/components/ClinicalMapViewer'

// Tailwind class mappings
const styles = {
  container: "w-full h-[calc(100vh-150px)] flex flex-col overflow-hidden",
  mainLayout: "grid grid-cols-[240px_1fr_280px] gap-4 flex-1 min-h-0 max-[1024px]:grid-cols-1 max-[1024px]:grid-rows-[auto_1fr_auto] overflow-hidden",
  sidebar: "bg-[#F7F7F6] rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden max-[1024px]:order-2",
  sidebarHeader: "p-4 border-b border-slate-200/60 flex items-center gap-2 flex-shrink-0",
  sidebarTitle: "text-[11px] font-bold text-slate-500 uppercase tracking-widest m-0",
  sessionList: "flex flex-col gap-1.5 flex-1 overflow-y-auto p-3 min-h-0",
  sessionItem: "group p-3 bg-white/60 rounded-xl cursor-pointer transition-all relative border border-transparent hover:bg-white hover:border-slate-200 flex flex-col gap-1",
  active: "!bg-medical-indigo/5 !border-medical-indigo/20 shadow-sm",
  sessionTitle: "font-semibold text-[13px] text-slate-800 line-clamp-1 pr-8 group-hover:text-medical-indigo transition-colors",
  sessionDate: "text-[11px] text-slate-400 font-medium",
  deleteBtn: "absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all z-10",
  emptyState: "flex flex-col items-center justify-center py-12 px-4 text-slate-400 text-sm font-medium gap-3 h-full",
  sidebarFooter: "p-3 border-t border-slate-200/60 bg-slate-50/30 flex-shrink-0",
  clearBtn: "flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-50 text-red-600 text-[11px] font-bold border border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all w-full uppercase tracking-widest shadow-sm",

  mainContent: "bg-[#F7F7F6] rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col min-h-0 overflow-hidden max-[1024px]:order-1 max-[1024px]:min-h-[500px]",
  inputSection: "flex gap-3 mb-4 flex-shrink-0 max-[640px]:flex-col items-center",
  searchBox: "flex-1 flex items-center bg-white/50 border border-slate-200 rounded-xl px-4 transition-all focus-within:border-medical-indigo focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(102,126,234,0.1)] h-12",
  searchIcon: "text-slate-400",
  topicInput: "flex-1 py-1 border-0 bg-transparent text-[15px] outline-none text-slate-900 placeholder:text-slate-400 font-medium ml-2",
  generateBtn: "bg-gradient-to-br from-medical-indigo to-[#5a67d8] text-white border-0 px-8 h-12 rounded-xl text-[14px] font-bold cursor-pointer transition-all whitespace-nowrap hover:shadow-[0_8px_20px_rgba(102,126,234,0.3)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed max-[640px]:w-full",
  error: "bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 border-l-[3px] border-red-600 text-sm font-medium flex-shrink-0",
  mapContainer: "flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden border border-slate-100",
  placeholder: "flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200",
  placeholderIcon: "w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[2.5rem] mb-6 border border-slate-100",

  rightSidebar: "bg-[#F7F7F6] rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden max-[1024px]:order-3",
  rightSidebarHeader: "p-4 border-b border-slate-100 flex items-center gap-2 flex-shrink-0",
  rightSidebarContent: "flex-1 overflow-y-auto p-4 custom-scrollbar",
  summaryCard: "flex flex-col gap-6",
  topicIcon: "flex justify-center mb-2",
  iconCircle: "w-20 h-20 bg-gradient-to-br from-medical-indigo/10 to-medical-indigo/5 rounded-2xl flex items-center justify-center text-[2rem] shadow-sm border border-medical-indigo/10",
  topicTitle: "text-center text-lg text-slate-800 m-0 font-bold tracking-tight",
  statsSection: "flex flex-col gap-5 py-5 border-t border-b border-slate-100",
  statItem: "flex flex-col gap-2",
  statLabel: "text-[10px] text-slate-400 font-extrabold tracking-widest uppercase",
  statBadges: "flex flex-wrap gap-1.5",
  badge: "bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-blue-100/50 shadow-sm",
  treatmentList: "flex flex-col gap-2",
  treatmentItem: "bg-green-50 text-green-700 px-3 py-2 rounded-lg text-[11px] font-bold border border-green-100/50 flex items-center gap-2 shadow-sm",
  legend: "pt-2",
  legendTitle: "text-[10px] text-slate-400 font-extrabold tracking-widest uppercase mb-4",
  legendItems: "grid grid-cols-1 gap-2",
  legendItem: "flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors",
  legendColor: "w-4 h-4 rounded-md shadow-sm",
  legendLabel: "text-xs font-semibold text-slate-600 flex-1",
  legendCount: "bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[10px] font-bold min-w-[20px] text-center"
}

// Helper to get emoji icon based on topic
const getTopicIcon = (topic: string): string => {
  const topicLower = topic.toLowerCase()
  if (topicLower.includes('pulmonary') || topicLower.includes('lung') || topicLower.includes('respiratory')) return '🫁'
  if (topicLower.includes('heart') || topicLower.includes('cardiac') || topicLower.includes('cardio')) return '❤️'
  if (topicLower.includes('brain') || topicLower.includes('neuro') || topicLower.includes('stroke')) return '🧠'
  if (topicLower.includes('kidney') || topicLower.includes('renal')) return '🫘'
  if (topicLower.includes('liver') || topicLower.includes('hepat')) return '🫀'
  if (topicLower.includes('diabetes') || topicLower.includes('glucose')) return '💉'
  if (topicLower.includes('bone') || topicLower.includes('fracture') || topicLower.includes('ortho')) return '🦴'
  if (topicLower.includes('skin') || topicLower.includes('derma')) return '🩹'
  if (topicLower.includes('eye') || topicLower.includes('ophthal')) return '👁️'
  if (topicLower.includes('stomach') || topicLower.includes('gastro') || topicLower.includes('digest')) return '🫃'
  return '🏥'
}

interface ConceptMapSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface ConceptMapMaterial {
  id: string
  topic: string
  content: string
  created_at: string
}

export default function ConceptMap() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // History management
  const [sessions, setSessions] = useState<ConceptMapSession[]>([])
  const [currentSession, setCurrentSession] = useState<ConceptMapSession | null>(null)
  const [materials, setMaterials] = useState<ConceptMapMaterial[]>([])
  const [currentMaterial, setCurrentMaterial] = useState<ConceptMapMaterial | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
  const [deleteAllConfirmation, setDeleteAllConfirmation] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadSessions()
    }
  }, [user])

  useEffect(() => {
    if (currentSession) {
      loadMaterials(currentSession.id)
    }
  }, [currentSession])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user as AuthUser)
    setLoading(false)
  }

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('study_tool_sessions')
        .select('*')
        .eq('feature', 'map')
        .order('updated_at', { ascending: false })

      if (error) throw error
      setSessions(data || [])

      // Auto-select most recent session
      if (data && data.length > 0 && !currentSession) {
        setCurrentSession(data[0])
      }
    } catch (err: any) {
      console.error('Failed to load sessions:', err)
    }
  }

  const loadMaterials = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMaterials(data || [])

      if (data && data.length > 0) {
        setCurrentMaterial(data[0])
      } else {
        setCurrentMaterial(null)
      }
    } catch (err: any) {
      console.error('Failed to load materials:', err)
    }
  }

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/conceptmap`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: topic,
            format: 'interactive'
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate concept map')
      }

      const data = await response.json()

      // Reload sessions to show the new one
      await loadSessions()

      // If we have a session_id in the response, load that session's materials
      if (data.session_id) {
        // Find the session
        const { data: sessionData } = await supabase
          .from('study_tool_sessions')
          .select('*')
          .eq('id', data.session_id)
          .single()

        if (sessionData) {
          setCurrentSession(sessionData)
          await loadMaterials(data.session_id)
        }
      }

      setTopic('')

    } catch (err: any) {
      setError(err.message || 'Failed to generate concept map')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteAllSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/sessions/all?feature=map`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSessions([])
        setCurrentSession(null)
        setMaterials([])
        setCurrentMaterial(null)
      }
    } catch (err) {
      console.error('Failed to delete all sessions:', err)
    }
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const { error } = await supabase
        .from('study_tool_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) throw error

      // Reload sessions
      await loadSessions()

      // Clear current session if it was deleted
      if (currentSession?.id === sessionId) {
        setCurrentSession(null)
        setMaterials([])
        setCurrentMaterial(null)
      }
    } catch (err: any) {
      console.error('Failed to delete session:', err)
      setError('Failed to delete session')
    }
  }

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  // Parse map data with proper typing
  let mapNodes: MapNode[] = []
  let mapConnections: MapConnection[] = []

  if (currentMaterial?.content) {
    const parsed = parseClinicalMapData(currentMaterial.content)
    mapNodes = parsed.nodes
    mapConnections = parsed.connections
  }

  // Calculate stats
  const stats = {
    symptoms: mapNodes.filter(n => n.type === 'symptom').length,
    diagnosis: mapNodes.filter(n => n.type === 'diagnosis').length,
    riskFactors: mapNodes.filter(n => n.type === 'complication').length,
    treatments: mapNodes.filter(n => n.type === 'treatment').length
  }

  return (
    <>
      <Head>
        <title>Concept Map - VaidyaAI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className={styles.container}>
          <div className={styles.mainLayout}>
            {/* Left Sidebar - History */}
            <div className={styles.sidebar}>
              <div className={styles.sidebarHeader}>
                <HistoryIcon size={16} className="text-slate-500" />
                <h3 className={styles.sidebarTitle}>History</h3>
              </div>
              <div className={styles.sessionList} data-lenis-prevent>
                {sessions.length === 0 ? (
                  <div className={styles.emptyState}>
                    <HistoryIcon size={32} className="opacity-20" />
                    <span>No previous maps</span>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`${styles.sessionItem} ${currentSession?.id === session.id ? styles.active : ''}`}
                      onClick={() => setCurrentSession(session)}
                    >
                      <div className={styles.sessionTitle}>{session.title}</div>
                      <div className={styles.sessionDate}>
                        {new Date(session.created_at).toLocaleDateString()}
                      </div>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmationId(session.id);
                        }}
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className={styles.sidebarFooter}>
                <button
                  onClick={() => setDeleteAllConfirmation(true)}
                  disabled={sessions.length === 0}
                  className={styles.clearBtn}
                >
                  <Trash2 size={14} />
                  Clear All History
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className={styles.mainContent}>
              {/* Input Section */}
              <div className={styles.inputSection}>
                <div className={styles.searchBox}>
                  <Search size={18} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Enter a medical topic..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                    className={styles.topicInput}
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={styles.generateBtn}
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              </div>

              {error && (
                <div className={styles.error}>
                  <AlertTriangle size={16} className="inline mr-2" />
                  {error}
                </div>
              )}

              {/* Concept Map Display */}
              {currentMaterial ? (
                <div className={styles.mapContainer} data-lenis-prevent>
                  <ClinicalMapViewer
                    title={currentMaterial.topic}
                    nodes={mapNodes}
                    connections={mapConnections}
                  />
                </div>
              ) : (
                <div className={styles.placeholder}>
                  <div className={styles.placeholderIcon}>
                    <MapIcon size={40} className="text-medical-indigo opacity-80" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Generate Clinical Maps</h3>
                  <p className="text-slate-500 font-medium">Enter a topic above to create a visual medical guide</p>
                </div>
              )}
            </div>

            {/* Right Sidebar - Card Summary */}
            <div className={styles.rightSidebar}>
              <div className={styles.rightSidebarHeader}>
                <Info size={16} className="text-slate-500" />
                <h3 className={styles.sidebarTitle}>Card Summary</h3>
              </div>

              {currentMaterial ? (
                <div className={styles.rightSidebarContent} data-lenis-prevent>
                  <div className={styles.summaryCard}>
                    <div className={styles.topicIcon}>
                      <div className={styles.iconCircle}>{getTopicIcon(currentMaterial.topic)}</div>
                    </div>
                    <h4 className={styles.topicTitle}>{currentMaterial.topic}</h4>

                    <div className={styles.statsSection}>
                      {stats.diagnosis > 0 && (
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Diagnostics:</span>
                          <div className={styles.statBadges}>
                            {mapNodes.filter(n => n.type === 'diagnosis').slice(0, 4).map((node, idx) => (
                              <span key={idx} className={styles.badge}>{node.label}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {stats.treatments > 0 && (
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Treatments:</span>
                          <div className={styles.treatmentList}>
                            {mapNodes.filter(n => n.type === 'treatment').slice(0, 4).map((node, idx) => (
                              <div key={idx} className={styles.treatmentItem}>
                                <CheckCircle2 size={12} className="text-green-500" />
                                {node.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.legend}>
                      <h4 className={styles.legendTitle}>Map Legend</h4>
                      <div className={styles.legendItems}>
                        <div className={styles.legendItem}>
                          <span className={styles.legendColor} style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}></span>
                          <span className={styles.legendLabel}>Symptoms</span>
                          <span className={styles.legendCount}>{stats.symptoms}</span>
                        </div>
                        <div className={styles.legendItem}>
                          <span className={styles.legendColor} style={{ background: '#dbeafe', border: '2px solid #3b82f6' }}></span>
                          <span className={styles.legendLabel}>Diagnosis</span>
                          <span className={styles.legendCount}>{stats.diagnosis}</span>
                        </div>
                        <div className={styles.legendItem}>
                          <span className={styles.legendColor} style={{ background: '#fce7f3', border: '2px solid #ec4899' }}></span>
                          <span className={styles.legendLabel}>Risk Factors</span>
                          <span className={styles.legendCount}>{stats.riskFactors}</span>
                        </div>
                        <div className={styles.legendItem}>
                          <span className={styles.legendColor} style={{ background: '#d1fae5', border: '2px solid #10b981' }}></span>
                          <span className={styles.legendLabel}>Treatment</span>
                          <span className={styles.legendCount}>{stats.treatments}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <Sparkles size={32} className="opacity-20" />
                  <span>Generate a map to see summary</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Single Confirmation Modal */}
        {deleteConfirmationId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setDeleteConfirmationId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[24px] p-6 w-full max-w-[340px] shadow-2xl animate-in zoom-in-95 duration-200"
            >
              <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Session?</h3>
              <p className="text-sm text-slate-500 mb-6">Permanently remove this session and all its clinical maps?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmationId(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleDeleteSession(deleteConfirmationId, { stopPropagation: () => { } } as any);
                    setDeleteConfirmationId(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete ALL Confirmation Modal */}
        {deleteAllConfirmation && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setDeleteAllConfirmation(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] p-8 w-full max-w-[380px] shadow-2xl text-center animate-in zoom-in-95 duration-200"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500 shadow-sm border border-red-100">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-800 mb-2 tracking-tight">Clear All History?</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">
                This action cannot be undone. All your collected clinical maps and sessions will be permanently deleted.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    handleDeleteAllSessions();
                    setDeleteAllConfirmation(false);
                  }}
                  className="w-full py-4 rounded-2xl bg-red-500 text-white font-bold text-[15px] hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-[0.98]"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setDeleteAllConfirmation(false)}
                  className="w-full py-4 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-[15px] hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  )
}
