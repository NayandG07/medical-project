import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import DatePicker from '@/components/DatePicker'
import { Calendar, Clock, Plus, ChevronLeft, ChevronRight, Check, X, Play, Pause, Target, Flame, Zap, Brain, Edit3, Trash2, Download, TrendingUp, Award, Settings } from 'lucide-react'
import html2canvas from 'html2canvas'

interface PlanEntry {
    id: string
    subject: string
    topic?: string
    study_type: string
    scheduled_date: string
    start_time: string
    end_time: string
    priority: string
    status: string
    notes?: string
    color_code: string
    completion_percentage?: number
    performance_score?: number
    accuracy_percentage?: number
    started_at?: string
    completed_at?: string
}

interface DailyBrief {
    greeting: string
    streak: { current: number; longest: number }
    today: { total_sessions: number; planned_hours: number; high_priority_count: number }
    top_recommendation?: { title: string; description: string }
}

const STUDY_TYPES = [
    { value: 'mcqs', label: 'MCQs', icon: '✓', color: '#0D9488' },
    { value: 'flashcards', label: 'Flashcards', icon: '🎴', color: '#5C67F2' },
    { value: 'clinical_cases', label: 'Clinical Cases', icon: '🏥', color: '#EA4335' },
    { value: 'revision', label: 'Revision', icon: '📖', color: '#F59E0B' },
    { value: 'osce', label: 'OSCE', icon: '👨‍⚕️', color: '#9333EA' },
    { value: 'reading', label: 'Reading', icon: '📚', color: '#10B981' },
    { value: 'conceptmap', label: 'Concept Map', icon: '🗺️', color: '#EC4899' },
]

const PRIORITIES = [
    { value: 'low', label: 'Low', color: '#94A3B8' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#EA4335' },
    { value: 'critical', label: 'Critical', color: '#DC2626' },
]

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Generate time slots dynamically based on start and end hour
const generateTimeSlots = (startHour: number, endHour: number) => {
    const slots = []
    for (let hour = startHour; hour <= endHour; hour++) {
        slots.push({
            hour,
            label: `${hour.toString().padStart(2, '0')}:00`,
            display: hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
        })
    }
    return slots
}

const DURATION_OPTIONS = [
    { value: 1, label: '1 Hour' },
    { value: 2, label: '2 Hours' },
    { value: 3, label: '3 Hours' },
    { value: 4, label: '4 Hours' },
]

// Default time range config
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 22

export default function StudyPlanner() {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [entries, setEntries] = useState<PlanEntry[]>([])
    const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [editingEntry, setEditingEntry] = useState<PlanEntry | null>(null)
    const [selectedCell, setSelectedCell] = useState<{ day: string; hour: number } | null>(null)
    const [activeCellMenu, setActiveCellMenu] = useState<string | null>(null)
    const [showSettings, setShowSettings] = useState(false)

    // Timer modal state
    const [timerEntry, setTimerEntry] = useState<PlanEntry | null>(null)
    const [timerSeconds, setTimerSeconds] = useState(0)
    const [timerRunning, setTimerRunning] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Configurable time range (persisted in localStorage)
    const [startHour, setStartHour] = useState(DEFAULT_START_HOUR)
    const [endHour, setEndHour] = useState(DEFAULT_END_HOUR)

    // Load time config from localStorage on mount
    useEffect(() => {
        const savedStartHour = localStorage.getItem('studyPlanner_startHour')
        const savedEndHour = localStorage.getItem('studyPlanner_endHour')
        if (savedStartHour) setStartHour(parseInt(savedStartHour))
        if (savedEndHour) setEndHour(parseInt(savedEndHour))
    }, [])

    // Save time config to localStorage when changed
    const updateTimeConfig = (newStart: number, newEnd: number) => {
        setStartHour(newStart)
        setEndHour(newEnd)
        localStorage.setItem('studyPlanner_startHour', newStart.toString())
        localStorage.setItem('studyPlanner_endHour', newEnd.toString())
        setShowSettings(false)
    }

    // Generate TIME_SLOTS based on config
    const TIME_SLOTS = useMemo(() => generateTimeSlots(startHour, endHour), [startHour, endHour])

    // Form state with duration instead of end_time
    const [formData, setFormData] = useState({
        subject: '',
        topic: '',
        study_type: 'mcqs',
        scheduled_date: new Date().toISOString().split('T')[0],
        start_hour: 9,
        duration: 1,
        priority: 'medium',
        notes: '',
        color_code: '#5C67F2',
    })

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (user) {
            fetchEntries()
            fetchDailyBrief()
        }
    }, [user, currentDate])

    // Timer effect
    useEffect(() => {
        if (timerRunning && timerEntry) {
            timerRef.current = setInterval(() => {
                setTimerSeconds(prev => {
                    if (prev <= 0) {
                        handleTimerComplete()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else if (timerRef.current) {
            clearInterval(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [timerRunning, timerEntry])

    // Click outside to close cell menu
    useEffect(() => {
        const handleClickOutside = () => setActiveCellMenu(null)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    // Compute stats dynamically from entries array
    const computedStats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0]
        const todayEntries = entries.filter(entry => entry.scheduled_date === today)

        let totalPlannedMinutes = 0
        let completedMinutes = 0
        let totalPerformanceScore = 0
        let performanceCount = 0

        todayEntries.forEach(entry => {
            if (entry.start_time && entry.end_time) {
                try {
                    const startParts = entry.start_time.split(':').map(Number)
                    const endParts = entry.end_time.split(':').map(Number)
                    const startMinutes = startParts[0] * 60 + startParts[1]
                    const endMinutes = endParts[0] * 60 + endParts[1]
                    const duration = Math.max(0, endMinutes - startMinutes)
                    totalPlannedMinutes += duration
                    if (entry.status === 'completed') {
                        completedMinutes += duration
                    }
                } catch {
                    // Skip invalid time entries
                }
            }
            if (entry.performance_score) {
                totalPerformanceScore += entry.performance_score
                performanceCount++
            }
        })

        const completedSessions = todayEntries.filter(entry => entry.status === 'completed').length
        const highPriorityCount = todayEntries.filter(
            entry => entry.priority === 'high' || entry.priority === 'critical'
        ).length
        const completionRate = todayEntries.length > 0
            ? Math.round((completedSessions / todayEntries.length) * 100)
            : 0
        const avgPerformance = performanceCount > 0
            ? Math.round(totalPerformanceScore / performanceCount)
            : 0

        return {
            totalSessions: todayEntries.length,
            completedSessions,
            plannedHours: Math.round((totalPlannedMinutes / 60) * 10) / 10,
            completedHours: Math.round((completedMinutes / 60) * 10) / 10,
            highPriorityCount,
            completionRate,
            avgPerformance,
        }
    }, [entries])

    // Ref for timetable download
    const timetableRef = useRef<HTMLDivElement>(null)

    // Download timetable as image
    const handleDownload = async () => {
        if (!timetableRef.current) return

        const timetableElement = timetableRef.current.querySelector('.timetable') as HTMLElement
        if (!timetableElement) return

        try {
            // Options to ensure full capture
            const canvas = await html2canvas(timetableElement, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                width: timetableElement.scrollWidth,
                height: timetableElement.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    // Remove sticky positioning in the clone to avoid layout issues in the image
                    const stickyElements = clonedDoc.querySelectorAll('.time-label-header, .day-label')
                    stickyElements.forEach((el: any) => {
                        el.style.position = 'static'
                        el.style.borderRight = '1px solid #E2E8F0'
                    })
                    // Ensure the timetable in the clone is fully expanded
                    const clonedTimetable = clonedDoc.querySelector('.timetable') as HTMLElement
                    if (clonedTimetable) {
                        clonedTimetable.style.width = `${timetableElement.scrollWidth}px`
                        clonedTimetable.style.transform = 'none'
                    }
                }
            })
            const link = document.createElement('a')
            link.download = `study-planner-${formatWeekRange().replace(/[,\s]+/g, '-')}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (err) {
            console.error('Failed to download:', err)
        }
    }

    // Get week dates based on current date
    const weekDates = useMemo(() => {
        const startOfWeek = new Date(currentDate)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)

        return DAYS_OF_WEEK.map((dayName, index) => {
            const date = new Date(startOfWeek)
            date.setDate(startOfWeek.getDate() + index)
            return {
                dayName,
                date: date.toISOString().split('T')[0],
                dateObj: date,
                isToday: date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
            }
        })
    }, [currentDate])

    // Map entries to timetable cells
    const timetableData = useMemo(() => {
        const cellMap: Record<string, PlanEntry[]> = {}

        entries.forEach(entry => {
            if (!entry.start_time) return
            const startHour = parseInt(entry.start_time.split(':')[0])
            const endHour = entry.end_time ? parseInt(entry.end_time.split(':')[0]) : startHour + 1
            const duration = endHour - startHour

            // Only show in the starting cell, but mark duration
            const key = `${entry.scheduled_date}-${startHour}`
            if (!cellMap[key]) cellMap[key] = []
            cellMap[key].push({ ...entry, _duration: duration } as PlanEntry & { _duration: number })
        })

        return cellMap
    }, [entries])

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/')
            return
        }
        setUser(session.user as AuthUser)
        setLoading(false)
    }

    const getToken = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token
    }

    const fetchEntries = async () => {
        try {
            const token = await getToken()
            const weekStart = weekDates[0]?.date
            if (!weekStart) return

            const res = await fetch(`http://localhost:8000/api/planner/entries/weekly/${weekStart}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setEntries(data.entries || [])
        } catch (err) {
            console.error('Failed to fetch entries:', err)
        }
    }

    const fetchDailyBrief = async () => {
        try {
            const token = await getToken()
            const res = await fetch('http://localhost:8000/api/planner/daily-brief', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            setDailyBrief(data)
        } catch (err) {
            console.error('Failed to fetch daily brief:', err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Calculate end_time from start_hour and duration
        const endHour = formData.start_hour + formData.duration

        // Check for conflicts with existing entries
        const hasConflict = entries.some(entry => {
            // Skip the entry being edited
            if (editingEntry && entry.id === editingEntry.id) return false

            // Check if same date
            if (entry.scheduled_date !== formData.scheduled_date) return false

            // Parse existing entry times
            const existingStart = parseInt(entry.start_time.split(':')[0])
            const existingEnd = parseInt(entry.end_time.split(':')[0])
            const newStart = formData.start_hour
            const newEnd = endHour

            // Check for overlap: (start1 < end2) && (start2 < end1)
            return (newStart < existingEnd) && (existingStart < newEnd)
        })

        if (hasConflict) {
            alert('Time slot conflict! Another session already exists during this time period. Please choose a different time.')
            return
        }

        try {
            const token = await getToken()
            const method = editingEntry ? 'PUT' : 'POST'
            const url = editingEntry
                ? `http://localhost:8000/api/planner/entries/${editingEntry.id}`
                : 'http://localhost:8000/api/planner/entries'

            const payload = {
                subject: formData.subject,
                topic: formData.topic,
                study_type: formData.study_type,
                scheduled_date: formData.scheduled_date,
                start_time: `${formData.start_hour.toString().padStart(2, '0')}:00`,
                end_time: `${endHour.toString().padStart(2, '0')}:00`,
                priority: formData.priority,
                notes: formData.notes,
                color_code: formData.color_code,
            }

            await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            setShowModal(false)
            setEditingEntry(null)
            resetForm()
            fetchEntries()
        } catch (err) {
            console.error('Failed to save entry:', err)
        }
    }

    const handleComplete = async (entryId: string) => {
        try {
            const token = await getToken()
            await fetch(`http://localhost:8000/api/planner/entries/${entryId}/complete`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchEntries()
            fetchDailyBrief()
            setActiveCellMenu(null)
        } catch (err) {
            console.error('Failed to complete entry:', err)
        }
    }

    const handleStart = async (entry: PlanEntry) => {
        try {
            const token = await getToken()
            await fetch(`http://localhost:8000/api/planner/entries/${entry.id}/start`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchEntries()
            setActiveCellMenu(null)

            // Calculate timer duration from entry
            const startParts = entry.start_time.split(':').map(Number)
            const endParts = entry.end_time.split(':').map(Number)
            const durationMinutes = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1])

            // Open timer modal
            setTimerEntry(entry)
            setTimerSeconds(durationMinutes * 60)
            setTimerRunning(true)
        } catch (err) {
            console.error('Failed to start entry:', err)
        }
    }

    const handleTimerComplete = () => {
        if (timerEntry) {
            handleComplete(timerEntry.id)
        }
        setTimerRunning(false)
        setTimerEntry(null)
        setTimerSeconds(0)
    }

    const handleDelete = async (entryId: string) => {
        if (!confirm('Delete this study session?')) return
        try {
            const token = await getToken()
            await fetch(`http://localhost:8000/api/planner/entries/${entryId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchEntries()
            setActiveCellMenu(null)
        } catch (err) {
            console.error('Failed to delete entry:', err)
        }
    }

    const resetForm = () => {
        setFormData({
            subject: '',
            topic: '',
            study_type: 'mcqs',
            scheduled_date: selectedCell ? weekDates.find(d => d.dayName === selectedCell.day)?.date || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            start_hour: selectedCell?.hour || 9,
            duration: 1,
            priority: 'medium',
            notes: '',
            color_code: '#5C67F2',
        })
        setSelectedCell(null)
    }

    const handleCellClick = (dayName: string, hour: number, date: string) => {
        setSelectedCell({ day: dayName, hour })
        setFormData({
            ...formData,
            scheduled_date: date,
            start_hour: hour,
        })
        setShowModal(true)
    }

    const handleEntryClick = (e: React.MouseEvent, entry: PlanEntry) => {
        e.stopPropagation()
        setActiveCellMenu(activeCellMenu === entry.id ? null : entry.id)
    }

    const handleEditEntry = (entry: PlanEntry) => {
        const startHour = parseInt(entry.start_time.split(':')[0])
        const endHour = parseInt(entry.end_time.split(':')[0])
        setEditingEntry(entry)
        setFormData({
            subject: entry.subject,
            topic: entry.topic || '',
            study_type: entry.study_type,
            scheduled_date: entry.scheduled_date,
            start_hour: startHour,
            duration: endHour - startHour,
            priority: entry.priority,
            notes: entry.notes || '',
            color_code: entry.color_code,
        })
        setShowModal(true)
        setActiveCellMenu(null)
    }

    const navigateWeek = (direction: number) => {
        const newDate = new Date(currentDate)
        newDate.setDate(newDate.getDate() + (direction * 7))
        setCurrentDate(newDate)
    }

    const formatWeekRange = () => {
        if (weekDates.length === 0) return ''
        const start = weekDates[0].dateObj
        const end = weekDates[6].dateObj
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }

    const formatTimer = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const getStudyTypeInfo = (type: string) => STUDY_TYPES.find(t => t.value === type) || STUDY_TYPES[0]
    const getPriorityInfo = (priority: string) => PRIORITIES.find(p => p.value === priority) || PRIORITIES[1]

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading your study planner...</p>
                <style jsx>{`
                    .loading-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; background: var(--cream-bg); gap: 16px; }
                    .spinner { width: 32px; height: 32px; border: 3px solid var(--cream-accent-soft); border-top-color: var(--cream-text-main); border-radius: 50%; animation: spin 1s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    p { font-size: 14px; font-weight: 600; color: var(--cream-text-muted); }
                `}</style>
            </div>
        )
    }

    if (!user) return null

    return (
        <>
            <Head>
                <title>Study Planner - Vaidya AI</title>
                <meta name="description" content="Smart study planning for medical excellence" />
            </Head>

            <DashboardLayout user={user}>
                <div className="planner-container">
                    {/* Header Section */}
                    <div className="planner-header">
                        <div className="header-left">
                            <h1>Study Planner</h1>
                            <p>Plan, track, and optimize your medical studies</p>
                        </div>
                        <div className="header-right">
                            <div className="calendar-status-btn" title="View Calendar">
                                <Calendar size={20} />
                            </div>
                            <button className="add-btn" onClick={() => { resetForm(); setShowModal(true); }}>
                                <Plus size={18} />
                                <span>Add Session</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="stats-row">
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#FFF7ED', color: '#D97706' }}>
                                <Flame size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{dailyBrief?.streak?.current || 0}</span>
                                <span className="stat-label">Day Streak</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#F0FDFA', color: '#0D9488' }}>
                                <Target size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{computedStats.completedSessions}/{computedStats.totalSessions}</span>
                                <span className="stat-label">Sessions Done</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#EDEEFF', color: '#5C67F2' }}>
                                <Clock size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{computedStats.completedHours}/{computedStats.plannedHours}h</span>
                                <span className="stat-label">Hours</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#F0FDF4', color: '#10B981' }}>
                                <TrendingUp size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{computedStats.completionRate}%</span>
                                <span className="stat-label">Completion</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#FEF2F2', color: '#EA4335' }}>
                                <Zap size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{computedStats.highPriorityCount}</span>
                                <span className="stat-label">High Priority</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                                <Award size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{computedStats.avgPerformance || '—'}</span>
                                <span className="stat-label">Avg Score</span>
                            </div>
                        </div>
                    </div>

                    {/* Week Navigation */}
                    <div className="week-nav">
                        <button onClick={() => navigateWeek(-1)}><ChevronLeft size={18} /></button>
                        <span className="week-display">{formatWeekRange()}</span>
                        <button onClick={() => navigateWeek(1)}><ChevronRight size={18} /></button>
                        <button className="today-btn" onClick={() => setCurrentDate(new Date())}>Today</button>
                        <div className="nav-spacer"></div>
                        <button className="download-btn" onClick={handleDownload}>
                            <Download size={18} />
                            <span>Download Timetable</span>
                        </button>
                        <button className="settings-btn" onClick={() => setShowSettings(true)} title="Configure Time Range">
                            <Settings size={18} />
                        </button>
                    </div>

                    {/* Timetable Grid */}
                    <div className="timetable-wrapper" ref={timetableRef}>
                        <div className="timetable" style={{ '--slot-count': TIME_SLOTS.length } as React.CSSProperties}>
                            {/* Header Row - Time Slots */}
                            <div className="timetable-header">
                                <div className="time-label-header">Day / Time</div>
                                {TIME_SLOTS.map(slot => (
                                    <div key={slot.hour} className="time-slot-header">
                                        {slot.display}
                                    </div>
                                ))}
                            </div>

                            {/* Day Rows */}
                            {weekDates.map(({ dayName, date, isToday }) => (
                                <div key={dayName} className={`timetable-row ${isToday ? 'today-row' : ''}`}>
                                    <div className="day-label">
                                        <span className="day-name">{dayName.slice(0, 3)}</span>
                                        <span className="day-date">{new Date(date).getDate()}</span>
                                    </div>
                                    {TIME_SLOTS.map(slot => {
                                        const cellKey = `${date}-${slot.hour}`
                                        const cellEntries = timetableData[cellKey] || []
                                        const hasEntry = cellEntries.length > 0
                                        const entry = cellEntries[0] as PlanEntry & { _duration?: number }
                                        const typeInfo = entry ? getStudyTypeInfo(entry.study_type) : null
                                        const priorityInfo = entry ? getPriorityInfo(entry.priority) : null
                                        const duration = entry?._duration || 1

                                        // Check if this is a past event
                                        const now = new Date()
                                        const currentHour = now.getHours()
                                        const todayStr = now.toISOString().split('T')[0]
                                        const isPastEvent = hasEntry && entry.status !== 'completed' && (
                                            date < todayStr ||
                                            (date === todayStr && parseInt(entry.end_time.split(':')[0]) <= currentHour)
                                        )

                                        return (
                                            <div
                                                key={cellKey}
                                                className={`timetable-cell ${hasEntry ? 'has-entry' : ''} ${entry?.status === 'completed' ? 'completed' : ''} ${entry?.status === 'in_progress' ? 'in-progress' : ''} ${isPastEvent ? 'past-event' : ''}`}
                                                style={hasEntry ? {
                                                    '--entry-color': entry.color_code || typeInfo?.color,
                                                    '--cell-span': duration
                                                } as React.CSSProperties : undefined}
                                                onClick={() => !hasEntry && handleCellClick(dayName, slot.hour, date)}
                                            >
                                                {hasEntry ? (
                                                    <div
                                                        className="cell-entry"
                                                        onClick={(e) => handleEntryClick(e, entry)}
                                                        style={{ width: `calc(${duration * 100}% + ${(duration - 1) * 2}px)` }}
                                                    >
                                                        <div className="entry-type-badge" style={{ background: `${typeInfo?.color}20`, color: typeInfo?.color }}>
                                                            {typeInfo?.icon} {typeInfo?.label}
                                                        </div>
                                                        <div className="entry-subject">{entry.subject}</div>
                                                        {entry.topic && <div className="entry-topic">{entry.topic}</div>}
                                                        <div className="entry-meta">
                                                            <span className="priority-dot" style={{ background: priorityInfo?.color }}></span>
                                                            <span>{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</span>
                                                        </div>

                                                        {/* Action Menu */}
                                                        {activeCellMenu === entry.id && (
                                                            <div className="cell-menu" onClick={e => e.stopPropagation()}>
                                                                <button onClick={() => handleEditEntry(entry)}>
                                                                    <Edit3 size={14} /> Edit
                                                                </button>
                                                                {entry.status !== 'completed' && entry.status !== 'in_progress' && (
                                                                    <button onClick={() => handleStart(entry)}>
                                                                        <Play size={14} /> Start
                                                                    </button>
                                                                )}
                                                                {entry.status !== 'completed' && (
                                                                    <button onClick={() => handleComplete(entry.id)}>
                                                                        <Check size={14} /> Complete
                                                                    </button>
                                                                )}
                                                                <button className="delete-action" onClick={() => handleDelete(entry.id)}>
                                                                    <Trash2 size={14} /> Delete
                                                                </button>
                                                            </div>
                                                        )}

                                                        {entry.status === 'completed' && (
                                                            <div className="completed-badge"><Check size={10} /></div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="empty-cell">
                                                        <Plus size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Recommendation */}
                    {dailyBrief?.top_recommendation && (
                        <div className="ai-recommendation">
                            <div className="ai-icon"><Brain size={20} /></div>
                            <div className="ai-content">
                                <h4>{dailyBrief.top_recommendation.title}</h4>
                                <p>{dailyBrief.top_recommendation.description}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Timer Modal */}
                {timerEntry && (
                    <div className="timer-overlay">
                        <div className="timer-modal">
                            <div className="timer-header">
                                <span className="timer-type" style={{ background: `${getStudyTypeInfo(timerEntry.study_type).color}20`, color: getStudyTypeInfo(timerEntry.study_type).color }}>
                                    {getStudyTypeInfo(timerEntry.study_type).icon} {getStudyTypeInfo(timerEntry.study_type).label}
                                </span>
                                <h3>{timerEntry.subject}</h3>
                                {timerEntry.topic && <p>{timerEntry.topic}</p>}
                            </div>
                            <div className="timer-display">
                                {formatTimer(timerSeconds)}
                            </div>
                            <div className="timer-actions">
                                <button
                                    className={`timer-btn ${timerRunning ? 'pause' : 'play'}`}
                                    onClick={() => setTimerRunning(!timerRunning)}
                                >
                                    {timerRunning ? <Pause size={20} /> : <Play size={20} />}
                                    {timerRunning ? 'Pause' : 'Resume'}
                                </button>
                                <button className="timer-btn complete" onClick={handleTimerComplete}>
                                    <Check size={20} />
                                    Complete
                                </button>
                                <button className="timer-btn cancel" onClick={() => { setTimerEntry(null); setTimerRunning(false); }}>
                                    <X size={20} />
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add/Edit Modal */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} data-lenis-prevent>
                            <button className="close-modal-btn" onClick={() => setShowModal(false)} title="Close">
                                <X size={24} />
                            </button>
                            <div className="modal-header">
                                <h2>{editingEntry ? 'Edit Session' : 'New Study Session'}</h2>
                                <p>Set your goals and track your progress</p>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Subject *</label>
                                    <input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} placeholder="e.g., Cardiology" required />
                                </div>
                                <div className="form-group">
                                    <label>Topic</label>
                                    <input type="text" value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })} placeholder="e.g., Heart Failure" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Study Type</label>
                                        <select value={formData.study_type} onChange={e => setFormData({ ...formData, study_type: e.target.value, color_code: getStudyTypeInfo(e.target.value).color })}>
                                            {STUDY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Priority</label>
                                        <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <DatePicker
                                        value={formData.scheduled_date}
                                        onChange={(date) => setFormData({ ...formData, scheduled_date: date })}
                                        label="Date"
                                        required
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Start Time</label>
                                        <select value={formData.start_hour} onChange={e => setFormData({ ...formData, start_hour: parseInt(e.target.value) })}>
                                            {TIME_SLOTS.map(slot => (
                                                <option key={slot.hour} value={slot.hour}>{slot.display}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Duration</label>
                                        <select value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}>
                                            {DURATION_OPTIONS.map(d => (
                                                <option key={d.value} value={d.value}>{d.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes..." rows={3} />
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="submit-btn">{editingEntry ? 'Update' : 'Create'} Session</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Settings Modal */}
                {showSettings && (
                    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                        <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
                            <button className="close-modal-btn" onClick={() => setShowSettings(false)} title="Close">
                                <X size={24} />
                            </button>
                            <div className="modal-header">
                                <h2>Timetable Settings</h2>
                                <p>Configure your daily time range</p>
                            </div>
                            <div className="settings-content">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Start Hour</label>
                                        <select
                                            value={startHour}
                                            onChange={e => setStartHour(parseInt(e.target.value))}
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i} disabled={i >= endHour}>
                                                    {i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>End Hour</label>
                                        <select
                                            value={endHour}
                                            onChange={e => setEndHour(parseInt(e.target.value))}
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i} disabled={i <= startHour}>
                                                    {i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="cancel-btn" onClick={() => setShowSettings(false)}>Cancel</button>
                                    <button type="button" className="submit-btn" onClick={() => updateTimeConfig(startHour, endHour)}>
                                        Save Settings
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <style jsx>{`
                    .planner-container { max-width: 1600px; margin: 0 auto; padding-bottom: 40px; }
                    .planner-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
                    .planner-header h1 { font-size: 32px; font-weight: 800; color: var(--cream-text-main); margin: 0 0 4px 0; letter-spacing: -0.04em; }
                    .planner-header p { font-size: 15px; color: var(--cream-text-muted); margin: 0; font-weight: 500; }
                    
                    .header-right { display: flex; align-items: center; gap: 16px; }
                    .calendar-status-btn { 
                        width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; 
                        background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; 
                        color: var(--cream-text-muted); cursor: pointer; transition: all 0.25s;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                    }
                    .calendar-status-btn:hover { color: #5C67F2; border-color: #5C67F2; background: #F5F3FF; }
                    .add-btn { 
                        display: flex; align-items: center; gap: 8px; background: var(--cream-text-main); 
                        color: white; border: none; padding: 12px 24px; border-radius: 14px; 
                        font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.25s; 
                        box-shadow: 0 8px 20px -4px rgba(0,0,0,0.15); 
                    }
                    .add-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -4px rgba(0,0,0,0.25); background: #111; }
                    
                    .stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 24px; }
                    .stat-card { 
                        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%);
                        backdrop-filter: blur(20px);
                        border-radius: 20px; padding: 20px; display: flex; align-items: center; gap: 14px; 
                        border: 1px solid rgba(255,255,255,0.8); 
                        box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1);
                        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative;
                        overflow: hidden;
                    }
                    .stat-card::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 0; right: 0;
                        height: 3px;
                        background: linear-gradient(90deg, transparent, rgba(92, 103, 242, 0.3), transparent);
                        opacity: 0;
                        transition: opacity 0.3s;
                    }
                    .stat-card:hover { 
                        transform: translateY(-6px); 
                        box-shadow: 0 20px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05);
                        border-color: rgba(92, 103, 242, 0.2);
                    }
                    .stat-card:hover::before { opacity: 1; }
                    .stat-icon { 
                        width: 48px; height: 48px; border-radius: 14px; 
                        display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    }
                    .stat-value { font-size: 22px; font-weight: 800; color: var(--cream-text-main); display: block; line-height: 1.2; }
                    .stat-label { font-size: 10px; font-weight: 700; color: var(--cream-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
                    
                    .week-nav { 
                        display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 24px; 
                        background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%);
                        padding: 14px 24px; border-radius: 18px; border: 1px solid rgba(0,0,0,0.06);
                        box-shadow: 0 4px 20px rgba(0,0,0,0.04);
                    }
                    .week-nav button { 
                        background: #F8FAFC; border: 1px solid rgba(0,0,0,0.08); width: 40px; height: 40px; 
                        border-radius: 12px; display: flex; align-items: center; justify-content: center; 
                        cursor: pointer; color: var(--cream-text-main); transition: all 0.25s;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                    }
                    .week-nav button:hover { background: var(--cream-text-main); color: white; transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
                    .week-display { font-size: 16px; font-weight: 700; color: var(--cream-text-main); min-width: 220px; text-align: center; }
                    .today-btn { width: auto !important; padding: 0 20px !important; font-weight: 700; font-size: 13px; background: #5C67F2 !important; color: white !important; border: none !important; }
                    .today-btn:hover { background: #4F46E5 !important; }
                    .download-btn { 
                        background: linear-gradient(135deg, #10B981 0%, #059669 100%) !important; 
                        color: white !important; border: none !important;
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
                        width: auto !important; padding: 0 20px !important;
                        gap: 8px !important; font-weight: 700 !important; font-size: 13px !important;
                    }
                    .download-btn:hover { transform: scale(1.02) !important; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4) !important; }
                    .download-btn span { white-space: nowrap; }
                    .settings-btn {
                        background: #F8FAFC !important; border: 1px solid rgba(0,0,0,0.08) !important;
                        color: #64748B !important;
                    }
                    .settings-btn:hover { background: #E2E8F0 !important; color: var(--cream-text-main) !important; }
                    .nav-spacer { flex: 1; }
                    .settings-modal { max-width: 420px; }
                    .settings-content { padding-top: 16px; }
                    
                    /* Timetable Styles */
                    .timetable-wrapper { 
                        background: white; border-radius: 24px; padding: 24px; 
                        border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.06);
                        overflow-x: auto;
                        position: relative;
                        scrollbar-width: none; /* Firefox */
                        -ms-overflow-style: none; /* IE/Edge */
                    }
                    .timetable-wrapper::-webkit-scrollbar { display: none; } /* Chrome/Safari */
                    .timetable { min-width: calc(100px + var(--slot-count, 17) * 120px); border-collapse: separate; border-spacing: 0; }
                    
                    .timetable-header { 
                        display: grid; grid-template-columns: 100px repeat(var(--slot-count, 17), minmax(120px, 1fr)); gap: 1px;
                        margin-bottom: 1px;
                        background: #E2E8F0;
                        border-radius: 12px 12px 0 0;
                    }
                    .time-label-header { 
                        padding: 14px 8px; font-size: 11px; font-weight: 700; color: var(--cream-text-muted);
                        text-transform: uppercase; letter-spacing: 0.05em; background: #F8FAFC;
                        display: flex; align-items: center; justify-content: center;
                        position: sticky; left: 0; z-index: 10;
                        border-right: 2px solid #CBD5E1;
                    }
                    .time-slot-header { 
                        padding: 14px 4px; font-size: 11px; font-weight: 700; color: var(--cream-text-main);
                        text-align: center; background: #F8FAFC;
                        border-right: 1px solid #E2E8F0;
                    }
                    .time-slot-header:last-child { border-right: none; }
                    
                    .timetable-row { 
                        display: grid; grid-template-columns: 100px repeat(var(--slot-count, 17), minmax(120px, 1fr)); gap: 1px;
                        margin-bottom: 1px;
                        background: #E2E8F0;
                    }
                    .timetable-row:last-child { border-radius: 0 0 12px 12px; }
                    .timetable-row:last-child .day-label { border-radius: 0 0 0 12px; }
                    .timetable-row:last-child .timetable-cell:last-child { border-radius: 0 0 12px 0; }
                    .timetable-header .time-label-header { border-radius: 12px 0 0 0; }
                    .timetable-header .time-slot-header:last-child { border-radius: 0 12px 0 0; }
                    .timetable-row.today-row .day-label { 
                        background: linear-gradient(135deg, #5C67F2 0%, #4F46E5 100%); 
                        box-shadow: 0 4px 16px rgba(92, 103, 242, 0.35);
                    }
                    .timetable-row.today-row .day-label .day-date { background: white; color: #5C67F2; }
                    
                    .day-label { 
                        padding: 16px 8px; background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); 
                        color: white;
                        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        position: sticky; left: 0; z-index: 10;
                        border-right: 2px solid #CBD5E1;
                    }
                    .day-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
                    .day-date { 
                        font-size: 18px; font-weight: 800; background: rgba(255,255,255,0.15); 
                        width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
                    }
                    
                    .timetable-cell { 
                        min-height: 100px; 
                        background: linear-gradient(135deg, #FFFFFF 0%, #FAFBFC 100%);
                        padding: 8px;
                        border-right: 1px solid #E2E8F0;
                        transition: all 0.25s; cursor: pointer;
                        position: relative; overflow: visible;
                    }
                    .timetable-cell:last-child { border-right: none; }
                    .timetable-cell:hover:not(.has-entry) { 
                        background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); 
                        box-shadow: inset 0 0 0 2px rgba(92, 103, 242, 0.15);
                    }
                    .timetable-cell.has-entry { background: #FAFBFC; padding: 4px; overflow: visible; }
                    .timetable-cell.completed .cell-entry { opacity: 0.6; }
                    .timetable-cell.in-progress .cell-entry { 
                        box-shadow: 0 0 0 3px #10B981, 0 8px 24px rgba(16, 185, 129, 0.3);
                        animation: pulse 2s infinite;
                    }
                    .timetable-cell.past-event { 
                        background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); 
                    }
                    .timetable-cell.past-event .cell-entry {
                        background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
                        border-left-color: #F59E0B;
                    }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.9; } }
                    
                    .empty-cell { 
                        height: 100%; display: flex; align-items: center; justify-content: center;
                        color: #94A3B8; opacity: 0; transition: all 0.25s;
                    }
                    .timetable-cell:hover .empty-cell { opacity: 1; transform: scale(1.1); }
                    
                    .cell-entry { 
                        background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%);
                        backdrop-filter: blur(10px);
                        border-radius: 12px; padding: 12px; height: 100%;
                        border-left: 5px solid var(--entry-color); cursor: pointer;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative; z-index: 1;
                    }
                    .cell-entry:hover { 
                        transform: translateY(-4px) scale(1.02); 
                        box-shadow: 0 12px 32px rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.05); 
                        z-index: 10; 
                    }
                    
                    .entry-type-badge { 
                        font-size: 9px; font-weight: 700; padding: 3px 6px; border-radius: 4px;
                        display: inline-flex; align-items: center; gap: 3px; margin-bottom: 6px;
                    }
                    .entry-subject { font-size: 12px; font-weight: 700; color: var(--cream-text-main); line-height: 1.3; margin-bottom: 2px; }
                    .entry-topic { font-size: 10px; color: var(--cream-text-muted); margin-bottom: 6px; }
                    .entry-meta { display: flex; align-items: center; gap: 6px; font-size: 9px; color: var(--cream-text-muted); }
                    .priority-dot { width: 6px; height: 6px; border-radius: 50%; }
                    
                    .completed-badge { 
                        position: absolute; top: 6px; right: 6px; width: 18px; height: 18px;
                        background: #10B981; color: white; border-radius: 50%; 
                        display: flex; align-items: center; justify-content: center;
                    }
                    
                    .cell-menu { 
                        position: absolute; top: 100%; left: 0; right: 0; background: white; 
                        border-radius: 12px; padding: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.15);
                        z-index: 100; margin-top: 4px; border: 1px solid rgba(0,0,0,0.08);
                    }
                    .cell-menu button { 
                        width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px;
                        border: none; background: none; font-size: 13px; font-weight: 600; color: var(--cream-text-main);
                        cursor: pointer; border-radius: 8px; transition: all 0.15s;
                    }
                    .cell-menu button:hover { background: #F1F5F9; }
                    .cell-menu button.delete-action { color: #EA4335; }
                    .cell-menu button.delete-action:hover { background: #FEF2F2; }
                    
                    /* Timer Modal */
                    .timer-overlay { 
                        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px);
                        display: flex; align-items: center; justify-content: center; z-index: 1000;
                    }
                    .timer-modal { 
                        background: white; border-radius: 32px; padding: 48px; text-align: center;
                        box-shadow: 0 32px 64px rgba(0,0,0,0.2); min-width: 360px;
                    }
                    .timer-header h3 { font-size: 24px; font-weight: 800; color: var(--cream-text-main); margin: 16px 0 4px; }
                    .timer-header p { font-size: 14px; color: var(--cream-text-muted); margin: 0 0 24px; }
                    .timer-type { 
                        display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; 
                        border-radius: 10px; font-size: 13px; font-weight: 700;
                    }
                    .timer-display { 
                        font-size: 64px; font-weight: 800; color: var(--cream-text-main); 
                        font-family: 'SF Mono', 'Fira Code', monospace; margin: 32px 0;
                        letter-spacing: 0.05em;
                    }
                    .timer-actions { display: flex; gap: 12px; justify-content: center; }
                    .timer-btn { 
                        display: flex; align-items: center; gap: 8px; padding: 14px 24px; 
                        border-radius: 14px; font-weight: 700; font-size: 14px; cursor: pointer; 
                        border: none; transition: all 0.2s;
                    }
                    .timer-btn.play, .timer-btn.pause { background: #5C67F2; color: white; }
                    .timer-btn.pause { background: #F59E0B; }
                    .timer-btn.complete { background: #10B981; color: white; }
                    .timer-btn.cancel { background: #F1F5F9; color: var(--cream-text-main); }
                    .timer-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
                    
                    /* AI Recommendation */
                    .ai-recommendation { 
                        display: flex; gap: 20px; background: linear-gradient(135deg, #FFF 0%, #F5F3FF 100%); 
                        border-radius: 24px; padding: 24px; margin-top: 24px; border: 1px solid rgba(92, 103, 242, 0.2);
                        box-shadow: 0 8px 30px rgba(92, 103, 242, 0.12);
                    }
                    .ai-icon { 
                        width: 56px; height: 56px; background: #5C67F2; border-radius: 16px; 
                        display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;
                    }
                    .ai-content h4 { font-size: 17px; font-weight: 800; color: var(--cream-text-main); margin: 0 0 6px; }
                    .ai-content p { font-size: 14px; color: var(--cream-text-muted); margin: 0; line-height: 1.6; }
                    
                    /* Modal Styles */
                    .modal-overlay { 
                        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px);
                        display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
                    }
                    .modal-content { 
                        position: relative; background: white; border-radius: 32px; padding: 40px; 
                        max-width: 540px; width: 100%; max-height: 90vh; overflow-y: auto;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                        -ms-overflow-style: none; scrollbar-width: none;
                    }
                    .modal-content::-webkit-scrollbar { display: none; }
                    .close-modal-btn { 
                        position: absolute; top: 24px; right: 24px; background: transparent; border: none;
                        color: var(--cream-text-muted); cursor: pointer; transition: all 0.3s; padding: 8px; border-radius: 50%;
                    }
                    .close-modal-btn:hover { color: var(--cream-text-main); background: #F1F5F9; transform: rotate(90deg); }
                    .modal-header { margin-bottom: 32px; text-align: center; }
                    .modal-content h2 { font-size: 28px; font-weight: 800; margin: 0; color: var(--cream-text-main); }
                    .modal-header p { color: var(--cream-text-muted); font-size: 15px; margin-top: 8px; }
                    
                    .form-group { margin-bottom: 24px; }
                    .form-group label { display: block; font-size: 13px; font-weight: 700; color: var(--cream-text-main); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
                    .form-group input, .form-group select, .form-group textarea { 
                        width: 100%; padding: 16px 18px; border: 2px solid #E2E8F0; background-color: #F1F5F9;
                        border-radius: 16px; font-size: 15px; font-weight: 600; color: var(--cream-text-main);
                        transition: all 0.25s; font-family: inherit;
                    }
                    .form-group input:hover, .form-group select:hover, .form-group textarea:hover { border-color: #CBD5E1; background-color: #E2E8F0; }
                    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
                        outline: none; border-color: #5C67F2; background-color: white; 
                        box-shadow: 0 0 0 4px rgba(92, 103, 242, 0.1);
                    }
                    .form-group select { 
                        appearance: none;
                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                        background-repeat: no-repeat; background-position: right 16px center; background-size: 18px;
                        padding-right: 48px; cursor: pointer;
                    }
                    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    
                    .form-actions { display: flex; gap: 16px; margin-top: 40px; }
                    .cancel-btn { 
                        flex: 1; padding: 16px; border: 2px solid #F1F5F9; background: white; 
                        border-radius: 16px; font-weight: 700; color: var(--cream-text-main); cursor: pointer; transition: all 0.2s;
                    }
                    .cancel-btn:hover { background: #F1F5F9; border-color: #E2E8F0; }
                    .submit-btn { 
                        flex: 1.5; padding: 16px; border: none; background: #5C67F2; color: white; 
                        border-radius: 16px; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s;
                        box-shadow: 0 8px 20px rgba(92, 103, 242, 0.3);
                    }
                    .submit-btn:hover { background: #4F46E5; transform: translateY(-2px); box-shadow: 0 12px 24px rgba(92, 103, 242, 0.4); }
                    
                    @media (max-width: 1200px) {
                        .stats-row { grid-template-columns: repeat(3, 1fr); }
                    }
                    @media (max-width: 768px) {
                        .stats-row { grid-template-columns: repeat(2, 1fr); gap: 12px; }
                        .timetable-wrapper { padding: 12px; }
                        .form-row { grid-template-columns: 1fr; }
                        .modal-content { padding: 24px; border-radius: 24px; }
                        .week-nav { flex-wrap: wrap; gap: 10px; }
                    }
                `}</style>
            </DashboardLayout>
        </>
    )
}
