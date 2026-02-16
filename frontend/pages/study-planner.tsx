import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
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
const generateTimeSlots = (startHour: number, endHour: number, use24Hour: boolean = false) => {
    const slots = []
    for (let hour = startHour; hour <= endHour; hour++) {
        slots.push({
            hour,
            label: `${hour.toString().padStart(2, '0')}:00`,
            display: use24Hour
                ? `${hour.toString().padStart(2, '0')}:00`
                : (hour < 12 ? `${hour === 0 ? 12 : hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`)
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
    const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom')
    const [showSettings, setShowSettings] = useState(false)
    const [use24Hour, setUse24Hour] = useState(false)
    const [dialogConfig, setDialogConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    } | null>(null)

    const showAlert = (title: string, message: string) => {
        setDialogConfig({ isOpen: true, title, message, type: 'alert' })
    }

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setDialogConfig({ isOpen: true, title, message, type: 'confirm', onConfirm })
    }

    // Timer modal state
    const [timerEntry, setTimerEntry] = useState<PlanEntry | null>(null)
    const [timerSeconds, setTimerSeconds] = useState(0)
    const [timerRunning, setTimerRunning] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Configurable time range (persisted in localStorage)
    const [startHour, setStartHour] = useState(DEFAULT_START_HOUR)
    const [endHour, setEndHour] = useState(DEFAULT_END_HOUR)

    // Load time config and scroll mode from localStorage on mount
    useEffect(() => {
        const savedStartHour = localStorage.getItem('studyPlanner_startHour')
        const savedEndHour = localStorage.getItem('studyPlanner_endHour')
        const savedScrollMode = localStorage.getItem('studyPlanner_scrollMode') as 'mouse' | 'arrows'
        const saved24Hour = localStorage.getItem('studyPlanner_use24Hour') === 'true'
        if (savedStartHour) setStartHour(parseInt(savedStartHour))
        if (savedEndHour) setEndHour(parseInt(savedEndHour))
        if (savedScrollMode) setScrollMode(savedScrollMode)
        setUse24Hour(saved24Hour)
    }, [])

    const [scrollMode, setScrollMode] = useState<'mouse' | 'arrows'>('mouse')

    // Drag to scroll logic
    const isDragging = useRef(false)
    const startX = useRef(0)
    const scrollLeftValue = useRef(0)

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scrollMode !== 'mouse') return
        isDragging.current = true
        // Use currentTarget to refer to the .timetable-wrapper
        const wrapper = e.currentTarget as HTMLElement
        startX.current = e.pageX - wrapper.offsetLeft
        scrollLeftValue.current = wrapper.scrollLeft
        wrapper.style.cursor = 'grabbing'
        wrapper.style.userSelect = 'none'
    }

    const handleMouseLeave = (e: React.MouseEvent) => {
        if (!isDragging.current) return
        isDragging.current = false
        const wrapper = e.currentTarget as HTMLElement
        wrapper.style.cursor = 'default'
        wrapper.style.userSelect = 'auto'
    }

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!isDragging.current) return
        isDragging.current = false
        const wrapper = e.currentTarget as HTMLElement
        wrapper.style.cursor = 'default'
        wrapper.style.userSelect = 'auto'
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || scrollMode !== 'mouse') return
        e.preventDefault()
        const wrapper = e.currentTarget as HTMLElement
        const x = e.pageX - wrapper.offsetLeft
        const walk = (x - startX.current) * 2 // scroll speed multiplier
        wrapper.scrollLeft = scrollLeftValue.current - walk
    }

    const handleArrowScroll = (direction: 'left' | 'right') => {
        if (!timetableRef.current) return
        const scrollAmount = 120 + 1 // column width + gap
        timetableRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        })
    }

    // Save time config to localStorage when changed
    const updateSettings = (newStart: number, newEnd: number, newMode: 'mouse' | 'arrows', new24h: boolean) => {
        setStartHour(newStart)
        setEndHour(newEnd)
        setScrollMode(newMode)
        setUse24Hour(new24h)
        localStorage.setItem('studyPlanner_startHour', newStart.toString())
        localStorage.setItem('studyPlanner_endHour', newEnd.toString())
        localStorage.setItem('studyPlanner_scrollMode', newMode)
        localStorage.setItem('studyPlanner_use24Hour', new24h.toString())
        setShowSettings(false)
    }

    const formatTimeDisplay = (timeStr: string) => {
        if (!timeStr) return ''
        const [h, m] = timeStr.split(':').map(Number)
        if (use24Hour) {
            return `${h.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`
        }
        const ampm = h >= 12 ? 'PM' : 'AM'
        const hour = h % 12 || 12
        return `${hour}:${(m || 0).toString().padStart(2, '0')} ${ampm}`
    }

    // Generate TIME_SLOTS based on config
    const TIME_SLOTS = useMemo(() => generateTimeSlots(startHour, endHour, use24Hour), [startHour, endHour, use24Hour])

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

    // Keyboard arrow navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (scrollMode !== 'arrows' || showModal || showSettings) return
            if (e.key === 'ArrowLeft') {
                handleArrowScroll('left')
            } else if (e.key === 'ArrowRight') {
                handleArrowScroll('right')
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [scrollMode, showModal, showSettings])

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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    const fetchEntries = async () => {
        try {
            const token = await getToken()
            const weekStart = weekDates[0]?.date
            if (!weekStart) return

            const res = await fetch(`${API_URL}/api/planner/entries/weekly/${weekStart}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            if (!res.ok) {
                throw new Error('Failed to fetch entries')
            }
            
            const data = await res.json()
            setEntries(data.entries || [])
        } catch (err) {
            console.error('Failed to fetch entries:', err)
            showAlert('Error', 'Failed to load study plan entries')
        }
    }

    const fetchDailyBrief = async () => {
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/planner/daily-brief`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            if (!res.ok) {
                throw new Error('Failed to fetch daily brief')
            }
            
            const data = await res.json()
            setDailyBrief(data)
        } catch (err) {
            console.error('Failed to fetch daily brief:', err)
            // Don't show error for daily brief as it's not critical
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const endHour = formData.start_hour + formData.duration

        // Check for conflicts
        const conflictingEntries = entries.filter(entry => {
            if (editingEntry && entry.id === editingEntry.id) return false
            if (entry.scheduled_date !== formData.scheduled_date) return false
            const existingStart = parseInt(entry.start_time.split(':')[0])
            const existingEnd = parseInt(entry.end_time.split(':')[0])
            const newStart = formData.start_hour
            const newEnd = endHour
            return (newStart < existingEnd) && (existingStart < newEnd)
        })

        if (conflictingEntries.length > 0) {
            const conflictNames = conflictingEntries.map(e => e.subject).join(', ')
            showConfirm(
                'Schedule Conflict',
                `This session overlaps with: ${conflictNames}. Do you want to create it anyway?`,
                () => performSubmit()
            )
            return
        }

        performSubmit()
    }

    const performSubmit = async () => {
        const endHour = formData.start_hour + formData.duration
        setLoading(true)
        try {
            const token = await getToken()
            const method = editingEntry ? 'PUT' : 'POST'
            const url = editingEntry
                ? `${API_URL}/api/planner/entries/${editingEntry.id}`
                : `${API_URL}/api/planner/entries`

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

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const error = await res.json()
                showAlert('Error', error.detail || 'Failed to save entry')
                return
            }

            setShowModal(false)
            setEditingEntry(null)
            resetForm()
            
            // Refresh data
            await Promise.all([fetchEntries(), fetchDailyBrief()])
            
            showAlert('Success', editingEntry ? 'Entry updated successfully' : 'Entry created successfully')
        } catch (err) {
            console.error('Failed to save entry:', err)
            showAlert('Error', 'Failed to save entry. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleComplete = async (entryId: string) => {
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/planner/entries/${entryId}/complete`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            
            if (!res.ok) {
                throw new Error('Failed to complete entry')
            }
            
            // Refresh data
            await Promise.all([fetchEntries(), fetchDailyBrief()])
            setActiveCellMenu(null)
            showAlert('Success', 'Session completed!')
        } catch (err) {
            console.error('Failed to complete entry:', err)
            showAlert('Error', 'Failed to mark session as complete')
        }
    }

    const handleStart = async (entry: PlanEntry) => {
        try {
            const token = await getToken()
            // Only start if not already in progress
            if (entry.status !== 'in_progress') {
                const res = await fetch(`${API_URL}/api/planner/entries/${entry.id}/start`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (!res.ok) {
                    throw new Error('Failed to start entry')
                }
                
                await fetchEntries()
            }
            setActiveCellMenu(null)

            // Calculate remaining time
            const now = new Date()
            const [endH, endM] = entry.end_time.split(':').map(Number)
            const target = new Date()
            target.setHours(endH, endM, 0, 0)

            let diffSeconds = Math.floor((target.getTime() - now.getTime()) / 1000)

            // If the time is in the past or way in future, use planned duration
            if (diffSeconds <= 0 || diffSeconds > 86400) {
                const [startH, startM] = entry.start_time.split(':').map(Number)
                const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)
                diffSeconds = durationMinutes * 60
            }

            setTimerEntry(entry)
            setTimerSeconds(diffSeconds)
            setTimerRunning(false) // Don't start instantly
        } catch (err) {
            console.error('Failed to start entry:', err)
            showAlert('Error', 'Failed to start session')
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
        showConfirm('Delete Session', 'Are you sure you want to delete this study session?', async () => {
            try {
                const token = await getToken()
                const res = await fetch(`${API_URL}/api/planner/entries/${entryId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (!res.ok) {
                    throw new Error('Failed to delete entry')
                }
                
                // Refresh data
                await Promise.all([fetchEntries(), fetchDailyBrief()])
                setActiveCellMenu(null)
                showAlert('Success', 'Session deleted successfully')
            } catch (err) {
                console.error('Failed to delete entry:', err)
                showAlert('Error', 'Failed to delete session')
            }
        })
    }

    // Check if entry is for today
    const isEntryToday = (entry: PlanEntry) => {
        const today = new Date().toISOString().split('T')[0]
        return entry.scheduled_date === today
    }

    // Check if this is the CURRENT active time slot (now is between start and end)
    const isCurrentSlot = (entry: PlanEntry) => {
        if (entry.status === 'completed') return false

        const now = new Date()
        const today = now.toISOString().split('T')[0]
        if (entry.scheduled_date !== today) return false

        const [startH, startM] = entry.start_time.split(':').map(Number)
        const [endH, endM] = entry.end_time.split(':').map(Number)

        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const currentTotalMins = currentHour * 60 + currentMinute
        const startTotalMins = startH * 60 + (startM || 0)
        const endTotalMins = endH * 60 + (endM || 0)

        return currentTotalMins >= startTotalMins && currentTotalMins < endTotalMins
    }

    // Check if this is an UPCOMING slot today (hasn't started yet)
    const isFutureSlotToday = (entry: PlanEntry) => {
        if (entry.status === 'completed' || entry.status === 'in_progress') return false

        const now = new Date()
        const today = now.toISOString().split('T')[0]
        if (entry.scheduled_date !== today) return false

        const [startH, startM] = entry.start_time.split(':').map(Number)
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const currentTotalMins = currentHour * 60 + currentMinute
        const startTotalMins = startH * 60 + (startM || 0)

        return currentTotalMins < startTotalMins
    }

    // Can start session timer: only for CURRENT slot or UPCOMING slots today
    // Past slots (even today) should use "Continue Now" if time remains
    const canStartSession = (entry: PlanEntry) => {
        if (entry.status === 'completed') return false

        // Can start if it's the current active slot
        if (isCurrentSlot(entry)) return true

        // Can start if it's an upcoming slot today (allows pre-starting)
        if (isFutureSlotToday(entry)) return true

        // For future dates, show Start button
        const today = new Date().toISOString().split('T')[0]
        if (entry.scheduled_date > today) return true

        return false
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
        const isOpening = activeCellMenu !== entry.id
        if (isOpening) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            // Menu height is approx 200px. If less than 250px space below, and more space above, flip it.
            if (rect.top < 200) {
                setMenuPosition('bottom')
            } else if (spaceBelow < 250) {
                setMenuPosition('top')
            } else {
                setMenuPosition('bottom')
            }
            setActiveCellMenu(entry.id)
        } else {
            setActiveCellMenu(null)
        }
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
                                <div className="stat-value">{dailyBrief?.streak?.current || 0}</div>
                                <div className="stat-label">Day Streak</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#F0FDFA', color: '#0D9488' }}>
                                <Target size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">
                                    {computedStats.completedSessions}
                                    <span className="stat-value-sub">/{computedStats.totalSessions}</span>
                                </div>
                                <div className="stat-label">Sessions Done</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#EDEEFF', color: '#5C67F2' }}>
                                <Clock size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">
                                    {computedStats.completedHours}
                                    <span className="stat-value-sub">/{computedStats.plannedHours}h</span>
                                </div>
                                <div className="stat-label">Hours</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#F0FDF4', color: '#10B981' }}>
                                <TrendingUp size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{computedStats.completionRate}%</div>
                                <div className="stat-label">Completion</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#FEF2F2', color: '#EA4335' }}>
                                <Zap size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{computedStats.highPriorityCount}</div>
                                <div className="stat-label">High Priority</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                                <Award size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{computedStats.avgPerformance || '—'}</div>
                                <div className="stat-label">Avg Score</div>
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
                    <div className="timetable-container">
                        {scrollMode === 'arrows' && (
                            <>
                                <button className="scroll-arrow arrow-left" onClick={() => handleArrowScroll('left')}>
                                    <ChevronLeft size={24} />
                                </button>
                                <button className="scroll-arrow arrow-right" onClick={() => handleArrowScroll('right')}>
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                        <div
                            className={`timetable-wrapper ${scrollMode === 'arrows' ? 'arrows-mode' : ''}`}
                            ref={timetableRef}
                            onMouseDown={handleMouseDown}
                            onMouseLeave={handleMouseLeave}
                            onMouseUp={handleMouseUp}
                            onMouseMove={handleMouseMove}
                        >
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

                                            // Check if this is the current active slot
                                            const isCurrentActive = hasEntry && entry ? isCurrentSlot(entry) : false

                                            return (
                                                <div
                                                    key={cellKey}
                                                    className={`timetable-cell ${hasEntry ? 'has-entry' : ''} ${entry?.status === 'completed' ? 'completed' : ''} ${entry?.status === 'in_progress' ? 'in-progress' : ''} ${isPastEvent ? 'past-event' : ''} ${isCurrentActive ? 'current-slot' : ''}`}
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
                                                                <span>{formatTimeDisplay(entry.start_time)} - {formatTimeDisplay(entry.end_time)}</span>
                                                            </div>

                                                            {/* Action Menu */}
                                                            {activeCellMenu === entry.id && (
                                                                <div className={`cell-menu ${menuPosition}`} onClick={e => e.stopPropagation()}>
                                                                    <button onClick={() => handleEditEntry(entry)}>
                                                                        <Edit3 size={14} /> Edit
                                                                    </button>

                                                                    {/* Start Timer - only for current or future slots */}
                                                                    {canStartSession(entry) && (
                                                                        <button onClick={() => handleStart(entry)}>
                                                                            <Play size={14} /> {isCurrentSlot(entry) || entry.status === 'in_progress' || isPastEvent ? 'Continue now' : 'Start'}
                                                                        </button>
                                                                    )}

                                                                    {/* Mark Done - for today's sessions that aren't completed */}
                                                                    {entry.status !== 'completed' && isEntryToday(entry) && (
                                                                        <button onClick={() => handleComplete(entry.id)}>
                                                                            <Check size={14} /> Mark Done
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
                        <div className="timer-modal redesigned">
                            <button className="timer-close-btn" onClick={() => { setTimerEntry(null); setTimerRunning(false); }} title="Close">
                                <X size={20} />
                            </button>
                            <div className="timer-header">
                                <div className="timer-badge">
                                    <span className="timer-type-icon">{getStudyTypeInfo(timerEntry.study_type).icon}</span>
                                    <span className="timer-type-label">{getStudyTypeInfo(timerEntry.study_type).label}</span>
                                </div>
                                <h3>{timerEntry.subject}</h3>
                                {timerEntry.topic && <p className="timer-topic">{timerEntry.topic}</p>}
                            </div>

                            <div className="timer-main">
                                {!timerRunning ? (
                                    <div className="timer-edit-zone">
                                        <div className="time-input-group">
                                            <div className="time-unit">
                                                <input
                                                    type="number"
                                                    value={Math.floor(timerSeconds / 3600)}
                                                    onChange={(e) => {
                                                        const h = Math.max(0, parseInt(e.target.value) || 0)
                                                        const m = Math.floor((timerSeconds % 3600) / 60)
                                                        const s = timerSeconds % 60
                                                        setTimerSeconds(h * 3600 + m * 60 + s)
                                                    }}
                                                />
                                                <span>HRS</span>
                                            </div>
                                            <span className="time-separator">:</span>
                                            <div className="time-unit">
                                                <input
                                                    type="number"
                                                    value={Math.floor((timerSeconds % 3600) / 60)}
                                                    onChange={(e) => {
                                                        const h = Math.floor(timerSeconds / 3600)
                                                        const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                                                        const s = timerSeconds % 60
                                                        setTimerSeconds(h * 3600 + m * 60 + s)
                                                    }}
                                                />
                                                <span>MIN</span>
                                            </div>
                                            <span className="time-separator">:</span>
                                            <div className="time-unit">
                                                <input
                                                    type="number"
                                                    value={timerSeconds % 60}
                                                    onChange={(e) => {
                                                        const h = Math.floor(timerSeconds / 3600)
                                                        const m = Math.floor((timerSeconds % 3600) / 60)
                                                        const s = Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                                                        setTimerSeconds(h * 3600 + m * 60 + s)
                                                    }}
                                                />
                                                <span>SEC</span>
                                            </div>
                                        </div>
                                        <p className="timer-hint">Adjust the time if needed before starting</p>
                                    </div>
                                ) : (
                                    <div className="timer-active-zone">
                                        <div className="timer-display-modern">
                                            {formatTimer(timerSeconds)}
                                        </div>
                                        <div className="timer-progress-container">
                                            <div
                                                className="timer-progress-bar"
                                                style={{ width: `${Math.min(100, (timerSeconds / (60 * 60)) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="timer-actions-redesigned">
                                {!timerRunning ? (
                                    <button className="timer-btn-primary" onClick={() => setTimerRunning(true)}>
                                        <Play size={24} fill="currentColor" />
                                        <span>Start Timer</span>
                                    </button>
                                ) : (
                                    <button className="timer-btn-secondary pause" onClick={() => setTimerRunning(false)}>
                                        <Pause size={20} />
                                        <span>Pause</span>
                                    </button>
                                )}

                                {timerRunning && (
                                    <button className="timer-btn-primary complete" onClick={handleTimerComplete}>
                                        <Check size={20} />
                                        <span>Complete Session</span>
                                    </button>
                                )}

                                <button className="timer-btn-discard" onClick={() => { setTimerEntry(null); setTimerRunning(false); }}>
                                    <X size={20} />
                                    <span>Discard</span>
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
                                {/* Date removed - auto-determined from cell click in weekly view */}
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
                        <div className="modal-content settings-modal" onClick={e => e.stopPropagation()} data-lenis-prevent>
                            <button className="close-modal-btn" onClick={() => setShowSettings(false)} title="Close">
                                <X size={24} />
                            </button>
                            <div className="modal-header">
                                <h2>Timetable Settings</h2>
                                <p>Configure your preferences</p>
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
                                                    {i < 12 ? `${i === 0 ? 12 : i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
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
                                                    {i < 12 ? `${i === 0 ? 12 : i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '20px' }}>
                                    <label>Time Format</label>
                                    <div className="toggle-group">
                                        <button
                                            className={`toggle-option ${!use24Hour ? 'active' : ''}`}
                                            onClick={() => setUse24Hour(false)}
                                        >
                                            12-Hour
                                        </button>
                                        <button
                                            className={`toggle-option ${use24Hour ? 'active' : ''}`}
                                            onClick={() => setUse24Hour(true)}
                                        >
                                            24-Hour
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '20px' }}>
                                    <label>Navigation Mode</label>
                                    <div className="toggle-group">
                                        <button
                                            className={`toggle-option ${scrollMode === 'mouse' ? 'active' : ''}`}
                                            onClick={() => setScrollMode('mouse')}
                                        >
                                            Scroll
                                        </button>
                                        <button
                                            className={`toggle-option ${scrollMode === 'arrows' ? 'active' : ''}`}
                                            onClick={() => setScrollMode('arrows')}
                                        >
                                            Arrow Keys
                                        </button>
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="cancel-btn" onClick={() => setShowSettings(false)}>Cancel</button>
                                    <button
                                        type="button"
                                        className="submit-btn"
                                        onClick={() => updateSettings(startHour, endHour, scrollMode, use24Hour)}
                                    >
                                        Save Settings
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}



                {/* Custom Dialog (Alert/Confirm) */}
                {dialogConfig?.isOpen && (
                    <div className="modal-overlay" style={{ zIndex: 2000 }}>
                        <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%', background: dialogConfig.type === 'confirm' ? '#EEF2FF' : '#FEF2F2',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                                color: dialogConfig.type === 'confirm' ? '#5C67F2' : '#EA4335'
                            }}>
                                <Zap size={32} />
                            </div>
                            <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px', color: 'var(--cream-text-main)' }}>{dialogConfig.title}</h3>
                            <p style={{ color: 'var(--cream-text-muted)', marginBottom: '32px', fontSize: '15px', lineHeight: '1.6' }}>{dialogConfig.message}</p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {dialogConfig.type === 'confirm' && (
                                    <button className="cancel-btn" onClick={() => setDialogConfig({ ...dialogConfig, isOpen: false })}>Cancel</button>
                                )}
                                <button className="submit-btn" onClick={() => {
                                    dialogConfig.onConfirm?.();
                                    setDialogConfig({ ...dialogConfig, isOpen: false });
                                }}>
                                    {dialogConfig.type === 'confirm' ? 'Confirm' : 'OK'}
                                </button>
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
                    
                    .stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px; margin-bottom: 32px; }
                    .stat-card { 
                        background: white;
                        border-radius: 20px; padding: 16px 20px; 
                        display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 12px; 
                        border: 1px solid rgba(0,0,0,0.1); 
                        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.03);
                        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative;
                        overflow: hidden;
                        height: 100%;
                    }
                    .stat-card::after {
                        content: '';
                        position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
                        background: linear-gradient(90deg, transparent, currentColor, transparent);
                        opacity: 0; transition: opacity 0.3s;
                    }
                    .stat-card:hover { 
                        transform: translateY(-5px); 
                        box-shadow: 0 25px 40px -12px rgba(0,0,0,0.1);
                        border-color: rgba(92, 103, 242, 0.4);
                        background: #FAFBFC;
                    }
                    .stat-icon { 
                        width: 44px; height: 44px; border-radius: 14px; 
                        display: flex; align-items: center; justify-content: center;
                        transition: transform 0.3s ease;
                    }
                    .stat-card:hover .stat-icon { transform: scale(1.1); }
                    
                    .stat-content { display: flex; flex-direction: column; gap: 4px; width: 100%; }
                    .stat-value { 
                        font-size: 28px; font-weight: 800; color: var(--cream-text-main); 
                        line-height: 1; letter-spacing: -0.02em; display: flex; align-items: baseline; gap: 2px;
                    }
                    .stat-value-sub {
                        font-size: 16px; color: var(--cream-text-muted); font-weight: 600;
                    }
                    .stat-label { 
                        font-size: 13px; font-weight: 600; color: var(--cream-text-muted); 
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    }
                    
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
                    .timetable-container {
                        position: relative;
                        background: white; border-radius: 24px; padding: 0; 
                        border: 2px solid #E2E8F0; box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                        overflow: hidden;
                        margin-bottom: 32px;
                    }
                    .timetable-wrapper { 
                        overflow-x: auto;
                        position: relative;
                        scrollbar-width: none; /* Firefox */
                        -ms-overflow-style: none; /* IE/Edge */
                    }
                    .timetable-wrapper::-webkit-scrollbar { display: none; } /* Chrome/Safari */
                    .timetable-wrapper.arrows-mode { overflow-x: hidden; }
                    .timetable { 
                        min-width: calc(100px + var(--slot-count, 17) * 160px); 
                        border-collapse: separate; border-spacing: 0; 
                        padding: 0;
                        width: max-content;
                    }
                    
                    .timetable-header { 
                        display: grid; grid-template-columns: 100px repeat(var(--slot-count, 17), minmax(160px, 1fr)); gap: 2px;
                        background: #E2E8F0;
                        border-bottom: 2px solid #E2E8F0;
                    }
                    .time-label-header { 
                        padding: 14px 8px; font-size: 11px; font-weight: 700; color: var(--cream-text-muted);
                        text-transform: uppercase; letter-spacing: 0.05em; background: #F8FAFC;
                        display: flex; align-items: center; justify-content: center;
                        position: sticky; left: 0; z-index: 20;
                        border-right: 2px solid #E2E8F0;
                    }
                    .time-slot-header { 
                        padding: 14px 4px; font-size: 11px; font-weight: 700; color: var(--cream-text-main);
                        text-align: center; background: #F8FAFC;
                    }
                    .time-slot-header:last-child { border-right: none; }
                    
                    .timetable-row { 
                        display: grid; grid-template-columns: 100px repeat(var(--slot-count, 17), minmax(160px, 1fr)); gap: 2px;
                        background: #E2E8F0;
                        border-bottom: 2px solid #E2E8F0;
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
                        box-shadow: 4px 0 12px rgba(0,0,0,0.15);
                        position: sticky; left: 0; z-index: 20;
                        border-right: 2px solid #E2E8F0;
                    }
                    .day-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
                    .day-date { 
                        font-size: 18px; font-weight: 800; background: rgba(255,255,255,0.15); 
                        width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
                    }
                    
                    .timetable-cell { 
                        min-height: 120px; 
                        background: linear-gradient(135deg, #FFFFFF 0%, #FAFBFC 100%);
                        padding: 8px;
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
                        cursor: pointer;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative; z-index: 1;
                    }
                    .cell-entry:hover { 
                        transform: translateY(-2px) scale(1.008); 
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
                        position: absolute; left: 0; min-width: 200px; background: white; 
                        border-radius: 12px; padding: 8px; box-shadow: 0 12px 48px rgba(0,0,0,0.25);
                        z-index: 100; border: 1.5px solid #E2E8F0;
                    }
                    .cell-menu.bottom {
                        top: 100%; margin-top: 8px;
                        animation: fadeInScaleBottom 0.2s ease-out;
                    }
                    .cell-menu.top {
                        bottom: 100%; margin-bottom: 8px;
                        animation: fadeInScaleTop 0.2s ease-out;
                    }
                    @keyframes fadeInScaleBottom {
                        from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    @keyframes fadeInScaleTop {
                        from { opacity: 0; transform: scale(0.95) translateY(10px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    .cell-menu button { 
                        width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px;
                        border: none; background: none; font-size: 13px; font-weight: 600; color: var(--cream-text-main);
                        cursor: pointer; border-radius: 8px; transition: all 0.15s;
                    }
                    .cell-menu button:hover { background: #EEF2FF; color: #5C67F2; }
                    .cell-menu button.delete-action { color: #EA4335; }
                    .cell-menu button.delete-action:hover { background: #FEF2F2; }
                    
                    /* Timer Modal - Redesigned */
                    .timer-overlay { 
                        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px);
                        display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
                    }
                    .timer-modal.redesigned { 
                        background: white; border-radius: 40px; padding: 48px; text-align: center;
                        box-shadow: 0 40px 100px -20px rgba(0,0,0,0.5); width: 100%; max-width: 560px;
                        border: 1px solid rgba(255,255,255,0.1);
                        position: relative; overflow: hidden;
                    }
                    .timer-modal.redesigned::before {
                        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px;
                        background: linear-gradient(90deg, #5C67F2, #10B981, #F59E0B, #EA4335);
                    }
                    .timer-close-btn {
                        position: absolute; top: 24px; right: 24px; width: 40px; height: 40px;
                        border-radius: 50%; background: #F8FAFC; border: 1px solid #E2E8F0;
                        display: flex; align-items: center; justify-content: center;
                        color: #94A3B8; cursor: pointer; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        z-index: 10;
                    }
                    .timer-close-btn:hover {
                        background: #fee2e2; color: #EA4335; transform: rotate(90deg);
                        border-color: #fecaca;
                    }
                    .timer-badge {
                        display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; 
                        background: #F1F5F9; border-radius: 100px; margin-bottom: 24px;
                    }
                    .timer-type-icon { font-size: 16px; }
                    .timer-type-label { font-size: 12px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 1px; }
                    
                    .timer-modal h3 { font-size: 32px; font-weight: 900; color: var(--cream-text-main); margin: 0 0 8px; letter-spacing: -1px; }
                    .timer-topic { font-size: 16px; color: var(--cream-text-muted); font-weight: 500; margin-bottom: 40px; }
                    
                    .timer-main { margin-bottom: 48px; }

                    /* Edit Zone */
                    .timer-edit-zone { display: flex; flex-direction: column; align-items: center; gap: 24px; }
                    .time-input-group { display: flex; align-items: center; gap: 12px; }
                    .time-unit { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                    .time-unit input {
                        width: 90px; height: 90px; background: #F8FAFC; border: 3px solid #E2E8F0;
                        border-radius: 24px; font-size: 36px; font-weight: 800; color: var(--cream-text-main);
                        text-align: center; transition: all 0.2s;
                    }
                    .time-unit input:focus { outline: none; border-color: #5C67F2; background: white; box-shadow: 0 12px 24px rgba(92, 103, 242, 0.15); }
                    .time-unit span { font-size: 10px; font-weight: 800; color: #94A3B8; letter-spacing: 1px; }
                    .time-separator { font-size: 48px; font-weight: 300; color: #E2E8F0; margin-top: -24px; }
                    .timer-hint { font-size: 13px; color: #94A3B8; font-weight: 500; font-style: italic; }

                    /* Active Zone */
                    .timer-display-modern { 
                        font-size: 96px; font-weight: 900; color: var(--cream-text-main); 
                        font-family: 'Inter', system-ui, sans-serif; margin-bottom: 12px;
                        letter-spacing: -2px; font-variant-numeric: tabular-nums;
                    }
                    .timer-progress-container { width: 100%; height: 12px; background: #F1F5F9; border-radius: 100px; overflow: hidden; }
                    .timer-progress-bar { height: 100%; background: linear-gradient(90deg, #5C67F2, #7C3AED); transition: width 1s linear; }

                    /* Actions */
                    .timer-actions-redesigned { display: flex; flex-direction: column; gap: 12px; }
                    .timer-btn-primary {
                        display: flex; align-items: center; justify-content: center; gap: 12px;
                        padding: 18px 32px; background: var(--cream-text-main); color: white;
                        border: none; border-radius: 20px; font-size: 18px; font-weight: 800;
                        cursor: pointer; transition: all 0.2s;
                    }
                    .timer-btn-primary:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(92, 103, 242, 0.3); background: #5C67F2; }
                    .timer-btn-primary.complete { background: #10B981; }
                    .timer-btn-primary.complete:hover { background: #059669; }

                    .timer-btn-secondary {
                        display: flex; align-items: center; justify-content: center; gap: 8px;
                        padding: 14px 24px; background: #F1F5F9; color: var(--cream-text-main);
                        border: none; border-radius: 16px; font-size: 15px; font-weight: 700;
                        cursor: pointer; transition: all 0.2s;
                    }
                    .timer-btn-secondary.pause { background: #FFF7ED; color: #D97706; }
                    .timer-btn-secondary:hover { transform: translateY(-2px); background: #E2E8F0; }

                    .timer-btn-discard {
                        display: flex; align-items: center; justify-content: center; gap: 6px;
                        padding: 14px 24px; background: #fee2e2; color: #991b1b;
                        border: 2px solid #fecaca; border-radius: 16px; font-size: 14px; font-weight: 700;
                        cursor: pointer; transition: all 0.2s; margin-top: 12px;
                    }
                    .timer-btn-discard:hover { background: #fecaca; transform: translateY(-2px); border-color: #f87171; }
                    
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
                        box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.35);
                        border: 1px solid rgba(0,0,0,0.05);
                        -ms-overflow-style: none; scrollbar-width: none;
                    }
                    .modal-content::-webkit-scrollbar { display: none; }
                    .close-modal-btn { 
                        position: absolute; top: 24px; right: 24px; background: #F1F5F9; border: none;
                        color: var(--cream-text-muted); cursor: pointer; transition: all 0.3s; 
                        padding: 6px; border-radius: 50%; width: 36px; height: 36px;
                        display: flex; align-items: center; justify-content: center;
                    }
                    .close-modal-btn:hover { color: #DC2626; background: #FEE2E2; transform: rotate(90deg); }
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
                        .timetable-wrapper { padding: 0; }
                        .timetable { padding: 0 12px 0 0; }
                        .form-row { grid-template-columns: 1fr; }
                        .modal-content { padding: 24px; border-radius: 24px; }
                        .week-nav { flex-wrap: wrap; gap: 10px; }
                    }

                    /* Scroll Arrow Styles */
                    .scroll-arrow {
                        position: absolute; top: 50%; transform: translateY(-50%);
                        width: 48px; height: 48px; border-radius: 50%;
                        background: white; border: 1px solid rgba(0,0,0,0.1);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        display: flex; align-items: center; justify-content: center;
                        cursor: pointer; z-index: 30; transition: all 0.2s;
                        color: var(--cream-text-main);
                    }
                    .scroll-arrow:hover { background: var(--cream-text-main); color: white; transform: translateY(-50%) scale(1.1); }
                    .arrow-left { left: 110px; }
                    .arrow-right { right: 10px; }

                    /* Toggle Group Styles */
                    .toggle-group {
                        display: flex; background: #F1F5F9; padding: 4px; border-radius: 12px;
                        border: 2px solid #E2E8F0;
                    }
                    .toggle-option {
                        flex: 1; padding: 10px; border: none; background: transparent;
                        border-radius: 8px; font-size: 13px; font-weight: 700;
                        color: var(--cream-text-muted); cursor: pointer; transition: all 0.2s;
                    }
                    .toggle-option.active {
                        background: white; color: #5C67F2;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    }

                     /* =========================================================================
                        STUDY PLANNER - Entry State Styles
                        ========================================================================= */
                    
                    /* Past event indicator */
                    .timetable-cell.past-event .cell-entry {
                        opacity: 0.7;
                    }
                    .timetable-cell.past-event .cell-entry::after {
                        content: '⚠️ Missed';
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        font-size: 9px;
                        background: #FEE2E2;
                        color: #B91C1C;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-weight: 700;
                    }
                    
                    /* Current active slot - pulsing border */
                    .timetable-cell.current-slot {
                        position: relative;
                    }
                    .timetable-cell.current-slot .cell-entry {
                        box-shadow: 0 0 0 3px #10B981, 0 8px 24px rgba(16, 185, 129, 0.25);
                        animation: pulse-border 2s ease-in-out infinite;
                    }
                    .timetable-cell.current-slot .cell-entry::before {
                        content: '🔴 LIVE';
                        position: absolute;
                        top: -10px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                        color: white;
                        font-size: 10px;
                        padding: 3px 10px;
                        border-radius: 10px;
                        font-weight: 700;
                        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
                        z-index: 10;
                    }
                    @keyframes pulse-border {
                        0%, 100% { box-shadow: 0 0 0 3px #10B981, 0 8px 24px rgba(16, 185, 129, 0.25); }
                        50% { box-shadow: 0 0 0 5px #10B981, 0 8px 32px rgba(16, 185, 129, 0.4); }
                    }
                `}</style>
            </DashboardLayout >
        </>
    )
}
