import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'
import StudyToolsLayout from '@/components/StudyToolsLayout'
import ClinicalMapViewer, { parseClinicalMapData } from '@/components/ClinicalMapViewer'

// Tailwind class mappings
const styles = {
  loading: "flex justify-center items-center min-h-[60vh] text-xl text-slate-500",
  container: "h-full flex flex-col",
  header: "px-10 py-8 pb-6 bg-white border-b border-slate-200",
  content: "flex-1 flex overflow-hidden max-[968px]:flex-col",
  sessionSidebar: "w-[280px] bg-white border-r border-slate-200 flex flex-col max-[968px]:w-full max-[968px]:max-h-[200px] max-[968px]:border-r-0 max-[968px]:border-b",
  sidebarHeader: "px-6 py-6 border-b border-slate-200",
  sessionList: "flex-1 overflow-y-auto p-2",
  sessionItem: "p-4 mb-2 bg-slate-50 rounded-lg cursor-pointer transition-all relative hover:bg-slate-100 hover:translate-x-1",
  active: "bg-gradient-to-br from-medical-indigo to-medical-purple text-white",
  sessionTitle: "font-semibold mb-1 text-[0.95rem]",
  sessionDate: "text-[0.85rem] opacity-80",
  deleteBtn: "absolute top-2 right-2 bg-white/20 border-0 rounded px-2 py-1 cursor-pointer text-base opacity-0 transition-opacity hover:bg-white/30",
  emptyState: "text-center py-8 px-4 text-slate-400 italic",
  mainArea: "flex-1 overflow-y-auto px-10 py-8 max-md:px-6",
  inputSection: "flex gap-4 mb-8 max-md:flex-col",
  topicInput: "flex-1 px-6 py-4 border-2 border-slate-200 rounded-xl text-base transition-colors focus:outline-none focus:border-medical-indigo",
  generateBtn: "bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-10 py-4 rounded-xl text-base font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap max-md:w-full",
  error: "bg-[#fee] text-[#c33] p-4 rounded-lg mb-6 border-l-4 border-[#c33]",
  mapContainer: "flex-1 min-h-[400px] flex flex-col rounded-xl overflow-hidden",
  placeholder: "flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50 rounded-xl",
  placeholderIcon: "text-[3.5rem] mb-4 opacity-40"
}

interface Session {
  id: string
  title: string
  created_at: string
}

interface Material {
  id: string
  topic: string
  content: string
  created_at: string
}

export default function ConceptMapPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<string | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null)
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      loadMaterials(currentSession)
    }
  }, [currentSession])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user)
    setLoading(false)
  }

  const loadSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/sessions/map`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSessions(data)
        if (data.length > 0 && !currentSession) {
          setCurrentSession(data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    }
  }

  const loadMaterials = async (sessionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/sessions/${sessionId}/materials`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setMaterials(data)
        if (data.length > 0) {
          setCurrentMaterial(data[0])
        }
      }
    } catch (err) {
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
            session_id: currentSession,
            format: 'visual'
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate concept map')
      }

      const data = await response.json()
      
      await loadSessions()
      if (data.session_id) {
        setCurrentSession(data.session_id)
        await loadMaterials(data.session_id)
      }
      
      setTopic('')
    } catch (err: any) {
      setError(err.message || 'Failed to generate concept map')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session and all its concept maps?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.ok) {
        await loadSessions()
        if (currentSession === sessionId) {
          setCurrentSession(null)
          setMaterials([])
          setCurrentMaterial(null)
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  if (loading) {
    return (
      <StudyToolsLayout>
        <div className={styles.loading}>Loading...</div>
      </StudyToolsLayout>
    )
  }

  const renderMap = () => {
    if (!currentMaterial) return null
    
    const { nodes, connections } = parseClinicalMapData(currentMaterial.content)
    
    return (
      <ClinicalMapViewer
        title={currentMaterial.topic}
        nodes={nodes}
        connections={connections}
      />
    )
  }

  return (
    <StudyToolsLayout>
      <Head>
        <title>Concept Maps - VaidyaAI</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🗺️ Concept Maps</h1>
          <p>Generate visual diagrams showing relationships between medical concepts</p>
        </div>

        <div className={styles.content}>
          <div className={styles.sessionSidebar}>
            <div className={styles.sidebarHeader}>
              <h3>Sessions</h3>
            </div>
            <div className={styles.sessionList}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`${styles.sessionItem} ${currentSession === session.id ? styles.active : ''}`}
                  onClick={() => setCurrentSession(session.id)}
                >
                  <div className={styles.sessionTitle}>{session.title}</div>
                  <div className={styles.sessionDate}>
                    {new Date(session.created_at).toLocaleDateString()}
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(session.id)
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className={styles.emptyState}>No sessions yet</div>
              )}
            </div>
          </div>

          <div className={styles.mainArea}>
            <div className={styles.inputSection}>
              <input
                type="text"
                placeholder="Enter a medical topic (e.g., 'diabetes mellitus')"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                className={styles.topicInput}
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={styles.generateBtn}
              >
                {generating ? 'Generating...' : 'Generate Map'}
              </button>
            </div>

            {error && (
              <div className={styles.error}>
                ⚠️ {error}
              </div>
            )}

            {currentMaterial ? (
              <div>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {materials.map((material) => (
                    <button
                      key={material.id}
                      onClick={() => setCurrentMaterial(material)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: currentMaterial.id === material.id ? '#667eea' : '#f8f9fa',
                        color: currentMaterial.id === material.id ? 'white' : '#333',
                        border: '2px solid',
                        borderColor: currentMaterial.id === material.id ? '#667eea' : '#e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem'
                      }}
                    >
                      {material.topic}
                    </button>
                  ))}
                </div>
                {renderMap()}
              </div>
            ) : (
              <div className={styles.placeholder}>
                <div className={styles.placeholderIcon}>🗺️</div>
                <h3>Ready to generate concept maps</h3>
                <p>Enter a topic above and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </StudyToolsLayout>
  )
}
