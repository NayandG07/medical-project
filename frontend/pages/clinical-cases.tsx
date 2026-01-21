import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

// Types
interface CaseStage {
  stage: number
  title: string
  content: string
  question: string
}

interface VisibleCaseData {
  patient_demographics?: Record<string, any>
  chief_complaint?: string
  history_of_present_illness?: Record<string, any>
  past_medical_history?: Record<string, any>
  family_history?: Record<string, any>
  social_history?: Record<string, any>
  vital_signs?: Record<string, any>
  physical_examination?: Record<string, any>
  initial_investigations?: Record<string, any>
}

interface CaseData {
  case_id: string
  completed: boolean
  current_stage: number
  stage_data: CaseStage | null
  total_stages: number
  visible_case_data?: VisibleCaseData
  progress_percentage?: number
}

interface EvaluationResult {
  score: number
  feedback: string
  strengths: string[]
  improvements: string[]
  model_answer: string
  clinical_tips?: string[]
  advance_stage?: boolean
}

interface StepResult {
  evaluation: EvaluationResult
  step_number: number
  stage_advanced: boolean
}

// Specialties
// Specialties with IDs and Subtitles for a more premium look
const SPECIALTIES = [
  { id: 'general_medicine', code: 'CC-01', name: 'Medicine', icon: '🩺', subtitle: 'General diagnosis & management' },
  { id: 'cardiology', code: 'CC-02', name: 'Cardiology', icon: '❤️', subtitle: 'Heart & vascular disorders' },
  { id: 'pulmonology', code: 'CC-03', name: 'Pulmonology', icon: '🫁', subtitle: 'Respiratory system cases' },
  { id: 'gastroenterology', code: 'CC-04', name: 'Gastroenterology', icon: '🔬', subtitle: 'Digestive system medicine' },
  { id: 'neurology', code: 'CC-05', name: 'Neurology', icon: '🧠', subtitle: 'Central/peripheral nervous system' },
  { id: 'nephrology', code: 'CC-06', name: 'Nephrology', icon: '🫘', subtitle: 'Renal & electrolyte issues' },
  { id: 'endocrinology', code: 'CC-07', name: 'Endocrinology', icon: '⚡', subtitle: 'Hormonal & metabolic health' },
  { id: 'infectious_disease', code: 'CC-08', name: 'Infectious', icon: '🦠', subtitle: 'Pathogens & acute therapy' },
  { id: 'emergency_medicine', code: 'CC-09', name: 'Emergency', icon: '🚑', subtitle: 'Critical care & trauma' },
  { id: 'pediatrics', code: 'CC-10', name: 'Pediatrics', icon: '👶', subtitle: 'Child and neonatal health' },
  { id: 'surgery', code: 'CC-11', name: 'Surgery', icon: '🔪', subtitle: 'Pre-op and post-op care' },
  { id: 'orthopedics', code: 'CC-12', name: 'Orthopedics', icon: '🦴', subtitle: 'Muscles and bone health' },
]

const DIFFICULTIES = [
  { id: 'beginner', name: 'Beginner', desc: 'Classic presentations, single diagnosis', color: '#10B981' },
  { id: 'intermediate', name: 'Intermediate', desc: '3-4 differentials, some atypical features', color: '#F59E0B' },
  { id: 'advanced', name: 'Advanced', desc: 'Complex cases, comorbidities', color: '#EF4444' },
  { id: 'expert', name: 'Expert', desc: 'Rare conditions, diagnostic uncertainty', color: '#8B5CF6' },
]

const STEP_TYPES = [
  { id: 'history_question', name: 'Ask History', icon: '📋' },
  { id: 'examination_request', name: 'Physical Exam', icon: '👨‍⚕️' },
  { id: 'investigation_request', name: 'Investigations', icon: '🔬' },
  { id: 'problem_representation', name: 'Problem Summary', icon: '📝' },
  { id: 'differential_generation', name: 'Differentials', icon: '🎯' },
  { id: 'diagnostic_justification', name: 'Justify Diagnosis', icon: '✅' },
  { id: 'management_plan', name: 'Management', icon: '💊' },
]

export default function ClinicalCases() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Case creation state
  const [showCaseSetup, setShowCaseSetup] = useState(true)
  const [selectedSpecialty, setSelectedSpecialty] = useState('general_medicine')
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate')

  // Active case state
  const [activeCase, setActiveCase] = useState<CaseData | null>(null)
  const [userInput, setUserInput] = useState('')
  const [selectedStepType, setSelectedStepType] = useState('history_question')

  // Evaluation state
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null)
  const [showEvaluation, setShowEvaluation] = useState(false)

  // Completion state
  const [caseCompleted, setCaseCompleted] = useState(false)
  const [completionData, setCompletionData] = useState<any>(null)

  // Timer
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const conversationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight
    }
  }, [activeCase, lastEvaluation])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    setUser(session.user as AuthUser)
    setLoading(false)
  }

  const startTimer = () => {
    setElapsedTime(0)
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startCase = async () => {
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          specialty: selectedSpecialty,
          difficulty: selectedDifficulty,
          case_type: 'clinical_reasoning'
        })
      })

      if (!response.ok) throw new Error('Failed to create case')

      const caseData = await response.json()

      // Fetch the case stage data
      const stageResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${caseData.id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!stageResponse.ok) throw new Error('Failed to get case stage')

      const stageData = await stageResponse.json()
      setActiveCase(stageData)
      setShowCaseSetup(false)
      startTimer()
    } catch (error) {
      console.error('Failed to start case:', error)
      alert('Failed to generate case. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const submitStep = async () => {
    if (!userInput.trim() || !activeCase) return

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}/steps`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            step_type: selectedStepType,
            user_input: userInput
          })
        }
      )

      if (!response.ok) throw new Error('Failed to submit step')

      const result: StepResult = await response.json()
      setLastEvaluation(result.evaluation)
      setShowEvaluation(true)
      setUserInput('')

      // Refresh case data if stage advanced
      if (result.stage_advanced) {
        const stageResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )
        if (stageResponse.ok) {
          const stageData = await stageResponse.json()
          setActiveCase(stageData)
        }
      }
    } catch (error) {
      console.error('Failed to submit step:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const advanceStage = async () => {
    if (!activeCase) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}/advance`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!response.ok) throw new Error('Failed to advance stage')

      const stageData = await response.json()
      setActiveCase(stageData)
      setShowEvaluation(false)
      setLastEvaluation(null)
    } catch (error) {
      console.error('Failed to advance stage:', error)
    }
  }

  const completeCase = async () => {
    if (!activeCase) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}/complete`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!response.ok) throw new Error('Failed to complete case')

      const result = await response.json()
      setCompletionData(result)
      setCaseCompleted(true)
      if (timerRef.current) clearInterval(timerRef.current)
    } catch (error) {
      console.error('Failed to complete case:', error)
    }
  }

  const resetCase = () => {
    setActiveCase(null)
    setShowCaseSetup(true)
    setCaseCompleted(false)
    setCompletionData(null)
    setLastEvaluation(null)
    setShowEvaluation(false)
    setUserInput('')
    setElapsedTime(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const renderDataSection = (title: string, data: Record<string, any> | undefined, icon: string) => {
    if (!data || Object.keys(data).length === 0) return null

    return (
      <div className="data-section">
        <h4>{icon} {title}</h4>
        <div className="data-content">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="data-item">
              <span className="data-label">{key.replace(/_/g, ' ')}:</span>
              <span className="data-value">
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading || !user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Clinical Reasoning Engine...</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Clinical Cases - Vaidya AI</title>
        <meta name="description" content="Practice clinical reasoning with structured patient cases" />
      </Head>
      <DashboardLayout user={user}>
        <div className="clinical-container" data-station-active={activeCase && !caseCompleted ? "true" : "false"}>
          {/* Case Setup View */}
          {showCaseSetup && !activeCase && (
            <div className="setup-view">
              <div className="setup-grid">
                {/* Specialty Selection */}
                <div className="setup-section">
                  <h3>SELECT SPECIALTY</h3>
                  <div className="specialty-grid">
                    {SPECIALTIES.map(spec => (
                      <button
                        key={spec.id}
                        className={`specialty-card ${selectedSpecialty === spec.id ? 'active' : ''}`}
                        onClick={() => setSelectedSpecialty(spec.id)}
                      >
                        <div className="card-top">
                          <span className="card-id">{spec.code}</span>
                          <span className="card-badge">ENGINE</span>
                        </div>
                        <div className="card-body">
                          <div className="card-icon-square">{spec.icon}</div>
                          <div className="card-info">
                            <span className="card-name">{spec.name}</span>
                            <span className="card-subtitle">{spec.subtitle}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Selection */}
                <div className="setup-section right-col">
                  <h3>SELECT DIFFICULTY</h3>
                  <div className="difficulty-track">
                    {DIFFICULTIES.map(diff => (
                      <button
                        key={diff.id}
                        className={`difficulty-btn ${selectedDifficulty === diff.id ? 'active' : ''}`}
                        onClick={() => setSelectedDifficulty(diff.id)}
                        style={{ '--diff-color': diff.color } as React.CSSProperties}
                      >
                        <div className="diff-info">
                          <span className="diff-name">{diff.name}</span>
                          <span className="diff-desc">{diff.desc}</span>
                        </div>
                        <span className="diff-arrow">→</span>
                      </button>
                    ))}
                  </div>

                  <div className="start-section-inline">
                    <button
                      className="start-button"
                      onClick={startCase}
                      disabled={generating}
                    >
                      {generating ? (
                        <>
                          <span className="spinner"></span>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          Start Clinical Case
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tips Section at Bottom */}
              <div className="setup-tips-card">
                <h3>💡 Clinical Reasoning Tips</h3>
                <div className="tips-grid">
                  <div className="tip-item">
                    <strong>Structured Thinking</strong>
                    <span>Approach cases methodically from history to plan.</span>
                  </div>
                  <div className="tip-item">
                    <strong>Differential Diagnosis</strong>
                    <span>Always consider at least 3-4 likely differentials.</span>
                  </div>
                  <div className="tip-item">
                    <strong>Evidence-Based</strong>
                    <span>Justify your decisions with clinical findings.</span>
                  </div>
                  <div className="tip-item">
                    <strong>Feedback Loop</strong>
                    <span>Review evaluations to identify thinking gaps.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Case View */}
          {activeCase && !caseCompleted && (
            <div className="case-view">
              {/* Case Header */}
              {/* Case Header - OSCE Style Command Bar */}
              <div className="case-header">
                <div className="header-left">
                  <div className="station-icon">📋</div>
                  <div className="station-info">
                    <h2>Clinical Case</h2>
                    <div className="case-meta">
                      <span className="meta-badge specialty">
                        {SPECIALTIES.find(s => s.id === selectedSpecialty)?.icon} {selectedSpecialty.replace(/_/g, ' ')}
                      </span>
                      <span className={`meta-badge difficulty ${selectedDifficulty}`}>
                        {selectedDifficulty}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="header-right">
                  <div className="timer-container">
                    <svg className="timer-ring" width="56" height="56">
                      <circle className="timer-ring-bg" cx="28" cy="28" r="24" />
                      <circle
                        className="timer-ring-progress"
                        cx="28" cy="28" r="24"
                        style={{
                          strokeDasharray: 2 * Math.PI * 24,
                          strokeDashoffset: (2 * Math.PI * 24) * 0.2 // Just a visual fill
                        }}
                      />
                    </svg>
                    <span className="timer-text">{formatTime(elapsedTime)}</span>
                  </div>
                  <div className="progress-info">
                    <span className="stage-label">Progress</span>
                    <span className="stage-value">Stage {(activeCase.current_stage || 0) + 1} / {activeCase.total_stages}</span>
                  </div>
                  <button className="end-button" onClick={resetCase}>End Case</button>
                </div>
              </div>

              {/* Progress Bar - Slimmed down and merged */}
              <div className="progress-bar-container merged">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${activeCase.progress_percentage || 0}%` }}
                />
              </div>

              {/* Main Content */}
              <div className="case-content">
                {/* Left Panel - Patient Data & Pathway */}
                <div className="left-column">
                  <div className="patient-panel">
                    <h3>👤 Patient Information</h3>

                    {activeCase.visible_case_data && (
                      <div className="patient-data minimal" data-lenis-prevent>
                        <div className="chief-complaint-mini">
                          <div className="complaint-label">Clinical Case:</div>
                          <div className="complaint-text">{activeCase.visible_case_data.chief_complaint}</div>
                        </div>

                        {activeCase.visible_case_data.patient_demographics && (
                          <div className="demographics-minimal">
                            <div className="demog-row labels">
                              <span>Age</span>
                              <span>Sex</span>
                            </div>
                            <div className="demog-row values">
                              <span className="age-val">{activeCase.visible_case_data.patient_demographics.age || activeCase.visible_case_data.patient_demographics.Age || '—'}</span>
                              <span className="sex-val">
                                {(() => {
                                  const s = activeCase.visible_case_data.patient_demographics.sex || activeCase.visible_case_data.patient_demographics.Sex || activeCase.visible_case_data.patient_demographics.gender || '—';
                                  return s === '—' ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
                                })()}
                              </span>
                            </div>
                            <div className="risk-factors-mini">
                              <strong>Risk Factors:</strong> {
                                (() => {
                                  let rf = activeCase.visible_case_data.patient_demographics.risk_factors ||
                                    activeCase.visible_case_data.patient_demographics.Risk_Factors ||
                                    activeCase.visible_case_data.patient_demographics['risk factors'];
                                  if (!rf) return 'None';
                                  if (Array.isArray(rf)) rf = rf.join(', ');
                                  return String(rf);
                                })()
                              }
                            </div>
                          </div>
                        )}

                        <div className="other-data-minimal">
                          {renderDataSection('HPI', activeCase.visible_case_data.history_of_present_illness, '📝')}
                          {renderDataSection('PMH', activeCase.visible_case_data.past_medical_history, '📁')}
                          {renderDataSection('Vitals', activeCase.visible_case_data.vital_signs, '💓')}
                          {renderDataSection('Exam', activeCase.visible_case_data.physical_examination, '🩺')}
                          {renderDataSection('Inv', activeCase.visible_case_data.initial_investigations, '🔬')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="clinical-pathway-card">
                    <h4 className="pathway-title">📋 Clinical Pathway</h4>
                    <div className="pathway-items" data-lenis-prevent>
                      {STEP_TYPES.map((step) => {
                        const isCurrent = step.id === selectedStepType;
                        return (
                          <div
                            key={step.id}
                            className={`pathway-item ${isCurrent ? 'active' : ''}`}
                            onClick={() => setSelectedStepType(step.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="pathway-icon-wrap">
                              <span className="step-icon">{step.icon}</span>
                            </div>
                            <span className="step-name">{step.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Panel - Interaction */}
                <div className="interaction-panel" data-lenis-prevent>
                  {/* Current Stage */}
                  {activeCase.stage_data && (
                    <div className="stage-card">
                      <div className="stage-header">
                        <span className="stage-number">Stage {activeCase.stage_data.stage}</span>
                        <h4>{activeCase.stage_data.title}</h4>
                      </div>
                      <p className="stage-content">{activeCase.stage_data.content}</p>
                      <div className="stage-question">
                        <strong>❓ {activeCase.stage_data.question}</strong>
                      </div>
                    </div>
                  )}

                  {/* Evaluation Display */}
                  {showEvaluation && lastEvaluation && (
                    <div className="evaluation-card">
                      <div className="evaluation-header">
                        <h4>📊 Evaluation</h4>
                        <div className="score-badge" style={{
                          backgroundColor: lastEvaluation.score >= 80 ? '#10B981' :
                            lastEvaluation.score >= 60 ? '#F59E0B' : '#EF4444'
                        }}>
                          {lastEvaluation.score}%
                        </div>
                      </div>

                      <p className="feedback-text">{lastEvaluation.feedback}</p>

                      <div className="feedback-grid">
                        {lastEvaluation.strengths?.length > 0 && (
                          <div className="feedback-section">
                            <h5>✅ Strengths</h5>
                            <ul>
                              {lastEvaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}

                        {lastEvaluation.improvements?.length > 0 && (
                          <div className="feedback-section">
                            <h5>📈 Areas for Improvement</h5>
                            <ul>
                              {lastEvaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>

                      {lastEvaluation.clinical_tips && lastEvaluation.clinical_tips.length > 0 && (
                        <div className="feedback-section tips">
                          <h5>💡 Clinical Tips</h5>
                          <ul>
                            {lastEvaluation.clinical_tips.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      )}

                      <div className="evaluation-actions">
                        <button className="continue-button" onClick={() => setShowEvaluation(false)}>
                          Continue Working
                        </button>
                        <button className="advance-button" onClick={advanceStage}>
                          Next Stage →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Input Section */}
                  {!showEvaluation && (
                    <div className="input-section">
                      <textarea
                        className="reasoning-input"
                        placeholder="Enter your clinical reasoning, questions, or decisions..."
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        rows={4}
                      />

                      <div className="input-footer">
                        <div className="submit-section">
                          <button
                            className="submit-button"
                            onClick={submitStep}
                            disabled={submitting || !userInput.trim()}
                          >
                            {submitting ? <span className="spinner"></span> : 'Submit'}
                          </button>
                          {activeCase.current_stage === activeCase.total_stages - 1 && (
                            <button className="complete-button" onClick={completeCase}>Complete Case</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Completion View */}
          {caseCompleted && completionData && (
            <div className="completion-view">
              <div className="completion-card">
                <div className="completion-header">
                  <div className="completion-icon">🎉</div>
                  <h2>Case Completed!</h2>
                </div>

                <div className="final-score">
                  <div className="score-circle" style={{
                    borderColor: completionData.final_score >= 80 ? '#10B981' :
                      completionData.final_score >= 60 ? '#F59E0B' : '#EF4444'
                  }}>
                    <span className="score-value">{completionData.final_score}</span>
                    <span className="score-label">%</span>
                  </div>
                  <p>Final Score</p>
                </div>

                <div className="completion-stats">
                  <div className="stat">
                    <span className="stat-value">{completionData.steps_completed}</span>
                    <span className="stat-label">Steps Completed</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatTime(elapsedTime)}</span>
                    <span className="stat-label">Time Taken</span>
                  </div>
                </div>

                <div className="diagnosis-reveal">
                  <h3>🎯 Final Diagnosis</h3>
                  <p className="diagnosis-text">{completionData.final_diagnosis}</p>
                  <p className="explanation-text">{completionData.explanation}</p>
                </div>

                <div className="completion-actions">
                  <button className="new-case-button" onClick={resetCase}>Start New Case</button>
                  <button className="dashboard-button" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
                </div>
              </div>
            </div>
          )}


          <style jsx>{`
          .clinical-container {
            max-width: 100%;
            width: 100%;
            margin: 0 auto;
            padding: 0;
            background: #fdfbf7;
            min-height: calc(100vh - 64px);
            display: flex;
            flex-direction: column;
          }

          .clinical-container[data-station-active="true"] {
            height: calc(100vh - 64px);
            overflow: hidden;
          }

          .loading-spinner, .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .setup-view {
            animation: fadeIn 0.5s ease;
            max-width: 1600px;
            margin: 0 auto;
            color: #1E293B;
            padding: 24px;
            flex: 1;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .setup-grid {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 24px;
            margin-bottom: 24px;
          }

          .setup-section h3 {
            font-size: 0.7rem;
            font-weight: 800;
            color: #64748B;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .specialty-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }

          .specialty-card {
            background: #F7F7F6;
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 16px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            text-align: left;
            position: relative;
            overflow: hidden;
          }

          .specialty-card:hover {
            transform: translateY(-2px);
            background: white;
            border-color: rgba(79, 70, 229, 0.2);
            box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.05);
          }

          .specialty-card.active {
            background: white;
            border-color: #4F46E5;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
          }

          .card-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .card-id {
            font-size: 0.65rem;
            font-weight: 800;
            color: #64748B;
            letter-spacing: 0.02em;
          }

          .card-badge {
            font-size: 0.6rem;
            font-weight: 800;
            padding: 2px 6px;
            background: rgba(79, 70, 229, 0.08);
            color: #4F46E5;
            border-radius: 4px;
            letter-spacing: 0.05em;
          }

          .card-body {
            display: flex;
            gap: 10px;
            align-items: center;
          }

          .card-icon-square {
            width: 36px;
            height: 36px;
            background: rgba(0, 0, 0, 0.03);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            transition: all 0.3s ease;
            flex-shrink: 0;
          }

          .specialty-card.active .card-icon-square {
            background: #4F46E5;
            color: white;
            transform: rotate(-5deg);
          }

          .card-info {
            display: flex;
            flex-direction: column;
            gap: 1px;
            min-width: 0;
          }

          .card-name {
            font-size: 0.85rem;
            font-weight: 800;
            color: #1E293B;
            letter-spacing: -0.01em;
          }

          .card-subtitle {
            font-size: 0.7rem;
            color: #64748B;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Difficulty Track */
          .difficulty-track {
            background: #F7F7F6;
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 18px;
            padding: 32px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
          }

          .difficulty-btn {
            width: 100%;
            padding: 10px 14px;
            background: rgba(0, 0, 0, 0.02);
            border: 1px solid transparent;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: left;
          }

          .difficulty-btn:hover {
            background: rgba(0, 0, 0, 0.04);
            color: #1E293B;
          }

          .difficulty-btn.active {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            background: white;
          }

          .diff-info {
            display: flex;
            flex-direction: column;
          }

          .diff-name {
            font-size: 0.8rem;
            font-weight: 800;
            color: #1F2937;
          }

          .diff-desc {
            font-size: 0.7rem;
            color: #6B7280;
            font-weight: 500;
          }

          .difficulty-btn.active .diff-name {
            color: var(--diff-color);
          }

          .diff-arrow {
            opacity: 0;
            transform: translateX(-5px);
            transition: all 0.2s ease;
            font-weight: bold;
            color: #4F46E5;
          }

          .difficulty-btn.active .diff-arrow {
            opacity: 1;
            transform: translateX(0);
          }

          .start-section-inline {
            margin-top: 12px;
          }

          .start-button {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 14px;
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            color: white;
            margin-top: 25px;
            border: none;
            border-radius: 16px;
            font-size: 0.95rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 8px 30px rgba(79, 70, 229, 0.3);
          }

          .start-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(79, 70, 229, 0.4);
          }

          /* Tips Card */
          .setup-tips-card {
            background: white;
            border: 1px solid rgba(0, 0, 0, 0.06);
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          }

          .setup-tips-card h3 {
            font-size: 0.9rem;
            font-weight: 800;
            color: #1E293B;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .tips-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }

          .tip-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
            background: rgba(0, 0, 0, 0.02);
            padding: 10px 14px;
            border-radius: 12px;
          }

          .tip-item strong {
            font-size: 0.75rem;
            color: #1E293B;
          }

          .tip-item span {
            font-size: 0.7rem;
            color: #64748B;
            line-height: 1.3;
          }

          @media (max-width: 1100px) {
            .setup-grid {
              grid-template-columns: 1fr;
            }
            .specialty-grid {
              grid-template-columns: repeat(2, 1fr);
            }
            .tips-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          /* Case View */
          .case-view {
            animation: fadeIn 0.5s ease;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding-bottom: 20px;
          }

          /* Case View Header - OSCE Style */
          .case-header {
            max-width: 96.5%;
            width: 100%;
            margin: 10px auto 0 auto;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 8px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            z-index: 100;
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .station-icon {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4rem;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            color: white;
          }

          .station-info h2 {
            font-size: 1.15rem;
            font-weight: 700;
            color: #1E293B;
            margin: 0;
            letter-spacing: -0.02em;
          }

          .case-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
          }

          .meta-badge {
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }

          .meta-badge.specialty {
            background: #EEF2FF;
            color: #4F46E5;
          }

          .meta-badge.difficulty {
             background: #EEF2FF;
             color: #4F46E5;
          }

          .meta-badge.difficulty.beginner {
            background: #D1FAE5;
            color: #059669;
          }

          .meta-badge.difficulty.intermediate {
            background: #FEF3C7;
            color: #D97706;
          }

          .meta-badge.difficulty.advanced {
            background: #FEE2E2;
            color: #DC2626;
          }
          
          .meta-badge.difficulty.expert {
            background: #F3E8FF;
            color: #7E22CE;
          }

          .header-right {
            display: flex;
            align-items: center;
            gap: 24px;
          }

          /* Circular Timer Style */
          .timer-container {
            position: relative;
            width: 56px;
            height: 56px;
          }

          .timer-ring {
            transform: rotate(-90deg);
          }

          .timer-ring-bg {
            fill: none;
            stroke: rgba(0, 0, 0, 0.06);
            stroke-width: 4;
          }

          .timer-ring-progress {
            fill: none;
            stroke: #10B981;
            stroke-width: 4;
            stroke-linecap: round;
            transition: stroke-dashoffset 1s linear;
          }

          .timer-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.75rem;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
            color: #1E293B;
          }

          .progress-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
          }

          .stage-label {
            font-size: 0.65rem;
            font-weight: 800;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .stage-value {
            font-size: 0.9rem;
            font-weight: 700;
            color: #1E293B;
          }

          .end-button {
            padding: 10px 20px;
            background: rgba(239, 68, 68, 0.1);
            color: #EF4444;
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .end-button:hover {
            background: #EF4444;
            color: white;
            border-color: #EF4444;
          }

          .progress-bar-container {
            height: 4px; /* Slimmer */
            background: rgba(0, 0, 0, 0.05);
            border-radius: 2px;
            max-width: 1600px;
            margin: 0 auto 16px auto;
            overflow: hidden;
          }

          .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4F46E5 0%, #764ba2 100%);
            border-radius: 2px;
            transition: width 0.3s ease;
          }

          .case-content {
            display: grid;
            grid-template-columns: 280px 1fr;
            gap: 16px;
            align-items: stretch;
            flex: 1;
            overflow: hidden;
            margin-top: 12px;
            padding: 0 20px 20px 20px;
          }

          .left-column {
             display: flex;
             flex-direction: column;
             gap: 16px;
             height: 100%;
             overflow: hidden;
             padding-right: 4px;
          }

          .patient-panel {
            background: white;
            border-radius: 12px;
            padding: 10px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            font-size: 0.7rem;
            display: flex;
            flex-direction: column;
            max-height: 55%;
            min-height: 0;
          }

          .patient-panel h3 {
            font-size: 0.6rem;
            font-weight: 800;
            color: #94A3B8;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .patient-data.minimal {
            overflow-y: auto;
            flex: 1;
            padding-right: 4px;
          }

          .chief-complaint-mini {
             background: #FFFBEB;
             border-left: 3px solid #F59E0B;
             padding: 8px 10px;
             border-radius: 4px;
             margin-bottom: 12px;
             display: flex;
             flex-direction: column;
             gap: 4px;
          }
          
          .complaint-label {
             font-weight: 800;
             color: #B45309;
             font-size: 0.6rem;
             text-transform: uppercase;
          }
          
          .complaint-text {
             color: #92400E;
             font-weight: 600;
             font-size: 0.8rem;
          }
          
          .demographics-minimal {
             display: flex;
             flex-direction: column;
             gap: 4px;
             margin-bottom: 10px;
             background: #F8FAFC;
             padding: 8px;
             border-radius: 8px;
          }
          
          .demog-row {
             display: flex;
             justify-content: space-between;
             width: 100%;
          }
          
          .demog-row.labels span {
             font-size: 0.55rem;
             font-weight: 800;
             color: #94A3B8;
          }
          
          .demog-row.values span {
             font-size: 0.85rem;
             font-weight: 700;
             color: #1E293B;
          }
          
          .demog-row.values .age-val {
             text-align: left;
          }
          
          .demog-row.values .sex-val {
             text-align: right;
          }
          
          .risk-factors-mini {
             font-size: 0.65rem;
             color: #64748B;
             margin-top: 4px;
             line-height: 1.4;
          }

          .other-data-minimal .data-section {
             margin-bottom: 8px;
             padding-bottom: 8px;
             border-bottom: 1px solid #F8FAFC;
          }
          
          .other-data-minimal h4 {
             font-size: 0.65rem;
             margin-bottom: 4px;
             color: #64748B;
             text-transform: uppercase;
             letter-spacing: 0.05em;
          }
          
          .other-data-minimal .data-item {
             font-size: 0.7rem;
             margin-bottom: 2px;
          }
          
          .other-data-minimal .data-label {
             min-width: 80px;
             color: #94A3B8;
          }

          .clinical-pathway-card {
            background: white;
            border-radius: 12px;
            padding: 10px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            font-size: 0.7rem;
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            overflow: hidden;
          }

          .pathway-title {
            font-size: 0.6rem;
            font-weight: 800;
            color: #94A3B8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .pathway-items {
             display: flex;
             flex-direction: column;
             gap: 2px;
             overflow-y: auto;
             flex: 1;
             padding-right: 4px;
          }

          .pathway-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 4px 8px;
            border-radius: 8px;
            transition: all 0.2s ease;
          }

          .pathway-item.active {
            background: #EEF2FF;
            color: #4F46E5;
          }

          .step-icon {
            width: 22px;
            height: 22px;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #F8FAFC;
            border-radius: 6px;
            border: 1px solid rgba(0,0,0,0.05);
          }

          .pathway-item.active .step-icon {
            background: #4F46E5;
            color: white;
            border-color: #4F46E5;
          }

          .step-name {
            font-size: 0.7rem;
            font-weight: 600;
          }

          @media (max-width: 1024px) {
            .case-content {
              grid-template-columns: 1fr;
            }
            .left-column {
               max-height: 500px;
               overflow-y: auto;
            }
          }

          .chief-complaint {
            background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .chief-complaint h4 {
            font-size: 0.9rem;
            font-weight: 700;
            color: #92400E;
            margin: 0 0 8px 0;
          }

          .chief-complaint p {
            margin: 0;
            color: #78350F;
            font-weight: 500;
          }

          .data-section {
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #F3F4F6;
          }

          .data-section h4 {
            font-size: 0.9rem;
            font-weight: 700;
            color: #374151;
            margin: 0 0 12px 0;
          }

          .data-item {
            display: flex;
            margin-bottom: 6px;
            font-size: 0.85rem;
          }

          .data-label {
            color: #6B7280;
            min-width: 120px;
            text-transform: capitalize;
          }

          .data-value {
            color: #1F2937;
            font-weight: 500;
          }

          /* Interaction Panel */
          .interaction-panel {
            display: flex;
            flex-direction: column;
            gap: 12px;
            height: 100%;
            overflow: hidden;
            padding-bottom: 20px;
          }

          .stage-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }

          .stage-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
          }

          .stage-number {
             font-size: 0.55rem;
             font-weight: 800;
             color: rgba(255, 255, 255, 0.8);
             text-transform: uppercase;
             letter-spacing: 0.05em;
          }

          .stage-header h4 {
            margin: 0;
            font-size: 0.8rem;
            font-weight: 700;
          }

          .stage-content {
            margin: 0 0 8px 0;
            opacity: 0.95;
            line-height: 1.4;
            font-size: 0.9rem;
          }

          .stage-question {
            background: rgba(255, 255, 255, 0.15);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 0.7rem;
          }

          .stage-question strong {
            font-weight: 600;
          }

          /* Evaluation Card */
          .evaluation-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
            border: 1px solid #e2e8f0;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
          }

          .evaluation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .evaluation-header h4 {
            margin: 0;
            font-size: 1.1rem;
            color: #1F2937;
          }

          .score-badge {
            padding: 8px 16px;
            border-radius: 20px;
            color: white;
            font-weight: 700;
            font-size: 1.1rem;
          }

          .feedback-text {
            color: #374151;
            line-height: 1.6;
            margin-bottom: 16px;
          }

          .feedback-section {
            margin-bottom: 12px;
          }

          .feedback-section h5 {
            font-size: 0.9rem;
            color: #374151;
            margin: 0 0 8px 0;
          }

          .feedback-section ul {
            margin: 0;
            padding-left: 20px;
          }

          .feedback-section li {
            color: #6B7280;
            font-size: 0.9rem;
            margin-bottom: 4px;
          }

          .feedback-section.tips {
            background: #FEF3C7;
            padding: 12px 16px;
            border-radius: 8px;
          }

          .feedback-section.tips h5 {
            color: #92400E;
          }

          .feedback-section.tips li {
            color: #78350F;
          }

          .evaluation-actions {
            display: flex;
            gap: 12px;
            margin-top: 16px;
          }

          .continue-button, .advance-button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .continue-button {
            background: #F3F4F6;
            color: #374151;
          }

          .continue-button:hover {
            background: #E5E7EB;
          }

          .advance-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .advance-button:hover {
            transform: translateY(-2px);
          }

          .input-section {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 295px;
            border: 1px solid #e2e8f0;
          }
          
          .reasoning-input {
             flex: 1;
             min-height: 80px; /* Reduced to ensure footer/button visibility */
             overflow-y: auto; /* Inner chatbox scrolling */
             width: 100%;
             padding: 14px;
             border: 2px solid #E5E7EB;
             border-radius: 8px;
             font-size: 0.95rem;
             font-family: inherit;
             resize: none;
             transition: border-color 0.2s;
          }

          .notes-input {
            width: 100%;
            padding: 14px;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-size: 0.95rem;
            font-family: inherit;
            resize: vertical;
            transition: border-color 0.2s;
          }

          .reasoning-input:focus, .notes-input:focus {
            outline: none;
            border-color: #667eea;
          }

          .input-footer {
            display: flex;
            justify-content: flex-end; /* Moved to extreme right */
            align-items: center;
            margin-top: 16px;
          }

          .input-footer .submit-section {
             margin-top: 0;
             flex: 0 0 auto;
             min-width: 140px; /* Reduced to match smaller button */
          }

          .submit-section {
            display: flex;
            gap: 12px;
            margin-top: 0;
          }

          .submit-button {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 20px; /* Reduced padding */
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem; /* Reduced font size */
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
          }

          .submit-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .submit-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .complete-button {
            padding: 14px 24px;
            background: #10B981;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .complete-button:hover {
            background: #059669;
          }

          /* Completion View */
          .completion-view {
            display: flex;
            justify-content: center;
            padding: 40px 20px;
          }

          .completion-card {
            background: white;
            border-radius: 24px;
            padding: 48px;
            max-width: 600px;
            width: 100%;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }

          .completion-header {
            margin-bottom: 32px;
          }

          .completion-icon {
            font-size: 4rem;
            margin-bottom: 16px;
          }

          .completion-header h2 {
            font-size: 2rem;
            font-weight: 800;
            color: #1F2937;
            margin: 0;
          }

          .final-score {
            margin-bottom: 32px;
          }

          .score-circle {
            width: 120px;
            height: 120px;
            border: 6px solid;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 0 auto 12px;
          }

          .score-value {
            font-size: 2.5rem;
            font-weight: 800;
            color: #1F2937;
          }

          .score-label {
            font-size: 1.25rem;
            color: #6B7280;
          }

          .completion-stats {
            display: flex;
            justify-content: center;
            gap: 48px;
            margin-bottom: 32px;
          }

          .stat {
            text-align: center;
          }

          .stat-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
            color: #1F2937;
          }

          .stat-label {
            font-size: 0.9rem;
            color: #6B7280;
          }

          .diagnosis-reveal {
            background: #F0FDF4;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            text-align: left;
          }

          .diagnosis-reveal h3 {
            color: #166534;
            margin: 0 0 12px 0;
          }

          .diagnosis-text {
            font-size: 1.1rem;
            font-weight: 600;
            color: #166534;
            margin: 0 0 12px 0;
          }

          .explanation-text {
            color: #15803D;
            line-height: 1.6;
            margin: 0;
          }

          .pearls-section, .red-flags-section {
            text-align: left;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 16px;
          }

          .pearls-section {
            background: #FEF3C7;
          }

          .pearls-section h3 {
            color: #92400E;
            margin: 0 0 12px 0;
          }

          .pearls-section li {
            color: #78350F;
          }

          .red-flags-section {
            background: #FEE2E2;
          }

          .red-flags-section h3 {
            color: #991B1B;
            margin: 0 0 12px 0;
          }

          .red-flags-section li {
            color: #7F1D1D;
          }

          .completion-actions {
            display: flex;
            gap: 16px;
            margin-top: 32px;
          }

          .new-case-button, .dashboard-button {
            flex: 1;
            padding: 14px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .new-case-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .new-case-button:hover {
            transform: translateY(-2px);
          }

          .dashboard-button {
            background: #F3F4F6;
            color: #374151;
          }

          .dashboard-button:hover {
            background: #E5E7EB;
          }

          /* Responsive */
          @media (max-width: 900px) {
            .case-content {
              grid-template-columns: 1fr;
            }

            .patient-panel {
              max-height: 400px;
            }

            .case-header {
              flex-direction: column;
              gap: 16px;
              text-align: center;
            }

            .header-right {
              flex-wrap: wrap;
              justify-content: center;
            }
          }

          @media (max-width: 600px) {
            .setup-header h1 {
              font-size: 1.75rem;
            }

            .specialty-grid {
              grid-template-columns: repeat(3, 1fr);
            }

            .difficulty-grid {
              grid-template-columns: 1fr;
            }

            .step-type-selector {
              justify-content: center;
            }

            .completion-card {
              padding: 32px 20px;
            }
          }
        `}</style>
        </div> {/* clinical-container */}
      </DashboardLayout >
    </>
  )
}
function setNotes(arg0: string) {
  throw new Error('Function not implemented.')
}

