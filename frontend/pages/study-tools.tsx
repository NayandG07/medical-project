import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ClinicalMapViewer, { parseClinicalMapData } from '@/components/ClinicalMapViewer'
import { parseMarkdown } from '@/lib/markdown'
import styles from '@/styles/StudyTools.module.css'

type ToolType = 'flashcards' | 'mcq' | 'highyield' | 'explain' | 'conceptmap'

export default function StudyTools() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTool, setSelectedTool] = useState<ToolType>('flashcards')
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const tool = router.query.tool as ToolType
    if (tool) {
      setSelectedTool(tool)
    }
  }, [router.query])

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

      // Call the appropriate study tool endpoint directly
      const endpoint = getToolEndpoint(selectedTool)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: topic,
            format: 'interactive'  // Request interactive format
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate content')
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to generate content')
    } finally {
      setGenerating(false)
    }
  }

  const getToolEndpoint = (tool: ToolType): string => {
    const endpointMap: Record<ToolType, string> = {
      flashcards: 'flashcards',
      mcq: 'mcq',
      highyield: 'highyield',
      explain: 'explain',
      conceptmap: 'conceptmap'
    }
    return endpointMap[tool]
  }

  const tools = [
    { id: 'flashcards', name: 'Flashcards', icon: '🎴', description: 'Spaced repetition cards' },
    { id: 'mcq', name: 'MCQ Practice', icon: '📝', description: 'Multiple choice questions' },
    { id: 'highyield', name: 'High-Yield', icon: '⭐', description: 'Key summary points' },
    { id: 'explain', name: 'Explanations', icon: '📚', description: 'Detailed breakdowns' },
    { id: 'conceptmap', name: 'Concept Maps', icon: '🗺️', description: 'Visual relationships' }
  ]

  return (
    <>
      <Head>
        <title>Study Tools - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user} loading={loading}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Study Tools 📚</h1>
            <p>Generate custom study materials for any medical topic</p>
          </div>

          <div className={styles.toolSelector}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={`${styles.toolBtn} ${selectedTool === tool.id ? styles.toolBtnActive : ''}`}
                onClick={() => setSelectedTool(tool.id as ToolType)}
              >
                <span className={styles.toolIcon}>{tool.icon}</span>
                <span className={styles.toolName}>{tool.name}</span>
                <span className={styles.toolDesc}>{tool.description}</span>
              </button>
            ))}
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
              {generating ? 'Generating...' : 'Generate'}
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
                <h3>Generated Content</h3>
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
                {selectedTool === 'conceptmap' ? (
                  (() => {
                    const { nodes, connections } = parseClinicalMapData(result.content)
                    return (
                      <ClinicalMapViewer
                        title={topic}
                        nodes={nodes}
                        connections={connections}
                      />
                    )
                  })()
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: parseMarkdown(result.content) }} />
                )}
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
              <div className={styles.placeholderIcon}>
                {tools.find(t => t.id === selectedTool)?.icon}
              </div>
              <h3>Ready to generate {tools.find(t => t.id === selectedTool)?.name.toLowerCase()}</h3>
              <p>Enter a topic above and click Generate to create your study materials</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
