import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
    value: string // ISO date string (YYYY-MM-DD)
    onChange: (date: string) => void
    label?: string
    required?: boolean
    minDate?: string
    maxDate?: string
}

const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    label,
    required = false,
    minDate,
    maxDate
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const pickerRef = useRef<HTMLDivElement>(null)

    // Parse the value to a Date object
    const selectedDate = value ? new Date(value + 'T00:00:00') : null

    useEffect(() => {
        if (selectedDate) {
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
        }
    }, [value])

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return ''
        const date = new Date(dateStr + 'T00:00:00')
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()

        return { daysInMonth, startingDayOfWeek, year, month }
    }

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    const handleDateSelect = (day: number) => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const selected = new Date(year, month, day)

        // Check if date is within min/max bounds
        if (minDate && selected < new Date(minDate + 'T00:00:00')) return
        if (maxDate && selected > new Date(maxDate + 'T00:00:00')) return

        const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        onChange(formattedDate)
        setIsOpen(false)
    }

    const isDateDisabled = (day: number) => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const date = new Date(year, month, day)

        if (minDate && date < new Date(minDate + 'T00:00:00')) return true
        if (maxDate && date > new Date(maxDate + 'T00:00:00')) return true
        return false
    }

    const isToday = (day: number) => {
        const today = new Date()
        return (
            currentMonth.getFullYear() === today.getFullYear() &&
            currentMonth.getMonth() === today.getMonth() &&
            day === today.getDate()
        )
    }

    const isSelected = (day: number) => {
        if (!selectedDate) return false
        return (
            currentMonth.getFullYear() === selectedDate.getFullYear() &&
            currentMonth.getMonth() === selectedDate.getMonth() &&
            day === selectedDate.getDate()
        )
    }

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return (
        <div className="date-picker-wrapper" ref={pickerRef}>
            {label && (
                <label className="date-picker-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}

            <div
                className={`date-picker-input ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="date-value">
                    {value ? formatDisplayDate(value) : 'Select date'}
                </span>
                <div className="date-icon">
                    <Calendar size={18} />
                </div>
            </div>

            {isOpen && (
                <div className="date-picker-dropdown">
                    <button className="today-btn" type="button" onClick={() => {
                        const today = new Date()
                        onChange(today.toISOString().split('T')[0])
                        setIsOpen(false)
                    }}>
                        Today
                    </button>
                    <div className="calendar-header">
                        <button
                            type="button"
                            className="nav-btn"
                            onClick={handlePrevMonth}
                            aria-label="Previous month"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="month-year">{monthName}</span>
                        <button
                            type="button"
                            className="nav-btn"
                            onClick={handleNextMonth}
                            aria-label="Next month"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="calendar-weekdays">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="weekday">{day}</div>
                        ))}
                    </div>

                    <div className="calendar-days">
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="calendar-day empty" />
                        ))}

                        {/* Days of the month */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1
                            const disabled = isDateDisabled(day)
                            const today = isToday(day)
                            const selected = isSelected(day)

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    className={`calendar-day ${selected ? 'selected' : ''} ${today ? 'today' : ''} ${disabled ? 'disabled' : ''}`}
                                    onClick={() => !disabled && handleDateSelect(day)}
                                    disabled={disabled}
                                >
                                    {day}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            <style jsx>{`
                .date-picker-wrapper {
                    position: relative;
                    width: 100%;
                }

                .date-picker-label {
                    display: block;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--cream-text-main);
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .required {
                    color: #EA4335;
                }

                .date-picker-input {
                    position: relative;
                    width: 100%;
                    padding: 10px 14px;
                    padding-right: 36px;
                    border: 1px solid #E2E8F0;
                    background-color: #F1F5F9;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--cream-text-main);
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    height: 42px;
                }

                .date-picker-input:hover {
                    border-color: #CBD5E1;
                    background-color: #E2E8F0;
                }

                .date-picker-input.open,
                .date-picker-input:focus {
                    outline: none;
                    border-color: #5C67F2;
                    background-color: white;
                    box-shadow: 0 0 0 3px rgba(92, 103, 242, 0.1);
                }

                .date-value {
                    flex: 1;
                    color: var(--cream-text-main);
                }

                .date-icon {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #64748B;
                    pointer-events: none;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .date-icon :global(svg) {
                    width: 16px;
                    height: 16px;
                }

                .date-picker-input:hover .date-icon {
                    color: #5C67F2;
                    transform: translateY(-50%) scale(1.1);
                }

                .date-picker-dropdown {
                    position: absolute;
                    top: calc(100% + 6px);
                    left: 0;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
                    border: 1px solid rgba(0, 0, 0, 0.06);
                    padding: 16px;
                    z-index: 1000;
                    min-width: 260px;
                    width: auto;
                    animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .today-btn {
                    width: 100%;
                    padding: 8px;
                    background: #F1F5F9;
                    border: none;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #5C67F2;
                    text-transform: uppercase;
                    cursor: pointer;
                    margin-bottom: 12px;
                    transition: all 0.2s;
                }

                .today-btn:hover {
                    background: #EDEEFF;
                    transform: translateY(-1px);
                }

                .calendar-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }

                .nav-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    border: none;
                    background: #F1F5F9;
                    color: var(--cream-text-main);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .nav-btn :global(svg) {
                    width: 14px;
                    height: 14px;
                }

                .nav-btn:hover {
                    background: #5C67F2;
                    color: white;
                    transform: scale(1.05);
                }

                .month-year {
                    font-size: 13px;
                    font-weight: 700;
                    color: var(--cream-text-main);
                }

                .calendar-weekdays {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                    margin-bottom: 4px;
                }

                .weekday {
                    text-align: center;
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--cream-text-muted);
                    text-transform: uppercase;
                    padding: 4px 0;
                }

                .calendar-days {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }

                .calendar-day {
                    aspect-ratio: 1;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--cream-text-main);
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 32px;
                }

                .calendar-day.empty {
                    cursor: default;
                }

                .calendar-day:not(.empty):not(.disabled):hover {
                    background: #F1F5F9;
                    transform: scale(1.05);
                }

                .calendar-day.today {
                    background: #FFF7ED;
                    color: #D97706;
                    font-weight: 700;
                }

                .calendar-day.selected {
                    background: #5C67F2;
                    color: white;
                    font-weight: 700;
                }

                .calendar-day.selected:hover {
                    background: #4F46E5;
                }

                .calendar-day.disabled {
                    color: #CBD5E1;
                    cursor: not-allowed;
                    opacity: 0.4;
                }

                .calendar-day.disabled:hover {
                    background: transparent;
                    transform: none;
                }
            `}</style>
        </div>
    )
}

export default DatePicker
