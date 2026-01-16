import React, { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface TimePickerProps {
    value: string // HH:MM format (24-hour)
    onChange: (time: string) => void
    label?: string
    required?: boolean
    minTime?: string
    maxTime?: string
}

const TimePicker: React.FC<TimePickerProps> = ({
    value,
    onChange,
    label,
    required = false,
    minTime,
    maxTime
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const pickerRef = useRef<HTMLDivElement>(null)

    // Parse hours and minutes from value
    const [hours24, minutes] = value ? value.split(':').map(Number) : [9, 0]

    // Derived 12-hour values
    const period = hours24 >= 12 ? 'PM' : 'AM'
    const hours12 = hours24 % 12 || 12

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

    const formatDisplayTime = (timeStr: string) => {
        if (!timeStr) return ''
        const [h, m] = timeStr.split(':').map(Number)
        const period = h >= 12 ? 'PM' : 'AM'
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
        return `${displayHour}:${String(m).padStart(2, '0')} ${period}`
    }

    const isTimeDisabled = (h24: number, m: number) => {
        const timeValue = h24 * 60 + m

        if (minTime) {
            const [minH, minM] = minTime.split(':').map(Number)
            const minValue = minH * 60 + minM
            if (timeValue < minValue) return true
        }

        if (maxTime) {
            const [maxH, maxM] = maxTime.split(':').map(Number)
            const maxValue = maxH * 60 + maxM
            if (timeValue > maxValue) return true
        }

        return false
    }

    const updateTime = (newH24: number, newM: number) => {
        if (isTimeDisabled(newH24, newM)) return
        const formattedTime = `${String(newH24).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
        onChange(formattedTime)
    }

    const handleHourSelect = (h12: number) => {
        let newH24 = h12
        if (period === 'PM' && h12 !== 12) newH24 += 12
        if (period === 'AM' && h12 === 12) newH24 = 0

        updateTime(newH24, minutes)
    }

    const handleMinuteSelect = (m: number) => {
        updateTime(hours24, m)
    }

    const handlePeriodSelect = (newPeriod: 'AM' | 'PM') => {
        if (newPeriod === period) return

        let newH24 = hours24
        if (newPeriod === 'PM' && hours24 < 12) newH24 += 12
        if (newPeriod === 'AM' && hours24 >= 12) newH24 -= 12

        updateTime(newH24, minutes)
    }

    const handleNowClick = () => {
        const now = new Date()
        const h = now.getHours()
        const m = Math.floor(now.getMinutes() / 5) * 5 // Round to nearest 5 min
        updateTime(h, m)
        setIsOpen(false)
    }

    // Generate 12 hours (1-12) and minutes (0-59, step 5)
    const hoursArray = Array.from({ length: 12 }, (_, i) => i + 1)
    const minutesArray = Array.from({ length: 12 }, (_, i) => i * 5)

    return (
        <div className="time-picker-wrapper" ref={pickerRef}>
            {label && (
                <label className="time-picker-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}

            <div
                className={`time-picker-input ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="time-value">
                    {value ? formatDisplayTime(value) : 'Select time'}
                </span>
                <div className="time-icon">
                    <Clock size={16} />
                </div>
            </div>

            {isOpen && (
                <div className="time-picker-dropdown">
                    <button className="now-btn" onClick={handleNowClick}>
                        Now
                    </button>

                    <div className="time-selectors">
                        {/* Hour Column */}
                        <div className="time-column">
                            <div className="column-header">Hour</div>
                            <div className="time-scroll">
                                {hoursArray.map(hour => {
                                    // Calculate 24h equivalent to check disabled state
                                    let testH24 = hour
                                    if (period === 'PM' && hour !== 12) testH24 += 12
                                    if (period === 'AM' && hour === 12) testH24 = 0

                                    const disabled = minutesArray.every(m => isTimeDisabled(testH24, m))
                                    const isSelected = hour === hours12

                                    return (
                                        <button
                                            key={hour}
                                            type="button"
                                            className={`time-option ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                                            onClick={() => !disabled && handleHourSelect(hour)}
                                            disabled={disabled}
                                        >
                                            {String(hour).padStart(2, '0')}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="time-separator">:</div>

                        {/* Minute Column */}
                        <div className="time-column">
                            <div className="column-header">Min</div>
                            <div className="time-scroll">
                                {minutesArray.map(minute => {
                                    const disabled = isTimeDisabled(hours24, minute)
                                    const isSelected = minute === minutes

                                    return (
                                        <button
                                            key={minute}
                                            type="button"
                                            className={`time-option ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                                            onClick={() => !disabled && handleMinuteSelect(minute)}
                                            disabled={disabled}
                                        >
                                            {String(minute).padStart(2, '0')}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* AM/PM Column */}
                        <div className="time-column">
                            <div className="column-header">Format</div>
                            <div className="period-list">
                                {['AM', 'PM'].map((p) => {
                                    const isSelected = p === period
                                    // Check if all times in this period would be disabled
                                    // Simplified check: check if at least one hour in this period is valid
                                    const isDisabled = false // Logic could be more complex, but keeping simple for now

                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            className={`time-option ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handlePeriodSelect(p as 'AM' | 'PM')}
                                        >
                                            {p}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .time-picker-wrapper {
                    position: relative;
                    width: 100%;
                }

                .time-picker-label {
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

                .time-picker-input {
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

                .time-picker-input:hover {
                    border-color: #CBD5E1;
                    background-color: #E2E8F0;
                }

                .time-picker-input.open,
                .time-picker-input:focus {
                    outline: none;
                    border-color: #5C67F2;
                    background-color: white;
                    box-shadow: 0 0 0 3px rgba(92, 103, 242, 0.1);
                }

                .time-value {
                    flex: 1;
                    color: var(--cream-text-main);
                }

                .time-icon {
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

                .time-picker-input:hover .time-icon {
                    color: #5C67F2;
                    transform: translateY(-50%) scale(1.1);
                }

                .time-picker-dropdown {
                    position: absolute;
                    top: calc(100% + 6px);
                    left: 0;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
                    border: 1px solid rgba(0, 0, 0, 0.06);
                    padding: 12px;
                    z-index: 1000;
                    min-width: 200px;
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

                .now-btn {
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

                .now-btn:hover {
                    background: #EDEEFF;
                    transform: translateY(-1px);
                }

                .time-selectors {
                    display: flex;
                    gap: 8px;
                    align-items: flex-start;
                }

                .time-column {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-width: 44px;
                }

                .column-header {
                    text-align: center;
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--cream-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 6px;
                }

                .time-scroll, .period-list {
                    max-height: 140px;
                    overflow-y: auto;
                    border-radius: 8px;
                    background: #F8FAFC;
                    padding: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    scrollbar-width: thin;
                    scrollbar-color: #CBD5E1 transparent;
                }
                
                .period-list {
                    height: 100%;
                    justify-content: center;
                }

                .time-scroll::-webkit-scrollbar {
                    width: 4px;
                }

                .time-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }

                .time-scroll::-webkit-scrollbar-thumb {
                    background: #CBD5E1;
                    border-radius: 2px;
                }
                
                .time-option {
                    padding: 6px;
                    border: none;
                    background: white;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--cream-text-main);
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }

                .time-option:hover:not(.disabled) {
                    background: #E2E8F0;
                }

                .time-option.selected {
                    background: #5C67F2;
                    color: white;
                    font-weight: 700;
                }

                .time-option.disabled {
                    color: #CBD5E1;
                    cursor: not-allowed;
                    opacity: 0.4;
                }

                .time-separator {
                    font-size: 20px;
                    font-weight: 700;
                    color: var(--cream-text-main);
                    padding-top: 24px;
                }
            `}</style>
        </div>
    )
}

export default TimePicker
