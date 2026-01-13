import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { parseMarkdown } from '@/lib/markdown'

// Tailwind class mappings
const styles = {
  container: "max-w-[1200px] mx-auto p-8 max-md:p-4",
  header: "mb-8",
  inputSection: "flex gap-4 mb-8 max-md:flex-col",
  topicInput: "flex-1 px-6 py-4 border-2 border-slate-200 rounded-xl text-base transition-colors focus:outline-none focus:border-medical-indigo",
  generateBtn: "bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-10 py-4 rounded-xl text-base font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap max-md:w-full",
  error: "bg-[#fee] text-[#c33] p-4 rounded-lg mb-4 border-l-4 border-[#c33]",
  resultCard: "bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
  resultHeader: "flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-200",
  clearBtn: "bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg cursor-pointer transition-all hover:bg-slate-100",
  resultContent: "whitespace-pre-wrap leading-relaxed text-slate-700 text-base",
  citations: "mt-8 pt-6 border-t-2 border-slate-200",
  citation: "bg-slate-50 px-3 py-2 rounded-lg mb-2 text-slate-600",
  placeholder: "text-center py-16 px-8 text-slate-500",
  placeholderIcon: "text-[5rem] mb-4"
}

export default function HighYield() {
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/highyield`,
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
        throw new Error(errorData.detail?.error?.message || 'Failed to generate high-yield notes')
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to generate high-yield notes')
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
        <title>High Yield - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>⭐ High-Yield Notes</h1>
            <p>Generate key summary points for any medical topic</p>
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
              {generating ? 'Generating...' : 'Generate High-Yield Notes'}
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
                <h3>High-Yield Notes</h3>
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
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(result.content) }} />
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
              <div className={styles.placeholderIcon}>⭐</div>
              <h3>Ready to generate high-yield notes</h3>
              <p>Enter a topic above and click Generate to create key summary points</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
