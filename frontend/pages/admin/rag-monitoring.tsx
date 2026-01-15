import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'
import { Activity, TrendingUp, FileText, CheckCircle, XCircle, Search } from 'lucide-react'

interface RAGLog {
  id: string
  user_id: string
  feature: string
  query_preview: string
  document_id: string | null
  success: boolean
  results_count: number
  grounding_score: number | null
  timestamp: string
}

interface RAGStats {
  total_queries: number
  successful_queries: number
  avg_grounding_score: number
  by_feature: Record<string, number>
  recent_logs: RAGLog[]
}

export default function RAGMonitoring() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<RAGStats | null>(null)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [selectedFeature, setSelectedFeature] = useState<string>('all')

  useEffect(() => {
    checkAuth()
  }, [timeRange, selectedFeature])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user as AuthUser)
    await fetchRAGStats()
    setLoading(false)
  }

  const fetchRAGStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const params = new URLSearchParams({
        time_range: timeRange,
        ...(selectedFeature !== 'all' && { feature: selectedFeature })
      })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/rag-stats?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!response.ok) throw new Error('Failed to fetch RAG stats')
      const data = await response.json()
      setStats(data)
    } catch (err: any) {
      console.error('Failed to fetch RAG stats:', err)
    }
  }

  if (loading || !user || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  const features = [
    { id: 'all', name: 'All Features', color: '#64748B' },
    { id: 'chat', name: 'Chat', color: '#6366F1' },
    { id: 'mcq', name: 'MCQs', color: '#10B981' },
    { id: 'flashcard', name: 'Flashcards', color: '#F59E0B' },
    { id: 'explain', name: 'Explain', color: '#EF4444' },
    { id: 'highyield', name: 'High Yield', color: '#8B5CF6' },
  ]

  const successRate = stats.total_queries > 0 
    ? ((stats.successful_queries / stats.total_queries) * 100).toFixed(1)
    : '0'

  return (
    <>
      <Head>
        <title>RAG Monitoring - Admin</title>
      </Head>
      <AdminLayout user={user}>
        <div className="max-w-7xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">📊 RAG Monitoring</h1>
            <p className="text-lg text-slate-700">Track document-grounded AI usage and performance</p>
          </div>

          {/* Time Range & Feature Filter */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="flex gap-2">
              {['24h', '7d', '30d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as any)}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    timeRange === range
                      ? 'bg-medical-indigo text-white shadow-md'
                      : 'bg-white text-slate-700 border-2 border-slate-300 hover:border-medical-indigo'
                  }`}
                >
                  {range === '24h' ? 'Last 24 Hours' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>

            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="px-4 py-2 border-2 border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-none focus:border-medical-indigo"
            >
              {features.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-300">
              <div className="flex items-center justify-between mb-2">
                <Activity size={24} className="text-medical-indigo" />
                <span className="text-3xl font-bold text-slate-800">{stats.total_queries}</span>
              </div>
              <p className="text-sm font-bold text-slate-600">Total RAG Queries</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-300">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle size={24} className="text-green-600" />
                <span className="text-3xl font-bold text-slate-800">{successRate}%</span>
              </div>
              <p className="text-sm font-bold text-slate-600">Success Rate</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-300">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp size={24} className="text-purple-600" />
                <span className="text-3xl font-bold text-slate-800">
                  {stats.avg_grounding_score ? (stats.avg_grounding_score * 100).toFixed(0) : 'N/A'}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-600">Avg Grounding Score</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-300">
              <div className="flex items-center justify-between mb-2">
                <FileText size={24} className="text-orange-600" />
                <span className="text-3xl font-bold text-slate-800">{stats.successful_queries}</span>
              </div>
              <p className="text-sm font-bold text-slate-600">Successful Queries</p>
            </div>
          </div>

          {/* Usage by Feature */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-300 mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Usage by Feature</h2>
            <div className="space-y-3">
              {Object.entries(stats.by_feature).map(([feature, count]) => {
                const featureInfo = features.find(f => f.id === feature)
                const percentage = stats.total_queries > 0 
                  ? ((count as number / stats.total_queries) * 100).toFixed(1)
                  : '0'
                
                return (
                  <div key={feature} className="flex items-center gap-4">
                    <div className="w-32 font-bold text-slate-700 capitalize">{feature}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-8 relative overflow-hidden border-2 border-slate-300">
                      <div
                        className="h-full flex items-center justify-end px-3 text-white font-bold text-sm transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: featureInfo?.color || '#64748B',
                          minWidth: count > 0 ? '40px' : '0'
                        }}
                      >
                        {count > 0 && count}
                      </div>
                    </div>
                    <div className="w-16 text-right font-bold text-slate-600">{percentage}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Queries */}
          <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-300">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Recent RAG Queries</h2>
            <div className="space-y-3">
              {stats.recent_logs.length === 0 ? (
                <p className="text-slate-600 text-center py-8">No RAG queries yet</p>
              ) : (
                stats.recent_logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border-2 border-slate-200 hover:border-medical-indigo transition-all"
                  >
                    <div className="flex-shrink-0">
                      {log.success ? (
                        <CheckCircle size={20} className="text-green-600" />
                      ) : (
                        <XCircle size={20} className="text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-1 rounded text-xs font-bold text-white"
                          style={{
                            backgroundColor: features.find(f => f.id === log.feature)?.color || '#64748B'
                          }}
                        >
                          {log.feature.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium truncate">
                        {log.query_preview}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                        <span>Results: {log.results_count}</span>
                        {log.grounding_score && (
                          <span>Grounding: {(log.grounding_score * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
