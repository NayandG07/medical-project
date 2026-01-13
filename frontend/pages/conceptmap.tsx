import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ClinicalMapViewer, { parseClinicalMapData, MapNode, MapConnection } from '@/components/ClinicalMapViewer'

// Tailwind class mappings
const styles = {
  container: "w-full h-[calc(100vh-96px)] flex flex-col",
  mainLayout: "grid grid-cols-[220px_1fr_260px] gap-4 flex-1 min-h-0 max-[1024px]:grid-cols-1 max-[1024px]:grid-rows-[auto_1fr_auto]",
  sidebar: "bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-slate-200 overflow-y-auto h-fit max-h-full max-[1024px]:order-2",
  sessionList: "flex flex-col gap-2",
  sessionItem: "p-3 bg-slate-50 rounded-lg cursor-pointer transition-all relative border border-transparent hover:bg-slate-100 hover:border-slate-200",
  active: "bg-gradient-to-br from-medical-indigo to-[#5a67d8] text-white border-transparent",
  sessionTitle: "font-semibold mb-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap pr-6",
  sessionDate: "text-[0.7rem] opacity-70",
  deleteBtn: "absolute top-1/2 right-2 -translate-y-1/2 bg-transparent border-0 rounded px-1.5 py-0.5 cursor-pointer text-xs opacity-0 transition-all hover:opacity-100 hover:bg-red-500/15",
  emptyState: "text-center py-6 px-3 text-slate-400 text-xs",
  mainContent: "bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-slate-200 flex flex-col min-h-0 overflow-hidden max-[1024px]:order-1 max-[1024px]:min-h-[500px]",
  inputSection: "flex gap-3 mb-4 flex-shrink-0 max-[640px]:flex-col",
  searchBox: "flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-[10px] px-4 transition-all focus-within:border-medical-indigo focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(102,126,234,0.1)]",
  searchIcon: "text-base mr-3 text-slate-400",
  topicInput: "flex-1 py-3 border-0 bg-transparent text-[0.9rem] outline-none text-slate-800 placeholder:text-slate-400",
  generateBtn: "bg-gradient-to-br from-medical-indigo to-[#5a67d8] text-white border-0 px-6 py-3 rounded-[10px] text-[0.9rem] font-semibold cursor-pointer transition-all whitespace-nowrap hover:bg-gradient-to-br hover:from-[#5a67d8] hover:to-[#4c51bf] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(102,126,234,0.3)] disabled:opacity-60 disabled:cursor-not-allowed max-[640px]:w-full",
  error: "bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 border-l-[3px] border-red-600 text-[0.85rem] flex-shrink-0",
  mapContainer: "flex-1 min-h-[400px] flex flex-col rounded-xl overflow-hidden",
  placeholder: "flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50 rounded-xl",
  placeholderIcon: "text-[3.5rem] mb-4 opacity-40",
  rightSidebar: "bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-slate-200 overflow-y-auto h-fit max-h-full max-[1024px]:order-3",
  summaryCard: "flex flex-col gap-4",
  topicIcon: "flex justify-center",
  iconCircle: "w-16 h-16 bg-gradient-to-br from-[#ffeef5] to-[#ffe4ec] rounded-full flex items-center justify-center text-[1.75rem]",
  topicTitle: "text-center text-[0.95rem] text-slate-800 m-0 font-semibold",
  statsSection: "flex flex-col gap-3.5 py-3.5 border-t border-b border-slate-100",
  statItem: "flex flex-col gap-1.5",
  statLabel: "text-[0.7rem] text-slate-500 font-semibold tracking-wide",
  statBadges: "flex flex-wrap gap-1.5",
  badge: "bg-blue-50 text-blue-600 px-2 py-1.5 rounded-[5px] text-[0.7rem] font-medium border border-blue-200",
  treatmentList: "flex flex-col gap-1.5",
  treatmentItem: "bg-green-50 text-green-600 px-2 py-1.5 rounded-[5px] text-[0.7rem] font-medium border border-green-200",
  legend: "pt-2",
  legendItems: "flex flex-col gap-2",
  legendItem: "flex items-center gap-2 text-xs",
  legendColor: "w-[18px] h-[18px] rounded-[5px] flex-shrink-0",
  legendCount: "bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs font-semibold min-w-[24px] text-center"
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

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Delete this session and all its concept maps?')) return

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
              <h3>HISTORY</h3>
              <div className={styles.sessionList}>
                {sessions.length === 0 ? (
                  <div className={styles.emptyState}>No previous maps</div>
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
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        title="Delete session"
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className={styles.mainContent}>
              {/* Input Section */}
              <div className={styles.inputSection}>
                <div className={styles.searchBox}>
                  <span className={styles.searchIcon}>🔍</span>
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
                  ⚠️ {error}
                </div>
              )}

              {/* Concept Map Display */}
              {currentMaterial ? (
                <div className={styles.mapContainer}>
                  <ClinicalMapViewer
                    title={currentMaterial.topic}
                    nodes={mapNodes}
                    connections={mapConnections}
                  />
                </div>
              ) : (
                <div className={styles.placeholder}>
                  <div className={styles.placeholderIcon}>🗺️</div>
                  <h3>Ready to generate clinical maps</h3>
                  <p>Enter a topic above and click Generate</p>
                </div>
              )}
            </div>

            {/* Right Sidebar - Card Summary */}
            <div className={styles.rightSidebar}>
              <h3>CARD SUMMARY</h3>
              
              {currentMaterial ? (
                <div className={styles.summaryCard}>
                  <div className={styles.topicIcon}>
                    <div className={styles.iconCircle}>{getTopicIcon(currentMaterial.topic)}</div>
                  </div>
                  <h4 className={styles.topicTitle}>{currentMaterial.topic}</h4>
                  
                  <div className={styles.statsSection}>
                    {stats.diagnosis > 0 && (
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>🔵 DIAGNOSTICS:</span>
                        <div className={styles.statBadges}>
                          {mapNodes.filter(n => n.type === 'diagnosis').slice(0, 4).map((node, idx) => (
                            <span key={idx} className={styles.badge}>{node.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {stats.treatments > 0 && (
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>🟩 TREATMENTS:</span>
                        <div className={styles.treatmentList}>
                          {mapNodes.filter(n => n.type === 'treatment').slice(0, 4).map((node, idx) => (
                            <div key={idx} className={styles.treatmentItem}>✓ {node.label}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.legend}>
                    <h4>LEGEND</h4>
                    <div className={styles.legendItems}>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{ background: '#fef3c7', border: '2px solid #f59e0b' }}></span>
                        <span>Symptoms</span>
                        <span className={styles.legendCount}>{stats.symptoms}</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{ background: '#dbeafe', border: '2px solid #3b82f6' }}></span>
                        <span>Diagnosis</span>
                        <span className={styles.legendCount}>{stats.diagnosis}</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{ background: '#fce7f3', border: '2px solid #ec4899' }}></span>
                        <span>Risk Factors</span>
                        <span className={styles.legendCount}>{stats.riskFactors}</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendColor} style={{ background: '#d1fae5', border: '2px solid #10b981' }}></span>
                        <span>Treatment</span>
                        <span className={styles.legendCount}>{stats.treatments}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  Generate a map to see summary
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
