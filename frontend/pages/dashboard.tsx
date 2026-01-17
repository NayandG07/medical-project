import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Check, Calendar, Clock, BookOpen, Brain, Activity, Heart, Wind, Zap, ChevronRight, Bell, MoreHorizontal, Sun, Trophy } from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/')
        return
      }

      setUser(session.user as AuthUser)
      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Preparing your workspace...</p>
        <style jsx>{`
          .loading-screen {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: var(--cream-bg);
            gap: 16px;
          }
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--cream-accent-soft);
            border-top-color: var(--cream-text-main);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          p {
            font-size: 14px;
            font-weight: 600;
            color: var(--cream-text-muted);
          }
        `}</style>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const illustrationsUrl = 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-pL6xX6Z4hE9G8A8RzE9G8A8R/user-pL6xX6Z4hE9G8A8RzE9G8A8R/img-GzNf0Z0Z0Z0Z0Z0Z0Z0Z0Z0.png' // This is a placeholder, I should use the path to the generated image if possible, but actually I'll just use the illustration set image I generated if I can get its local path.
  // Wait, I can't easily reference the local path in a way that works for the user's browser unless it's in the public folder.
  // I'll use colors and icons for now, and maybe simple SVGs.

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
              <h1>Good day, {user.user_metadata?.name || user.email?.split('@')[0]}</h1>
              <p>Continue your journey towards clinical excellence.</p>
            </header>

            {/* Top Stats Grid */}
            <div className="stats-grid">
              <StatCard
                icon={<Check size={20} />}
                value="106"
                label="Correct MCQs"
                color="#0D9488"
                bgColor="#F0FDFA"
              />
              <StatCard
                icon={<BookOpen size={20} />}
                value="38"
                label="Cases Completed"
                color="#5C67F2"
                bgColor="#EDEEFF"
              />
              <StatCard
                icon={<Activity size={20} />}
                value="35"
                label="OSCE Sessions"
                color="#9333EA"
                bgColor="#F5F3FF"
              />
              <StatCard
                icon={<Sun size={20} />}
                value="Level 4"
                label="Daily Streak: 12"
                color="#D97706"
                bgColor="#FFF7ED"
              />
            </div>

            {/* Resume Study Section */}
            <section className="resume-section">
              <div className="section-header">
                <h2>Active Learning</h2>
                <button className="icon-btn focus:outline-none"><MoreHorizontal size={20} /></button>
              </div>
              <div className="resume-grid">
                <ResumeCard
                  icon={<Zap size={18} />}
                  title="MCQs"
                  accuracy="72% Accuracy"
                  tokens="+100 Tokens"
                  color="#0D9488"
                  bgColor="#F0FDFA"
                />
                <ResumeCard
                  icon={<BookOpen size={18} />}
                  title="Flashcards"
                  accuracy="28% Progress"
                  tokens="+20 Tokens"
                  color="#5C67F2"
                  bgColor="#EDEEFF"
                />
                <ResumeCard
                  icon={<Heart size={18} />}
                  title="Clinical Cases"
                  accuracy="3/5 Active"
                  tokens="+50 Tokens"
                  color="#EA4335"
                  bgColor="#FEF2F2"
                />
              </div>
              <div className="resume-footer">
                <div className="token-info">
                  <span className="token-icon">💎</span>
                  <span>1,520 Tokens Collected This Month</span>
                </div>
                <button className="generate-btn">New Session</button>
              </div>
            </section>

            {/* High Yield Summaries Section */}
            <section className="summaries-section">
              <div className="section-header">
                <h2>High-Yield Insights</h2>
              </div>
              <div className="summaries-grid">
                <HighYieldCard
                  title="Myocardial Infarction"
                  desc="Focus on ECG patterns and acute management steps."
                  illustration="❤️"
                  accent="#FFF1F0"
                />
                <HighYieldCard
                  title="Asthma Management"
                  desc="GINA 2024 updates and step-wise therapy."
                  illustration="🫁"
                  accent="#F0F7FF"
                />
                <HighYieldCard
                  title="CKD Stages"
                  desc="Classification, GFR calculation, and complication management."
                  illustration="🫀"
                  accent="#F9F5FF"
                />
                <HighYieldCard
                  title="Stroke Assessment"
                  desc="FAST+ score and thrombolysis windows."
                  illustration="🧠"
                  accent="#F0FFF4"
                />
              </div>
            </section>
          </div>

          {/* Right Sidebar Area */}
          <aside className="right-sidebar">
            <div className="sidebar-card">
              <div className="sidebar-header">
                <Calendar size={20} className="header-icon" />
                <h3>Today's Checklist</h3>
              </div>
              <div className="task-list">
                <TaskItem label="Cardiovascular Phys" color="#EF4444" />
                <TaskItem label="Review ECG Basics" color="#3B82F6" checked />
                <TaskItem label="COPD Case Study" color="#10B981" />
                <TaskItem label="Antibiotic Ladder" color="#F59E0B" />
              </div>
              <div className="scheduled-next">
                <Clock size={16} />
                <span>Next Session: 14:00 PM</span>
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-header">
                <h3>Performance Trends</h3>
              </div>
              <div className="chart-placeholder">
                <div className="chart-line"></div>
                <div className="chart-line-2"></div>
                <div className="chart-labels">
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                </div>
              </div>
              <div className="mini-stats">
                <ProgressCheck label="Pathology Mastery" checked />
                <ProgressCheck label="Pharmacology" checked />
                <ProgressCheck label="Clinical Skills" checked />
              </div>
            </div>

            <div className="sidebar-card promo-card">
              <Trophy size={32} className="mb-4 text-[var(--cream-text-main)]" />
              <h3>Unlock Pro Features</h3>
              <p>Get access to personalized AI tutoring and unlimited clinical cases.</p>
              <button className="upgrade-link">View Pricing</button>
            </div>
          </aside>
        </div>

        <style jsx>{`
          .dashboard-container {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 32px;
            max-width: 1400px;
            margin: 0 auto;
            padding-bottom: 40px;
          }

          @media (max-width: 1100px) {
            .dashboard-container {
              grid-template-columns: 1fr;
            }
          }

          .welcome-header h1 {
            font-size: 36px;
            font-weight: 800;
            color: var(--cream-text-main);
            margin: 0 0 8px 0;
            letter-spacing: -0.04em;
          }

          .welcome-header p {
            font-size: 16px;
            color: var(--cream-text-muted);
            margin: 0 0 40px 0;
            font-weight: 500;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }

          .section-header h2 {
            font-size: 20px;
            font-weight: 800;
            color: var(--cream-text-main);
            margin: 0;
            letter-spacing: -0.02em;
          }

          .icon-btn {
            background: none;
            border: none;
            color: #64748B;
            cursor: pointer;
            padding: 4px;
            border-radius: 6px;
            transition: background 0.2s;
          }

          .icon-btn:hover {
            background: #F1F5F9;
          }

          .resume-section {
            background: var(--cream-card);
            border-radius: 32px;
            padding: 32px;
            box-shadow: 0 4px 32px rgba(0, 0, 0, 0.02);
            margin-bottom: 40px;
            border: 1px solid rgba(0, 0, 0, 0.05);
          }

          .resume-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 32px;
          }

          @media (max-width: 640px) {
            .resume-grid {
              grid-template-columns: 1fr;
            }
          }

          .resume-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            background: var(--cream-accent-soft);
            border-radius: 20px;
            border: 1px solid rgba(0, 0, 0, 0.05);
          }

          .token-info {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            font-weight: 700;
            color: var(--cream-text-main);
          }

          .generate-btn {
            background: var(--cream-text-main);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 14px;
            font-weight: 800;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1);
          }

          .generate-btn:hover {
            background: black;
            transform: translateY(-1px);
          }

          .summaries-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 24px;
          }

          /* Sidebar Styles */
          .sidebar-card {
            background: var(--cream-card);
            border-radius: 32px;
            padding: 28px;
            margin-bottom: 24px;
            box-shadow: 0 4px 32px rgba(0, 0, 0, 0.02);
            border: 1px solid rgba(0, 0, 0, 0.05);
          }

          .promo-card {
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
          }

          .promo-card h3 {
             font-size: 18px;
             font-weight: 800;
             margin-bottom: 12px;
          }

          .promo-card p {
             font-size: 13px;
             color: var(--cream-text-muted);
             margin-bottom: 20px;
             line-height: 1.5;
             font-weight: 500;
          }

          .upgrade-link {
            background: var(--cream-text-main);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
          }

          .sidebar-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
          }

          .sidebar-header h3 {
            font-size: 16px;
            font-weight: 800;
            color: var(--cream-text-main);
            margin: 0;
          }

          .header-icon {
            color: var(--cream-text-main);
          }

          .task-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .scheduled-next {
            margin-top: 24px;
            padding: 14px;
            background: var(--cream-accent-soft);
            border-radius: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: var(--cream-text-muted);
            border: 1px dashed var(--cream-accent);
            font-weight: 600;
          }

          .chart-placeholder {
            height: 140px;
            position: relative;
            margin-bottom: 24px;
            background: linear-gradient(180deg, rgba(232, 217, 192, 0.2) 0%, transparent 100%);
            border-radius: 16px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 0 10px;
          }

          .chart-line {
            height: 3px;
            background: var(--cream-text-main);
            width: 100%;
            position: relative;
            filter: drop-shadow(0 0 8px rgba(0,0,0,0.1));
            border-radius: 4px;
          }

          .chart-line-2 {
            height: 2px;
            background: #D4C3A3;
            width: 100%;
            margin-top: 20px;
            opacity: 0.5;
          }

          .chart-labels {
            display: flex;
            justify-content: space-between;
            margin-top: auto;
            padding-bottom: 8px;
            font-size: 10px;
            color: var(--cream-text-muted);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .mini-stats {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
        `}</style>
      </DashboardLayout>
    </>
  )
}

function StatCard({ icon, value, label, color, bgColor, isProgress }: any) {
  return (
    <div className="stat-card">
      <div className="icon-container" style={{
        backgroundColor: bgColor,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <div className="stat-info">
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
      <style jsx>{`
        .stat-card {
          background: var(--cream-card);
          padding: 24px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          gap: 18px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.04);
        }
        .icon-container {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .icon-container :global(svg) {
          display: block;
        }
        .stat-info h3 {
          font-size: 22px;
          font-weight: 800;
          color: var(--cream-text-main);
          margin: 0;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .stat-info p {
          font-size: 13px;
          color: var(--cream-text-muted);
          margin: 4px 0 0 0;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

function ResumeCard({ icon, title, accuracy, tokens, color, bgColor }: any) {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <div
      className="resume-card"
      style={{ borderColor: isHovered ? color : '#F3F1ED' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="card-top">
        <div className="icon-box" style={{
          backgroundColor: bgColor,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {icon}
        </div>
        <div className="title-area">
          <h3>{title}</h3>
          <p className="accuracy">
            {accuracy}
          </p>
        </div>
      </div>
      <div className="card-bottom">
        <span className="token-label" style={{ color: color }}>{tokens}</span>
      </div>
      <style jsx>{`
        .resume-card {
          padding: 24px;
          border-radius: 20px;
          border: 1.5px solid rgba(0, 0, 0, 0.05);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          background-color: var(--cream-card);
        }
        .card-top {
          display: flex;
          gap: 14px;
          margin-bottom: 16px;
        }
        .icon-box {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .icon-box :global(svg) {
          display: block;
        }
        .title-area h3 {
          font-size: 15px;
          font-weight: 800;
          color: var(--cream-text-main);
          margin: 0 0 4px 0;
        }
        .accuracy {
          font-size: 12px;
          font-weight: 600;
          color: var(--cream-text-muted);
          margin: 0;
        }
        .token-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  )
}

function HighYieldCard({ title, desc, illustration, accent }: any) {
  return (
    <div className="summary-card" style={{ backgroundColor: accent }}>
      <div className="card-content">
        <h3>{title}</h3>
        <p>{desc}</p>
        <div className="illustration-placeholder">
          <span className="emoji">{illustration}</span>
        </div>
      </div>
      <style jsx>{`
        .summary-card {
          border-radius: 24px;
          padding: 28px;
          height: 240px;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: 1px solid rgba(0,0,0,0.03);
        }
        .summary-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.05);
        }
        .summary-card h3 {
          font-size: 18px;
          font-weight: 900;
          color: var(--cream-text-main);
          margin: 0 0 10px 0;
          max-width: 140px;
          line-height: 1.2;
          letter-spacing: -0.03em;
        }
        .summary-card p {
          font-size: 13px;
          color: var(--cream-text-muted);
          margin: 0;
          max-width: 160px;
          line-height: 1.5;
          font-weight: 600;
        }
        .illustration-placeholder {
          position: absolute;
          bottom: -15px;
          right: -15px;
          width: 130px;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
        }
        .emoji {
          font-size: 80px;
          filter: drop-shadow(0 10px 20px rgba(0,0,0,0.1));
          transition: transform 0.5s ease;
        }
        .summary-card:hover .emoji {
          transform: scale(1.15) rotate(8deg);
          opacity: 1;
        }
      `}</style>
    </div>
  )
}

function TaskItem({ label, color, checked = false }: any) {
  const [isChecked, setIsChecked] = useState(checked)
  return (
    <div className="task-item" onClick={() => setIsChecked(!isChecked)}>
      <div className={`checkbox ${isChecked ? 'checked' : ''}`} style={{ borderColor: isChecked ? color : '#E8D9C0', backgroundColor: isChecked ? color : 'transparent' }}>
        {isChecked && <Check size={12} color="white" strokeWidth={4} />}
      </div>
      <span className={isChecked ? 'strikethrough' : ''}>{label}</span>
      <div className="tag-dot" style={{ backgroundColor: color }}></div>
      <style jsx>{`
        .task-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .task-item:hover {
          background: #FDFBF7;
        }
        .checkbox {
          width: 22px;
          height: 22px;
          border-radius: 8px;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .task-item span {
          flex: 1;
          font-size: 14px;
          font-weight: 700;
          color: var(--cream-text-main);
        }
        .strikethrough {
          text-decoration: line-through;
          color: var(--cream-text-muted) !important;
          opacity: 0.6;
        }
        .tag-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
      `}</style>
    </div>
  )
}

function ProgressCheck({ label, checked }: any) {
  return (
    <div className="progress-check">
      <div className="check-box">
        <Check size={12} color="#10B981" strokeWidth={4} />
      </div>
      <span>{label}</span>
      <style jsx>{`
        .progress-check {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .check-box {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          background: #F0FDFA;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .progress-check span {
          font-size: 13px;
          color: var(--cream-text-muted);
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

function StatItem({ label, count, color }: any) {
  return (
    <div className="stat-item">
      <div className="label-group">
        <Check size={14} color={color} strokeWidth={3} />
        <span>{label} ({count})</span>
      </div>
      <style jsx>{`
        .stat-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 0;
        }
        .label-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .label-group span {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }
      `}</style>
    </div>
  )
}
