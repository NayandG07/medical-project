import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ClinicalMapViewer, { parseClinicalMapData, MapNode, MapConnection } from '@/components/ClinicalMapViewer'
import styles from '@/styles/ConceptMap.module.css'

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
