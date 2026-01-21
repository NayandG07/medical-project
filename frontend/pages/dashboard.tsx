import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Check, Calendar, Clock, BookOpen, Brain, Activity, Heart,
  Zap, ChevronRight, Trophy, Target, TrendingUp, Flame,
  FileText, Stethoscope, Award, BarChart3, PieChart, ArrowUpRight,
  ArrowDownRight, Sparkles, GraduationCap
} from 'lucide-react'

// Types for API responses
interface PerformanceSummary {
  total_study_minutes: number
  sessions_completed: number
  sessions_planned: number
  completion_rate: number
  average_accuracy: number
  mcqs_attempted: number
  mcqs_correct: number
  flashcards_reviewed: number
  topics_covered: string[]
  strong_topics: string[]
  weak_topics: string[]
}

interface StreakData {
  current_streak: number
  longest_streak: number
  last_study_date: string | null
  days_studied_this_week: number
  days_studied_this_month: number
}

interface SubjectBreakdown {
  subject: string
  total_minutes: number
  sessions_count: number
  average_accuracy: number
  color: string
}

interface StudyGoal {
  id: string
  title: string
  goal_type: string
  target_hours: number | null
  target_sessions: number | null
  current_hours: number
  current_sessions: number
  status: string
  start_date: string
  end_date: string
}

interface ClinicalPerformance {
  total_cases_attempted: number
  total_cases_completed: number
  total_osce_attempted: number
  total_osce_completed: number
  avg_diagnostic_accuracy: number
  avg_clinical_reasoning: number
  avg_communication: number
  current_streak: number
}

interface TodayEntry {
  id: string
  subject: string
  topic: string | null
  study_type: string
  start_time: string
  end_time: string
  status: string
  color_code: string
}

interface DailyBrief {
  greeting: string
  today_entries: TodayEntry[]
  pending_goals: number
  streak_status: string
  recommendations: string[]
}

interface DashboardData {
  performanceSummary: PerformanceSummary | null
  streak: StreakData | null
  subjectBreakdown: SubjectBreakdown[]
  goals: StudyGoal[]
  clinicalPerformance: ClinicalPerformance | null
  dailyBrief: DailyBrief | null
  studyToolStats: {
    flashcards: number
    mcqs: number
    conceptmaps: number
    highyield: number
  }
  loading: boolean
  error: string | null
  weeklyActivity: number[] // Array of 7 days (Mon-Sun) with study minutes
  usageStats: {
    totalTokens: number
    totalRequests: number
    mcqsGenerated: number
    flashcardsGenerated: number
  }
  userPlan: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Color palette for subjects
const SUBJECT_COLORS = [
  '#5C67F2', '#0D9488', '#EA4335', '#F59E0B', '#8B5CF6',
  '#EC4899', '#10B981', '#3B82F6', '#6366F1', '#14B8A6'
]

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    performanceSummary: null,
    streak: null,
    subjectBreakdown: [],
    goals: [],
    clinicalPerformance: null,
    dailyBrief: null,
    studyToolStats: { flashcards: 0, mcqs: 0, conceptmaps: 0, highyield: 0 },
    loading: true,
    error: null,
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
    usageStats: { totalTokens: 0, totalRequests: 0, mcqsGenerated: 0, flashcardsGenerated: 0 },
    userPlan: ''
  })

  const fetchWithAuth = useCallback(async (endpoint: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No session')

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} `)
    }

    return response.json()
  }, [])

  const fetchDashboardData = useCallback(async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true, error: null }))

      // Get user ID first
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      // Fetch only the plan first - high priority
      const { data: planData } = await supabase.from('users').select('plan').eq('id', authUser.id).single()
      if (planData?.plan) {
        setDashboardData(prev => ({ ...prev, userPlan: planData.plan }))
      }

      // Fetch all data in parallel - comprehensive analytics
      const results = await Promise.allSettled([
        fetchWithAuth('/api/planner/performance/summary?days=30'),
        fetchWithAuth('/api/planner/streak'),
        fetchWithAuth('/api/planner/performance/subjects?days=30'),
        fetchWithAuth('/api/planner/goals?status=active'),
        fetchWithAuth('/api/clinical/performance'),
        fetchWithAuth('/api/planner/daily-brief'),
        fetchWithAuth('/api/study-tools/sessions?feature=flashcard'),
        fetchWithAuth('/api/study-tools/sessions?feature=mcq'),
        fetchWithAuth('/api/study-tools/sessions?feature=map'),
        fetchWithAuth('/api/clinical/performance/history?days=7'),
        // Get metrics for the last 7 days using start_date
        fetchWithAuth(`/api/planner/performance/metrics?start_date=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`)
      ])

      // Map results
      const performanceRes = results[0]
      const streakRes = results[1]
      const subjectsRes = results[2]
      const goalsRes = results[3]
      const clinicalRes = results[4]
      const dailyBriefRes = results[5]
      const flashcardSessions = results[6]
      const mcqSessions = results[7]
      const mapSessions = results[8]
      const clinicalHistoryRes = results[9]
      const performanceMetricsRes = results[10]

      // Process results with fallbacks
      const performance = performanceRes.status === 'fulfilled' ? performanceRes.value : null
      const streak = streakRes.status === 'fulfilled' ? streakRes.value : null
      const subjects = subjectsRes.status === 'fulfilled' ? subjectsRes.value?.subjects || [] : []
      const goals = goalsRes.status === 'fulfilled' ? goalsRes.value?.goals || [] : []
      const clinical = clinicalRes.status === 'fulfilled' ? clinicalRes.value : null
      const dailyBriefData = dailyBriefRes.status === 'fulfilled' ? dailyBriefRes.value : null

      // Count sessions
      const flashcardCount = flashcardSessions.status === 'fulfilled'
        ? (flashcardSessions.value?.sessions?.length || 0) : 0
      const mcqCount = mcqSessions.status === 'fulfilled'
        ? (mcqSessions.value?.sessions?.length || 0) : 0
      const mapCount = mapSessions.status === 'fulfilled'
        ? (mapSessions.value?.sessions?.length || 0) : 0

      // Assign colors to subjects
      const coloredSubjects = (subjects as SubjectBreakdown[]).map((s, i) => ({
        ...s,
        total_minutes: (s as any).total_hours ? (s as any).total_hours * 60 : s.total_minutes || 0,
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length]
      }))

      // Transform daily brief to expected format
      const transformedDailyBrief: DailyBrief | null = dailyBriefData ? {
        greeting: dailyBriefData.greeting || '',
        today_entries: (dailyBriefData.today?.sessions || []).map((e: any) => ({
          id: e.id || '',
          subject: e.subject || '',
          topic: e.topic || null,
          study_type: e.study_type || '',
          start_time: e.start_time || '',
          end_time: e.end_time || '',
          status: e.status || 'planned',
          color_code: e.color_code || '#5C67F2'
        })),
        pending_goals: dailyBriefData.active_goals || 0,
        streak_status: dailyBriefData.streak?.current > 0 ? 'active' : 'inactive',
        recommendations: dailyBriefData.top_recommendation ? [dailyBriefData.top_recommendation.description] : []
      } : null

      // Transform performance summary to dashboard format
      const transformedPerformance: PerformanceSummary | null = performance ? {
        total_study_minutes: (performance.total_study_hours || 0) * 60,
        sessions_completed: performance.sessions_completed || 0,
        sessions_planned: performance.sessions_completed || 0,
        completion_rate: performance.consistency_score || 0,
        average_accuracy: performance.average_accuracy || 0,
        mcqs_attempted: 0,
        mcqs_correct: 0,
        flashcards_reviewed: 0,
        topics_covered: [],
        strong_topics: [],
        weak_topics: []
      } : null

      // Calculate weekly activity from performance metrics
      const metricsData = performanceMetricsRes.status === 'fulfilled' ? performanceMetricsRes.value?.metrics || [] : []
      const weeklyActivity = calculateWeeklyActivity(metricsData)

      // Use the plan we fetched (it was already set by checkAuth or the independent fetch)
      const userPlan = planData?.plan || dashboardData.userPlan || 'free'

      const usageStats = {
        totalTokens: 0,
        totalRequests: 0,
        mcqsGenerated: mcqCount,
        flashcardsGenerated: flashcardCount
      }

      setDashboardData({
        performanceSummary: transformedPerformance,
        streak: streak,
        subjectBreakdown: coloredSubjects,
        goals: goals,
        clinicalPerformance: clinical,
        dailyBrief: transformedDailyBrief,
        studyToolStats: {
          flashcards: flashcardCount,
          mcqs: mcqCount,
          conceptmaps: mapCount,
          highyield: (transformedDailyBrief?.today_entries?.length || 0)
        },
        loading: false,
        error: null,
        weeklyActivity: weeklyActivity,
        usageStats: usageStats,
        userPlan: userPlan
      })
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data'
      }))
    }
  }, [fetchWithAuth])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/')
        return
      }

      setUser(session.user as AuthUser)

      // Fetch plan from database before finishing loading
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('plan')
          .eq('id', session.user.id)
          .single()

        if (dbUser?.plan) {
          setDashboardData(prev => ({ ...prev, userPlan: dbUser.plan }))
        } else if (session.user?.user_metadata?.plan) {
          // Fallback to metadata if DB record doesn't have it
          setDashboardData(prev => ({ ...prev, userPlan: session.user.user_metadata.plan }))
        }
      } catch (err) {
        console.error('Error fetching plan in checkAuth:', err)
        // Fallback to metadata on error
        if (session.user?.user_metadata?.plan) {
          setDashboardData(prev => ({ ...prev, userPlan: session.user.user_metadata.plan }))
        }
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user, fetchDashboardData])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Preparing your workspace...</p>
        <style jsx>{`
  .loading - screen {
  display: flex;
  flex - direction: column;
  justify - content: center;
  align - items: center;
  min - height: 100vh;
  background - color: var(--cream - bg);
  gap: 16px;
}
          .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--cream - accent - soft);
  border - top - color: var(--cream - text - main);
  border - radius: 50 %;
  animation: spin 1s linear infinite;
}
@keyframes spin {
            to { transform: rotate(360deg); }
}
          p {
  font - size: 14px;
  font - weight: 600;
  color: var(--cream - text - muted);
}
`}</style>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const {
    performanceSummary,
    streak,
    subjectBreakdown,
    goals,
    clinicalPerformance,
    dailyBrief,
    studyToolStats
  } = dashboardData

  // Calculate derived metrics
  const totalStudyHours = performanceSummary
    ? Math.round(performanceSummary.total_study_minutes / 60 * 10) / 10
    : 0
  const mcqAccuracy = performanceSummary && performanceSummary.mcqs_attempted > 0
    ? Math.round((performanceSummary.mcqs_correct / performanceSummary.mcqs_attempted) * 100)
    : 0
  const completionRate = performanceSummary?.completion_rate || 0

  // Get user's current plan - prioritize DB result (dashboardData.userPlan)
  const userPlan = dashboardData.userPlan || 'free'

  const isProOrHigher = ['pro', 'student', 'admin', 'premium'].includes(userPlan.toLowerCase())
  const isAdmin = userPlan.toLowerCase() === 'admin'
  const isStudent = userPlan.toLowerCase() === 'student'
  const isPro = userPlan.toLowerCase() === 'pro'
  const isPremium = userPlan.toLowerCase() === 'premium' || isPro // In sidebar, 'pro' is called 'Premium'

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <>
      <Head>
        <title>Dashboard - Vaidya AI</title>
        <meta name="description" content="Your premium medical study dashboard" />
      </Head>

      <DashboardLayout user={user}>
        <div className="dashboard-container">
          {/* Main Content Area */}
          <div className="main-area">
            {/* Welcome Section */}
            <header className="welcome-header">
              <div className="welcome-content">
                <h1>{getGreeting()}, {user.user_metadata?.name || user.email?.split('@')[0]}</h1>
                <p>Continue your journey towards clinical excellence.</p>
              </div>
              {streak && streak.current_streak > 0 && (
                <div className="streak-badge">
                  <Flame size={20} className="flame-icon" />
                  <span>{streak.current_streak} day streak</span>
                </div>
              )}
            </header>

            {/* Top Stats Grid */}
            <div className="stats-grid">
              <StatCard
                icon={<TrendingUp size={22} />}
                value={`${totalStudyHours} h`}
                label="Study Time (30d)"
                trend={totalStudyHours > 0 ? '+12%' : undefined}
                trendUp={true}
                color="#0D9488"
                bgColor="#F0FDFA"
              />
              <StatCard
                icon={<Target size={22} />}
                value={`${mcqAccuracy}% `}
                label="MCQ Accuracy"
                subtext={`${performanceSummary?.mcqs_correct || 0}/${performanceSummary?.mcqs_attempted || 0} correct`}
                color="#5C67F2"
                bgColor="#EDEEFF"
              />
              <StatCard
                icon={<Stethoscope size={22} />}
                value={`${clinicalPerformance?.total_cases_completed || 0}`}
                label="Cases Completed"
                subtext={`${clinicalPerformance?.total_osce_completed || 0} OSCE sessions`}
                color="#9333EA"
                bgColor="#F5F3FF"
              />
              <StatCard
                icon={<Flame size={22} />}
                value={String(streak?.current_streak || 0)}
                label="Day Streak"
                subtext={`Best: ${streak?.longest_streak || 0} days`}
                color="#F59E0B"
                bgColor="#FFF7ED"
              />
            </div >

            {/* Performance Overview Section */}
            < section className="performance-section" >
              <div className="section-header">
                <h2>📊 Performance Overview</h2>
                <span className="time-range">Last 30 days</span>
              </div>

              <div className="performance-grid">
                {/* Circular Progress - Completion Rate */}
                <div className="metric-card completion-card">
                  <CircularProgress
                    value={completionRate}
                    size={120}
                    strokeWidth={10}
                    color="#5C67F2"
                  />
                  <div className="metric-details">
                    <h3>Session Completion</h3>
                    <p>{performanceSummary?.sessions_completed || 0} of {performanceSummary?.sessions_planned || 0} planned</p>
                  </div>
                </div>

                {/* Activity Chart */}
                <div className="metric-card activity-card">
                  <h3>Weekly Activity</h3>
                  <WeeklyActivityChart
                    activityMinutes={dashboardData.weeklyActivity}
                  />
                  <div className="activity-stats">
                    <div className="stat">
                      <span className="value">{streak?.days_studied_this_week || 0}</span>
                      <span className="label">This Week</span>
                    </div>
                    <div className="stat">
                      <span className="value">{streak?.days_studied_this_month || 0}</span>
                      <span className="label">This Month</span>
                    </div>
                  </div>
                </div>

                {/* Subject Breakdown */}
                <div className="metric-card subjects-card">
                  <h3>Subject Focus</h3>
                  {subjectBreakdown.length > 0 ? (
                    <div className="subject-bars">
                      {subjectBreakdown.slice(0, 5).map((subject, i) => (
                        <SubjectBar
                          key={i}
                          name={subject.subject}
                          minutes={subject.total_minutes}
                          maxMinutes={Math.max(...subjectBreakdown.map(s => s.total_minutes))}
                          color={subject.color}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <BookOpen size={24} />
                      <p>Start studying to see subject breakdown</p>
                    </div>
                  )}
                </div>
              </div>
            </section >

            {/* Quick Actions & Study Tools */}
            < section className="tools-section" >
              <div className="section-header">
                <h2>🚀 Quick Actions</h2>
              </div>
              <div className="tools-grid">
                <ToolCard
                  icon={<Zap size={20} />}
                  title="MCQ Practice"
                  sessions={studyToolStats.mcqs}
                  accuracy={mcqAccuracy}
                  color="#0D9488"
                  bgColor="#F0FDFA"
                  href="/mcqs"
                />
                <ToolCard
                  icon={<BookOpen size={20} />}
                  title="Flashcards"
                  sessions={studyToolStats.flashcards}
                  reviewed={performanceSummary?.flashcards_reviewed || 0}
                  color="#5C67F2"
                  bgColor="#EDEEFF"
                  href="/flashcards"
                />
                <ToolCard
                  icon={<Stethoscope size={20} />}
                  title="Clinical Cases"
                  sessions={clinicalPerformance?.total_cases_attempted || 0}
                  completed={clinicalPerformance?.total_cases_completed || 0}
                  color="#EA4335"
                  bgColor="#FEF2F2"
                  href="/clinical-cases"
                />
                <ToolCard
                  icon={<Brain size={20} />}
                  title="Concept Maps"
                  sessions={studyToolStats.conceptmaps}
                  color="#9333EA"
                  bgColor="#F5F3FF"
                  href="/conceptmap"
                />
              </div>
            </section >

            {/* Topics Analysis */}
            {
              ((performanceSummary?.strong_topics?.length ?? 0) > 0 || (performanceSummary?.weak_topics?.length ?? 0) > 0) && (
                <section className="topics-section">
                  <div className="section-header">
                    <h2>🎯 Topics Analysis</h2>
                  </div>
                  <div className="topics-grid">
                    <TopicsList
                      title="Strong Topics"
                      topics={performanceSummary?.strong_topics || []}
                      icon={<ArrowUpRight size={16} />}
                      color="#10B981"
                      bgColor="#ECFDF5"
                    />
                    <TopicsList
                      title="Needs Attention"
                      topics={performanceSummary?.weak_topics || []}
                      icon={<ArrowDownRight size={16} />}
                      color="#F59E0B"
                      bgColor="#FFFBEB"
                    />
                  </div>
                </section>
              )
            }
          </div >

          {/* Right Sidebar Area */}
          < aside className="right-sidebar" >
            {/* Today's Schedule */}
            < div className="sidebar-card" >
              <div className="sidebar-header">
                <Calendar size={20} className="header-icon" />
                <h3>Today's Schedule</h3>
              </div>
              {
                dailyBrief?.today_entries && dailyBrief.today_entries.length > 0 ? (
                  <div className="schedule-list">
                    {dailyBrief.today_entries.slice(0, 4).map((entry, i) => (
                      <ScheduleItem
                        key={entry.id || i}
                        subject={entry.subject}
                        topic={entry.topic}
                        time={`${entry.start_time} - ${entry.end_time}`}
                        status={entry.status}
                        color={entry.color_code || SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-schedule">
                    <Calendar size={32} />
                    <p>No sessions scheduled for today</p>
                    <button onClick={() => router.push('/study-planner')} className="schedule-btn">
                      Plan Your Day
                    </button>
                  </div>
                )
              }
              {
                dailyBrief?.today_entries && dailyBrief.today_entries.length > 4 && (
                  <button className="view-all-btn" onClick={() => router.push('/study-planner')}>
                    View All ({dailyBrief.today_entries.length}) <ChevronRight size={16} />
                  </button>
                )
              }
            </div >

            {/* Active Goals */}
            < div className="sidebar-card" >
              <div className="sidebar-header">
                <Target size={20} className="header-icon" />
                <h3>Active Goals</h3>
              </div>
              {
                goals.length > 0 ? (
                  <div className="goals-list">
                    {goals.slice(0, 3).map((goal, i) => (
                      <GoalItem
                        key={goal.id || i}
                        title={goal.title}
                        progress={calculateGoalProgress(goal)}
                        type={goal.goal_type}
                        endDate={goal.end_date}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-goals">
                    <Target size={32} />
                    <p>Set goals to track your progress</p>
                    <button onClick={() => router.push('/study-planner')} className="goals-btn">
                      Create Goal
                    </button>
                  </div>
                )
              }
            </div >

            {/* Clinical Performance Summary */}
            {
              clinicalPerformance && (clinicalPerformance.total_cases_attempted > 0 || clinicalPerformance.total_osce_attempted > 0) && (
                <div className="sidebar-card clinical-card">
                  <div className="sidebar-header">
                    <Stethoscope size={20} className="header-icon" />
                    <h3>Clinical Skills</h3>
                  </div>
                  <div className="clinical-stats">
                    <SkillBar
                      label="Diagnostic Accuracy"
                      value={clinicalPerformance.avg_diagnostic_accuracy || 0}
                    />
                    <SkillBar
                      label="Clinical Reasoning"
                      value={clinicalPerformance.avg_clinical_reasoning || 0}
                    />
                    <SkillBar
                      label="Communication"
                      value={clinicalPerformance.avg_communication || 0}
                    />
                  </div>
                </div>
              )
            }

            {/* Plan Card - Conditional based on user plan */}
            {!isProOrHigher ? (
              <div className="sidebar-card promo-card">
                <div className="promo-glow"></div>
                <Sparkles size={28} className="promo-icon" />
                <h3>Unlock Pro Features</h3>
                <p>Get unlimited clinical cases, AI tutoring, and advanced analytics.</p>
                <button onClick={() => router.push('/upgrade')} className="upgrade-link">
                  Upgrade Now <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div className="sidebar-card plan-card">
                <div className="plan-badge-container">
                  {isAdmin && <Award size={24} className="plan-badge-icon admin" />}
                  {isPremium && <Trophy size={24} className="plan-badge-icon pro" />}
                  {isStudent && <GraduationCap size={24} className="plan-badge-icon student" />}
                  <div className="plan-info">
                    <span className="plan-label">Current Plan</span>
                    <h3 className="plan-name">
                      {isAdmin ? 'Admin' : isPremium ? 'Premium' : 'Student'}
                    </h3>
                  </div>
                </div>
                <div className="plan-features">
                  {isAdmin ? (
                    <>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>Full Platform Access</span>
                      </div>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>Admin Control Panel</span>
                      </div>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>Priority 24/7 Support</span>
                      </div>
                    </>
                  ) : isPremium ? (
                    <>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>Clinical Reasoning AI</span>
                      </div>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>OSCE Virtual Patient Cases</span>
                      </div>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>Document Analysis</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>Unlimited Flashcards & MCQs</span>
                      </div>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>Concept Map Generator</span>
                      </div>
                      <div className="feature-item">
                        <Check size={14} />
                        <span>High Yield Notes</span>
                      </div>
                    </>
                  )}
                </div>
                {!isAdmin && (
                  <button onClick={() => router.push('/profile')} className="manage-plan-btn">
                    Manage Plan
                  </button>
                )}
              </div>
            )}
          </aside >
        </div >

        <style jsx>{`
          .dashboard-container {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 24px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            padding-bottom: 40px;
            overflow-x: hidden;
          }

          .main-area {
            min-width: 0;
            overflow: hidden;
          }

          @media (max-width: 1100px) {
            .dashboard-container {
              grid-template-columns: 1fr;
            }
            .right-sidebar {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 20px;
            }
          }

          .welcome-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 12px;
          }

          .welcome-content {
            flex: 1;
            min-width: 200px;
          }

          .welcome-header h1 {
            font-size: 28px;
            font-weight: 800;
            color: var(--cream-text-main);
            margin: 0 0 6px 0;
            letter-spacing: -0.03em;
          }

          .welcome-header p {
            font-size: 14px;
            color: var(--cream-text-muted);
            margin: 0;
            font-weight: 500;
          }

          .streak-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
            padding: 8px 14px;
            border-radius: 100px;
            border: 1px solid rgba(245, 158, 11, 0.2);
            flex-shrink: 0;
          }

          .streak-badge :global(.flame-icon) {
            color: #F59E0B;
            animation: flicker 1.5s ease-in-out infinite;
          }

          @keyframes flicker {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1); }
          }

          .streak-badge span {
            font-size: 13px;
            font-weight: 700;
            color: #92400E;
          }

          @media (max-width: 600px) {
            .welcome-header h1 {
              font-size: 22px;
            }
            .welcome-header p {
              font-size: 13px;
            }
          }

          .loading-overlay {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            gap: 16px;
            color: var(--cream-text-muted);
          }

          .loading-overlay :global(svg) {
            color: var(--cream-text-main);
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 28px;
          }

          @media (max-width: 1100px) {
            .stats-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }
          }

          @media (max-width: 600px) {
            .stats-grid {
              grid-template-columns: 1fr;
              gap: 12px;
            }
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .section-header h2 {
            font-size: 18px;
            font-weight: 800;
            color: var(--cream-text-main);
            margin: 0;
            letter-spacing: -0.01em;
          }

          .time-range {
            font-size: 13px;
            color: var(--cream-text-muted);
            font-weight: 600;
            background: var(--cream-accent-soft);
            padding: 6px 12px;
            border-radius: 20px;
          }

          .performance-section {
            background: var(--cream-card);
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08);
            margin-bottom: 24px;
            border: 1px solid rgba(0, 0, 0, 0.08);
          }

          .performance-grid {
            display: grid;
            grid-template-columns: 180px 1fr 1fr;
            gap: 20px;
          }

          @media (max-width: 1100px) {
            .performance-section {
              padding: 20px;
            }
            .performance-grid {
              grid-template-columns: 1fr 1fr;
            }
            .completion-card {
              grid-column: span 2;
            }
          }

          @media (max-width: 600px) {
            .performance-grid {
              grid-template-columns: 1fr;
            }
            .completion-card {
              grid-column: span 1;
            }
          }

          .metric-card {
            background: rgba(255, 255, 255, 0.5);
            border-radius: 18px;
            padding: 20px;
            border: 1px solid rgba(0, 0, 0, 0.08);
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
          }

          .metric-card h3 {
            font-size: 14px;
            font-weight: 700;
            color: var(--cream-text-muted);
            margin: 0 0 16px 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .completion-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .metric-details {
            margin-top: 16px;
          }

          .metric-details h3 {
            margin-bottom: 4px;
          }

          .metric-details p {
            font-size: 13px;
            color: var(--cream-text-muted);
            margin: 0;
            font-weight: 500;
          }

          .activity-stats {
            display: flex;
            justify-content: space-around;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
          }

          .activity-stats .stat {
            text-align: center;
          }

          .activity-stats .value {
            display: block;
            font-size: 24px;
            font-weight: 800;
            color: var(--cream-text-main);
          }

          .activity-stats .label {
            font-size: 12px;
            color: var(--cream-text-muted);
            font-weight: 600;
          }

          .subject-bars {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            color: var(--cream-text-muted);
            text-align: center;
          }

          .empty-state p {
            font-size: 13px;
            margin: 12px 0 0 0;
            font-weight: 500;
          }

          .tools-section {
            margin-bottom: 24px;
          }

          .tools-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }

          @media (max-width: 1100px) {
            .tools-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 500px) {
            .tools-grid {
              grid-template-columns: 1fr;
            }
          }

          .topics-section {
            margin-bottom: 24px;
          }

          .topics-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          @media (max-width: 600px) {
            .topics-grid {
              grid-template-columns: 1fr;
            }
          }

          /* Sidebar Styles */
          .right-sidebar {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .sidebar-card {
            background: var(--cream-card);
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
          }

          .sidebar-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
          }

          /* Plan Card Styles */
          .plan-card {
            background: linear-gradient(145deg, #F8FAFC 0%, #F1F5F9 100%);
            border: 1px solid rgba(92, 103, 242, 0.15);
          }

          .plan-badge-container {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }

          .plan-badge-icon {
            padding: 10px;
            border-radius: 12px;
          }

          .plan-badge-icon.admin {
            background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
            color: #92400E;
          }

          .plan-badge-icon.pro {
            background: linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%);
            color: #4F46E5;
          }

          .plan-badge-icon.student {
            background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
            color: #047857;
          }

          .plan-info {
            flex: 1;
          }

          .plan-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--cream-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .plan-name {
            font-size: 18px;
            font-weight: 800;
            color: var(--cream-text-main);
            margin: 2px 0 0 0;
          }

          .plan-features {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }

          .feature-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--cream-text-main);
          }

          .feature-item svg {
            color: #10B981;
          }

          .manage-plan-btn {
            width: 100%;
            background: transparent;
            border: 1px solid rgba(0, 0, 0, 0.1);
            color: var(--cream-text-main);
            padding: 10px 16px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .manage-plan-btn:hover {
            background: var(--cream-accent-soft);
            border-color: var(--cream-text-main);
          }

          .sidebar-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
          }

          .sidebar-header h3 {
            font-size: 15px;
            font-weight: 800;
            color: var(--cream-text-main);
            margin: 0;
          }

          .header-icon {
            color: var(--cream-text-main);
          }

          .schedule-list, .goals-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .empty-schedule, .empty-goals {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 16px;
            color: var(--cream-text-muted);
            text-align: center;
          }

          .empty-schedule p, .empty-goals p {
            font-size: 13px;
            margin: 12px 0 16px 0;
            font-weight: 500;
          }

          .schedule-btn, .goals-btn {
            background: var(--cream-text-main);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .schedule-btn:hover, .goals-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
          }

          .view-all-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            width: 100%;
            margin-top: 16px;
            padding: 12px;
            background: var(--cream-accent-soft);
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            color: var(--cream-text-main);
            cursor: pointer;
            transition: all 0.2s;
          }

          .view-all-btn:hover {
            background: var(--cream-accent);
          }

          .clinical-stats {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .promo-card {
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
            border: none;
          }

          .promo-glow {
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(92, 103, 242, 0.3) 0%, transparent 70%);
            filter: blur(40px);
          }

          .promo-icon {
            color: #A5B4FC;
            margin-bottom: 12px;
          }

          .promo-card h3 {
            font-size: 18px;
            font-weight: 800;
            color: white;
            margin-bottom: 8px;
          }

          .promo-card p {
            font-size: 13px;
            color: #94A3B8;
            margin-bottom: 16px;
            line-height: 1.5;
            font-weight: 500;
          }

          .upgrade-link {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: linear-gradient(135deg, #5C67F2 0%, #4F46E5 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s;
          }

          .promo-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 25px -5px rgba(92, 103, 242, 0.2), 0 8px 10px -6px rgba(92, 103, 242, 0.2);
          }
          .upgrade-link:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 24px rgba(92, 103, 242, 0.4);
          }
        `}</style>
      </DashboardLayout >
    </>
  )
}

// Helper function
function calculateGoalProgress(goal: StudyGoal): number {
  if (goal.target_hours && goal.target_hours > 0) {
    return Math.min(100, Math.round((goal.current_hours / goal.target_hours) * 100))
  }
  if (goal.target_sessions && goal.target_sessions > 0) {
    return Math.min(100, Math.round((goal.current_sessions / goal.target_sessions) * 100))
  }
  return 0
}

// Helper function to calculate weekly activity from metrics data
function calculateWeeklyActivity(metrics: any[]): number[] {
  const result: number[] = [0, 0, 0, 0, 0, 0, 0]
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Calculate the start of the current week (Monday)
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)

  // Check each metric date
  metrics.forEach((metric: any) => {
    if (!metric.metric_date) return
    const metricDate = new Date(metric.metric_date)
    metricDate.setHours(0, 0, 0, 0)

    // Check if this metric is from current week
    const diffDays = Math.floor((metricDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays >= 0 && diffDays < 7) {
      // Get minutes studied for that day
      const minutes = (metric.total_study_minutes || 0)
      result[diffDays] = minutes
    }
  })

  return result
}

// Component: StatCard
function StatCard({ icon, value, label, subtext, trend, trendUp, color, bgColor }: {
  icon: React.ReactNode
  value: string | number
  label: string
  subtext?: string
  trend?: string
  trendUp?: boolean
  color: string
  bgColor: string
}) {
  return (
    <div className="stat-card">
      <div className="icon-container" style={{ backgroundColor: bgColor, color: color }}>
        {icon}
      </div>
      <div className="stat-info">
        <div className="value-row">
          <h3>{value}</h3>
          {trend && (
            <span className={`trend ${trendUp ? 'up' : 'down'}`}>
              {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {trend}
            </span>
          )}
        </div>
        <p className="label">{label}</p>
        {subtext && <p className="subtext">{subtext}</p>}
      </div>
      <style jsx>{`
        .stat-card {
          background: var(--cream-card);
          padding: 16px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          min-width: 0;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
        }
        .icon-container {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stat-info {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .value-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .stat-info h3 {
          font-size: 22px;
          font-weight: 800;
          color: var(--cream-text-main);
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .trend {
          display: flex;
          align-items: center;
          gap: 2px;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 5px;
          border-radius: 5px;
        }
        .trend.up {
          color: #059669;
          background: #ECFDF5;
        }
        .trend.down {
          color: #DC2626;
          background: #FEF2F2;
        }
        .label {
          font-size: 12px;
          color: var(--cream-text-muted);
          margin: 2px 0 0 0;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .subtext {
          font-size: 10px;
          color: var(--cream-text-muted);
          margin: 1px 0 0 0;
          opacity: 0.8;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}

// Component: CircularProgress
function CircularProgress({ value, size, strokeWidth, color }: {
  value: number
  size: number
  strokeWidth: number
  color: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="circular-progress">
      <svg width={size} height={size}>
        <circle
          className="bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: color }}
        />
      </svg>
      <div className="value">{Math.round(value)}%</div>
      <style jsx>{`
        .circular-progress {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        svg {
          transform: rotate(-90deg);
        }
        circle {
          fill: none;
          transition: stroke-dashoffset 0.5s ease;
        }
        .bg {
          stroke: rgba(0, 0, 0, 0.06);
        }
        .progress {
          stroke-linecap: round;
        }
        .value {
          position: absolute;
          font-size: 28px;
          font-weight: 800;
          color: var(--cream-text-main);
        }
      `}</style>
    </div>
  )
}

// Component: WeeklyActivityChart
function WeeklyActivityChart({ activityMinutes }: { activityMinutes: number[] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const today = new Date().getDay()
  const adjustedToday = today === 0 ? 6 : today - 1 // Adjust so Monday is 0

  // Find max minutes to scale bars (minimum 60 to avoid huge bars for small times)
  const maxMinutes = Math.max(...activityMinutes, 60)

  return (
    <div className="activity-chart">
      {days.map((day, i) => {
        const minutes = activityMinutes[i] || 0
        const percentage = (minutes / maxMinutes) * 100
        const height = Math.max(percentage * 0.6, 6) // Scale to fit 60px max, min 6px

        return (
          <div key={i} className="day-bar" title={`${day}: ${minutes} mins`}>
            <div
              className={`bar ${minutes > 0 ? 'active' : ''} ${i === adjustedToday ? 'today' : ''}`}
              style={{
                height: `${height}px`,
                opacity: minutes > 0 ? 0.7 + (percentage / 100) * 0.3 : 1
              }}
            />
            <span className="day-label">{day}</span>
          </div>
        )
      })}
      <style jsx>{`
        .activity-chart {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          height: 70px;
          gap: 6px;
          padding-bottom: 4px;
        }
        .day-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          height: 100%;
          justify-content: flex-end;
        }
        .bar {
          width: 100%;
          background: rgba(0, 0, 0, 0.04);
          border-radius: 4px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .bar.active {
          background: linear-gradient(180deg, #5C67F2 0%, #4F46E5 100%);
          box-shadow: 0 4px 12px rgba(92, 103, 242, 0.2);
        }
        .bar.today {
          background: #1e293b;
          opacity: 1 !important;
        }
        .bar.active.today {
          background: linear-gradient(180deg, #5C67F2 0%, #1e293b 100%);
          box-shadow: 0 4px 12px rgba(92, 103, 242, 0.3);
        }
        .day-label {
          font-size: 9px;
          font-weight: 800;
          color: var(--cream-text-muted);
          text-transform: uppercase;
          opacity: 0.8;
        }
      `}</style>
    </div>
  )
}

// Component: SubjectBar
function SubjectBar({ name, minutes, maxMinutes, color }: {
  name: string
  minutes: number
  maxMinutes: number
  color: string
}) {
  const percentage = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return (
    <div className="subject-bar">
      <div className="bar-header">
        <span className="name">{name}</span>
        <span className="time">{hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <style jsx>{`
        .subject-bar {
          width: 100%;
        }
        .bar-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .name {
          font-size: 12px;
          font-weight: 700;
          color: var(--cream-text-main);
          text-transform: capitalize;
        }
        .time {
          font-size: 11px;
          font-weight: 600;
          color: var(--cream-text-muted);
        }
        .bar-track {
          height: 8px;
          background: rgba(0, 0, 0, 0.06);
          border-radius: 4px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }
      `}</style>
    </div>
  )
}

// Component: ToolCard
function ToolCard({ icon, title, sessions, accuracy, reviewed, completed, color, bgColor, href }: {
  icon: React.ReactNode
  title: string
  sessions: number
  accuracy?: number
  reviewed?: number
  completed?: number
  color: string
  bgColor: string
  href: string
}) {
  const router = useRouter()

  return (
    <div className="tool-card" onClick={() => router.push(href)}>
      <div className="icon-box" style={{ backgroundColor: bgColor, color: color }}>
        {icon}
      </div>
      <h3>{title}</h3>
      <div className="stats">
        <span className="sessions">{sessions} sessions</span>
        {accuracy !== undefined && <span className="detail">{accuracy}% accuracy</span>}
        {reviewed !== undefined && <span className="detail">{reviewed} reviewed</span>}
        {completed !== undefined && <span className="detail">{completed} completed</span>}
      </div>
      <div className="arrow">
        <ChevronRight size={16} />
      </div>
      <style jsx>{`
        .tool-card {
          background: var(--cream-card);
          padding: 16px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          position: relative;
          min-width: 0;
        }
        .tool-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
          border-color: rgba(0, 0, 0, 0.1);
        }
        .icon-box {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        h3 {
          font-size: 14px;
          font-weight: 800;
          color: var(--cream-text-main);
          margin: 0 0 6px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stats {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sessions {
          font-size: 12px;
          font-weight: 600;
          color: var(--cream-text-muted);
        }
        .detail {
          font-size: 10px;
          color: var(--cream-text-muted);
          opacity: 0.8;
        }
        .arrow {
          position: absolute;
          top: 20px;
          right: 16px;
          color: var(--cream-text-muted);
          opacity: 0;
          transition: all 0.2s;
        }
        .tool-card:hover .arrow {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}

// Component: TopicsList
function TopicsList({ title, topics, icon, color, bgColor }: {
  title: string
  topics: string[]
  icon: React.ReactNode
  color: string
  bgColor: string
}) {
  return (
    <div className="topics-list" style={{ backgroundColor: bgColor }}>
      <div className="header">
        <div className="icon-badge" style={{ backgroundColor: color }}>{icon}</div>
        <h3>{title}</h3>
      </div>
      <div className="topics">
        {topics.length > 0 ? (
          topics.slice(0, 5).map((topic, i) => (
            <span key={i} className="topic-tag">{topic}</span>
          ))
        ) : (
          <span className="empty">No topics yet</span>
        )}
      </div>
      <style jsx>{`
        .topics-list {
          border-radius: 20px;
          padding: 20px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
        }
        .topics-list:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.06);
        }
        .header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .icon-badge {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        h3 {
          font-size: 14px;
          font-weight: 700;
          color: var(--cream-text-main);
          margin: 0;
        }
        .topics {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .topic-tag {
          background: rgba(255, 255, 255, 0.8);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: var(--cream-text-main);
          text-transform: capitalize;
        }
        .empty {
          font-size: 13px;
          color: var(--cream-text-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

// Component: ScheduleItem
function ScheduleItem({ subject, topic, time, status, color }: {
  subject: string
  topic: string | null
  time: string
  status: string
  color: string
}) {
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'

  return (
    <div className={`schedule-item ${isCompleted ? 'completed' : ''}`}>
      <div className="color-bar" style={{ backgroundColor: color }} />
      <div className="content">
        <span className="subject">{subject}</span>
        {topic && <span className="topic">{topic}</span>}
        <span className="time">{time}</span>
      </div>
      <div className="status-badge">
        {isCompleted && <Check size={14} />}
        {isInProgress && <Activity size={14} />}
      </div>
      <style jsx>{`
          .schedule-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: var(--cream-card);
            border-radius: 14px;
            border: 1px solid rgba(0, 0, 0, 0.05);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
            transition: all 0.2s;
          }
          .schedule-item:hover {
            border-color: rgba(0, 0, 0, 0.1);
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
          }
        .schedule-item.completed {
          opacity: 0.6;
        }
        .color-bar {
          width: 4px;
          height: 40px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .content {
          flex: 1;
          min-width: 0;
        }
        .subject {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--cream-text-main);
          text-transform: capitalize;
        }
        .topic {
          display: block;
          font-size: 11px;
          color: var(--cream-text-muted);
          margin-top: 2px;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
        .time {
          display: block;
          font-size: 11px;
          color: var(--cream-text-muted);
          margin-top: 4px;
          font-weight: 600;
        }
        .status-badge {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #10B981;
        }
      `}</style>
    </div>
  )
}

// Component: GoalItem
function GoalItem({ title, progress, type, endDate }: {
  title: string
  progress: number
  type: string
  endDate: string
}) {
  const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <div className="goal-item">
      <div className="goal-header">
        <span className="title">{title}</span>
        <span className="type">{type}</span>
      </div>
      <div className="progress-bar">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="goal-footer">
        <span className="progress-text">{progress}% complete</span>
        <span className="days-left">{daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}</span>
      </div>
      <style jsx>{`
        .goal-item {
          background: var(--cream-bg);
          padding: 14px;
          border-radius: 14px;
        }
        .goal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .title {
          font-size: 13px;
          font-weight: 700;
          color: var(--cream-text-main);
        }
        .type {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--cream-text-muted);
          background: var(--cream-accent-soft);
          padding: 3px 8px;
          border-radius: 10px;
        }
        .progress-bar {
          height: 6px;
          background: rgba(0, 0, 0, 0.06);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .fill {
          height: 100%;
          background: linear-gradient(90deg, #5C67F2 0%, #4F46E5 100%);
          border-radius: 3px;
          transition: width 0.5s ease;
        }
        .goal-footer {
          display: flex;
          justify-content: space-between;
        }
        .progress-text, .days-left {
          font-size: 11px;
          color: var(--cream-text-muted);
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

// Component: SkillBar
function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="skill-bar">
      <div className="skill-header">
        <span className="label">{label}</span>
        <span className="value">{Math.round(value)}%</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${value}%` }} />
      </div>
      <style jsx>{`
        .skill-bar {
          width: 100%;
        }
        .skill-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .label {
          font-size: 12px;
          font-weight: 600;
          color: var(--cream-text-muted);
        }
        .value {
          font-size: 12px;
          font-weight: 700;
          color: var(--cream-text-main);
        }
        .bar-track {
          height: 6px;
          background: rgba(0, 0, 0, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #9333EA 0%, #7C3AED 100%);
          border-radius: 3px;
          transition: width 0.5s ease;
        }
      `}</style>
    </div>
  )
}
