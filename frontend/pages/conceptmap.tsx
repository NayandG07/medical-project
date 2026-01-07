import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ClinicalMapViewer, { parseClinicalMapData } from '@/components/ClinicalMapViewer'
import styles from '@/styles/StudyTools.module.css'

export default function ConceptMap() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

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
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to generate concept map')
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
        <title>Concept Map - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>🗺️ Concept Maps</h1>
            <p>Visualize relationships between medical concepts</p>
          </div>

          <div className={styles.inputSection}>
            <input
              type="text"
              placeholder="Enter a medical topic (e.g., 'cardiac cycle', 'diabetes mellitus')"
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
              {generating ? 'Generating...' : 'Generate Concept Map'}
            </button>
          </div>

          {error && (
            <div className={styles.error}>
              ⚠️ {error}
            </div>
          )}

          {result && (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <h3>Concept Map</h3>
                <button
                  onClick={() => {
                    setResult(null)
                    setTopic('')
                  }}
                  className={styles.clearBtn}
                >
                  Clear
                </button>
              </div>
              <div className={styles.resultContent}>
                {(() => {
                  const { nodes, connections } = parseClinicalMapData(result.content)
                  return (
                    <ClinicalMapViewer
                      title={topic}
                      nodes={nodes}
                      connections={connections}
                    />
                  )
                })()}
              </div>
              {result.citations && (
                <div className={styles.citations}>
                  <h4>Sources:</h4>
                  {result.citations.sources?.map((source: any, idx: number) => (
                    <div key={idx} className={styles.citation}>
                      📄 {source.document_filename}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!result && !generating && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>🗺️</div>
              <h3>Ready to generate concept map</h3>
              <p>Enter a topic above and click Generate to visualize relationships</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
