import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'
import StudyToolsLayout from '@/components/StudyToolsLayout'
import FlashcardViewer from '@/components/FlashcardViewer'
import styles from '@/styles/StudyToolPage.module.css'

interface Session {
  id: string
  title: string
  created_at: string
}

interface Flashcard {
  front: string
  back: string
}

interface Material {
  id: string
  topic: string
  content: string
  flashcards: Flashcard[]
  created_at: string
}

export default function FlashcardsPage() {
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
  const [viewMode, setViewMode] = useState<'list' | 'study'>('list')

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
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/sessions/flashcard`,
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
        const materialsWithFlashcards = data.map((material: any) => ({
          ...material,
          flashcards: parseFlashcardsFromContent(material.content)
        }))
        setMaterials(materialsWithFlashcards)
      }
    } catch (err) {
      console.error('Failed to load materials:', err)
    }
  }

  const parseFlashcardsFromContent = (content: string): Flashcard[] => {
    const cards: Flashcard[] = []
    
    const qaMatches = content.matchAll(/(?:Q:|Question:)\s*(.+?)\s*(?:A:|Answer:)\s*(.+?)(?=(?:Q:|Question:)|$)/gis)
    for (const match of qaMatches) {
      cards.push({
        front: match[1].trim(),
        back: match[2].trim()
      })
    }
    
    if (cards.length === 0) {
      const sections = content.split('\n\n').filter(s => s.trim())
      for (let i = 0; i < sections.length - 1; i += 2) {
        if (sections[i] && sections[i + 1]) {
          cards.push({
            front: sections[i].trim(),
            back: sections[i + 1].trim()
          })
        }
      }
    }
    
    return cards
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/flashcards`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: topic,
            session_id: currentSession,
            format: 'interactive'
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate flashcards')
      }

      const data = await response.json()
      
      await loadSessions()
      if (data.session_id) {
        setCurrentSession(data.session_id)
        await loadMaterials(data.session_id)
      }
      
      setTopic('')
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards')
    } finally {
      setGenerating(false)
    }
  }

  const handleStudyMaterial = (material: Material) => {
    setCurrentMaterial(material)
    setViewMode('study')
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session and all its flashcards?')) return

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

  return (
    <StudyToolsLayout>
      <Head>
        <title>Flashcards - VaidyaAI</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🎴 Flashcards</h1>
          <p>Generate interactive spaced repetition cards for any medical topic</p>
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
            {viewMode === 'list' && (
              <>
                <div className={styles.inputSection}>
                  <input
                    type="text"
                    placeholder="Enter a medical topic (e.g., 'cardiac cycle')"
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
                    {generating ? 'Generating...' : 'Generate Flashcards'}
                  </button>
                </div>

                {error && (
                  <div className={styles.error}>
                    ⚠️ {error}
                  </div>
                )}

                <div className={styles.materialsGrid}>
                  {materials.map((material) => (
                    <div key={material.id} className={styles.materialCard}>
                      <div className={styles.cardHeader}>
                        <h3>{material.topic}</h3>
                        <span className={styles.cardDate}>
                          {new Date(material.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={styles.cardMeta}>
                        {material.flashcards?.length || 0} cards
                      </div>
                      <button
                        onClick={() => handleStudyMaterial(material)}
                        className={styles.studyBtn}
                      >
                        Study Now →
                      </button>
                    </div>
                  ))}
                  {materials.length === 0 && !generating && (
                    <div className={styles.placeholder}>
                      <div className={styles.placeholderIcon}>🎴</div>
                      <h3>Ready to generate flashcards</h3>
                      <p>Enter a topic above and click Generate</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {viewMode === 'study' && currentMaterial && (
              <div className={styles.studyView}>
                <button
                  onClick={() => {
                    setViewMode('list')
                    setCurrentMaterial(null)
                  }}
                  className={styles.backBtn}
                >
                  ← Back to List
                </button>
                <FlashcardViewer
                  cards={currentMaterial.flashcards}
                  onComplete={() => {
                    setViewMode('list')
                    setCurrentMaterial(null)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </StudyToolsLayout>
  )
}
