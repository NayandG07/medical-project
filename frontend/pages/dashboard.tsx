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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#F8F9FD' }}>
        <p>Loading premium experience...</p>
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
        <title>Dashboard - Pramana Med</title>
        <meta name="description" content="Your premium medical study dashboard" />
      </Head>

      <DashboardLayout user={user}>
        <div className="dashboard-container">
          {/* Main Content Area */}
          <div className="main-area">
            {/* Welcome Section */}
            <header className="welcome-header">
              <h1>Welcome back, {user.user_metadata?.name || user.email?.split('@')[0]}!</h1>
              <p>Ready to study? Here's your current progress and today's tasks.</p>
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
                color="#2563EB"
                bgColor="#EFF6FF"
              />
              <StatCard
                icon={<Activity size={20} />}
                value="35"
                label="OSCE Sessions"
                color="#7C3AED"
                bgColor="#F5F3FF"
              />
              <StatCard
                icon={<Sun size={20} />}
                value="Progress"
                label="Daily Goal"
                isProgress
                color="#EA580C"
                bgColor="#FFF7ED"
              />
            </div>

            {/* Resume Study Section */}
            <section className="resume-section">
              <div className="section-header">
                <h2>Resume Study</h2>
                <button className="icon-btn"><MoreHorizontal size={20} /></button>
              </div>
              <div className="resume-grid">
                <ResumeCard
                  icon={<Zap size={18} />}
                  title="MCQs"
                  accuracy="72% Accuracy"
                  tokens="+100 Tokens Earned"
                  color="#0D9488"
                  bgColor="#F0FDFA"
                />
                <ResumeCard
                  icon={<BookOpen size={18} />}
                  title="Flashcards"
                  accuracy="28% Progress"
                  tokens="+20 Tokens Earned"
                  color="#2563EB"
                  bgColor="#EFF6FF"
                />
                <ResumeCard
                  icon={<Heart size={18} />}
                  title="Clinical Cases"
                  accuracy="Study Casework"
                  tokens="+5 Tokens Earned"
                  color="#EA580C"
                  bgColor="#FFF7ED"
                />
              </div>
              <div className="resume-footer">
                <div className="token-info">
                  <span className="token-icon">🪙</span>
                  <span>+50 Tokens Earned This Week</span>
                </div>
                <button className="generate-btn">Generate Topics</button>
              </div>
            </section>

            {/* High Yield Summaries Section */}
            <section className="summaries-section">
              <div className="section-header">
                <h2>High Yield Summaries</h2>
              </div>
              <div className="summaries-grid">
                <HighYieldCard
                  title="Myocardial Infarction"
                  desc="Covers high-yield insights in o heart attacks"
                  illustration="❤️"
                  accent="#FEE2E2"
                />
                <HighYieldCard
                  title="Asthma"
                  desc="Triggers, Treatments, key signs"
                  illustration="🫁"
                  accent="#DBEAFE"
                />
                <HighYieldCard
                  title="Pulmonary Embolism"
                  desc="Symptoms, Diagnosis & recurrence rate"
                  illustration="🫀"
                  accent="#F3E8FF"
                />
                <HighYieldCard
                  title="Stroke"
                  desc="Rapid assessment and treatment"
                  illustration="🧠"
                  accent="#E0F2FE"
                />
              </div>
            </section>
          </div>

          {/* Right Sidebar Area */}
          <aside className="right-sidebar">
            <div className="sidebar-card">
              <div className="sidebar-header">
                <Calendar size={20} className="header-icon" />
                <h3>Today's Tasks</h3>
              </div>
              <div className="task-list">
                <TaskItem label="Cardiovascular Physiology" color="#EF4444" />
                <TaskItem label="ECG Basics" color="#3B82F6" checked />
                <TaskItem label="Casework COPD" color="#10B981" />
                <TaskItem label="Pulmonology Flashcards" color="#F59E0B" />
              </div>
              <div className="scheduled-next">
                <Clock size={16} />
                <span>Scheduled next: Image</span>
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-header">
                <h3>Progress Tracker</h3>
              </div>
              <div className="chart-placeholder">
                <div className="chart-line"></div>
                <div className="chart-line-2"></div>
                <div className="chart-labels">
                  <span>April 12</span>
                  <span>April 14</span>
                  <span>April 15</span>
                </div>
              </div>
              <div className="mini-stats">
                <ProgressCheck label="Cardiovascular Physiology" checked />
                <ProgressCheck label="ECG Basics" checked />
                <ProgressCheck label="Casework COPD" checked />
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-header">
                <h3>Flashcard Stats</h3>
              </div>
              <div className="stats-list">
                <StatItem label="Asthma" count={4} color="#3B82F6" />
                <StatItem label="Dermatology" count={3} color="#10B981" />
                <StatItem label="Pharmacology" count={5} color="#F59E0B" />
                <StatItem label="Cardiology" count={4} color="#EF4444" />
                <StatItem label="Neurology" count={2} color="#8B5CF6" />
              </div>
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
          }

          @media (max-width: 1100px) {
            .dashboard-container {
              grid-template-columns: 1fr;
            }
          }

          .welcome-header h1 {
            font-size: 32px;
            font-weight: 800;
            color: #1E293B;
            margin: 0 0 8px 0;
            letter-spacing: -0.025em;
          }

          .welcome-header p {
            font-size: 16px;
            color: #64748B;
            margin: 0 0 32px 0;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .section-header h2 {
            font-size: 20px;
            font-weight: 700;
            color: #1E293B;
            margin: 0;
          }

          .icon-btn {
            background: none;
            border: none;
            color: #94A3B8;
            cursor: pointer;
            padding: 4px;
            border-radius: 6px;
            transition: background 0.2s;
          }

          .icon-btn:hover {
            background: #F1F5F9;
          }

          .resume-section {
            background: white;
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
            margin-bottom: 32px;
            border: 1px solid rgba(0, 0, 0, 0.03);
          }

          .resume-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 24px;
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
            padding: 16px;
            background: #F8FAFC;
            border-radius: 16px;
          }

          .token-info {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #64748B;
          }

          .generate-btn {
            background: #6366F1;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }

          .generate-btn:hover {
            background: #4F46E5;
            transform: translateY(-1px);
          }

          .summaries-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
          }

          /* Sidebar Styles */
          .sidebar-card {
            background: white;
            border-radius: 24px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(0, 0, 0, 0.03);
          }

          .sidebar-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
          }

          .sidebar-header h3 {
            font-size: 16px;
            font-weight: 700;
            color: #1E293B;
            margin: 0;
          }

          .header-icon {
            color: #6366F1;
          }

          .task-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .scheduled-next {
            margin-top: 20px;
            padding: 12px;
            background: #F8FAFC;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #94A3B8;
            border: 1px dashed #E2E8F0;
          }

          .chart-placeholder {
            height: 140px;
            position: relative;
            margin-bottom: 20px;
            background: linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%);
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 0 10px;
          }

          .chart-line {
            height: 2px;
            background: #6366F1;
            width: 100%;
            position: relative;
            filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.5));
          }

          .chart-line-2 {
            height: 2px;
            background: #10B981;
            width: 100%;
            margin-top: 20px;
            opacity: 0.5;
          }

          .chart-labels {
            display: flex;
            justify-content: space-between;
            margin-top: auto;
            padding-bottom: 5px;
            font-size: 10px;
            color: #94A3B8;
            font-weight: 600;
          }

          .mini-stats {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .stats-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
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
          background: white;
          padding: 16px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.02);
          transition: transform 0.2s;
        }
        .stat-card:hover {
          transform: translateY(-2px);
        }
        .icon-container {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .icon-container :global(svg) {
          display: block;
        }
        .stat-info h3 {
          font-size: 20px;
          font-weight: 800;
          color: #1E293B;
          margin: 0;
          line-height: 1.2;
        }
        .stat-info p {
          font-size: 13px;
          color: #64748B;
          margin: 0;
          font-weight: 500;
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
      style={{ borderColor: isHovered ? color : '#E2E8F0' }}
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
            <Check size={12} strokeWidth={3} /> {accuracy}
          </p>
        </div>
      </div>
      <div className="card-bottom">
        <span className="token-label" style={{ color: color }}>{tokens}</span>
      </div>
      <style jsx>{`
        .resume-card {
          padding: 16px;
          border-radius: 16px;
          border: 1.5px solid #F1F5F9;
          transition: all 0.2s;
          cursor: pointer;
        }
        .card-top {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .icon-box {
          width: 36px;
          height: 36px;
          border-radius: 10px;
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
          font-weight: 700;
          color: #1E293B;
          margin: 0 0 2px 0;
        }
        .accuracy {
          font-size: 12px;
          font-weight: 600;
          color: #64748B;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .token-label {
          font-size: 11px;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}

function HighYieldCard({ title, desc, illustration, accent }: any) {
  return (
    <div className="summary-card">
      <div className="card-content">
        <h3>{title}</h3>
        <p>{desc}</p>
        <div className="illustration-placeholder">
          <span className="emoji">{illustration}</span>
        </div>
      </div>
      <style jsx>{`
        .summary-card {
          background: ${accent};
          border-radius: 20px;
          padding: 24px;
          height: 240px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: 1px solid rgba(0, 0, 0, 0.05);
        }
        .summary-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05);
        }
        .summary-card h3 {
          font-size: 18px;
          font-weight: 800;
          color: #1E293B;
          margin: 0 0 8px 0;
          max-width: 140px;
          line-height: 1.2;
        }
        .summary-card p {
          font-size: 13px;
          color: #475569;
          margin: 0;
          max-width: 160px;
          line-height: 1.4;
          font-weight: 500;
        }
        .illustration-placeholder {
          position: absolute;
          bottom: -10px;
          right: -10px;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .emoji {
          font-size: 70px;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1));
          transition: transform 0.3s;
        }
        .summary-card:hover .emoji {
          transform: scale(1.1) rotate(5deg);
        }
      `}</style>
    </div>
  )
}

function TaskItem({ label, color, checked = false }: any) {
  const [isChecked, setIsChecked] = useState(checked)
  return (
    <div className="task-item" onClick={() => setIsChecked(!isChecked)}>
      <div className={`checkbox ${isChecked ? 'checked' : ''}`} style={{ borderColor: isChecked ? color : '#CBD5E1', backgroundColor: isChecked ? color : 'transparent' }}>
        {isChecked && <Check size={12} color="white" strokeWidth={4} />}
      </div>
      <span className={isChecked ? 'strikethrough' : ''}>{label}</span>
      <div className="tag-dot" style={{ backgroundColor: color }}></div>
      <style jsx>{`
        .task-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .task-item:hover {
          background: #F8FAFC;
        }
        .checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .task-item span {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }
        .strikethrough {
          text-decoration: line-through;
          color: #94A3B8 !important;
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
          gap: 10px;
        }
        .check-box {
          width: 18px;
          height: 18px;
          border-radius: 5px;
          background: #F0FDFA;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .progress-check span {
          font-size: 13px;
          color: #64748B;
          font-weight: 500;
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
          color: #475569;
        }
      `}</style>
    </div>
  )
}
