# Date and Time Picker Components

This project includes custom-built, premium date and time picker components designed for the Vaidya AI Study Planner.

## Components

### 1. DatePicker Component (`components/DatePicker.tsx`)

A fully-featured date picker with calendar dropdown interface.

#### Features:
- **Calendar View**: Visual month calendar with day selection
- **Month Navigation**: Previous/Next month navigation buttons  
- **Date Constraints**: Support for `minDate` and `maxDate` props
- **Visual Indicators**:
  - Today's date highlighted in orange
  - Selected date highlighted in purple
  - Disabled dates shown with reduced opacity
- **Smart UX**:
  - Click outside to close
  - Accessible keyboard navigation
  - Smooth animations
  - Responsive design

#### Props:
```typescript
interface DatePickerProps {
    value: string          // ISO date string (YYYY-MM-DD)
    onChange: (date: string) => void
    label?: string         // Optional label text
    required?: boolean     // Show required asterisk
    minDate?: string       // Minimum selectable date (YYYY-MM-DD)
    maxDate?: string       // Maximum selectable date (YYYY-MM-DD)
}
```

#### Usage Example:
```tsx
<DatePicker
    value={formData.scheduled_date}
    onChange={(date) => setFormData({ ...formData, scheduled_date: date })}
    label="Date"
    required
    minDate={new Date().toISOString().split('T')[0]} // Today or later
/>
```

---

### 2. TimePicker Component (`components/TimePicker.tsx`)

A comprehensive time picker with quick select options and custom time scrollers.

#### Features:
- **Quick Time Selection**: Preset times (Morning 9AM, Noon, Afternoon 2PM, Evening 6PM)
- **Custom Time Selection**: 
  - Hour scroller (0-23, 24-hour format)
  - Minute scroller (0-55, 5-minute intervals)
- **Time Constraints**: Support for `minTime` and `maxTime` props
- **Smart Logic**: End time picker can validate against start time
- **Display Format**: Shows 12-hour format with AM/PM
- **Current Selection**: Shows selected time at bottom of dropdown

#### Props:
```typescript
interface TimePickerProps {
    value: string          // HH:MM format (24-hour)
    onChange: (time: string) => void
    label?: string         // Optional label text
    required?: boolean     // Show required asterisk
    minTime?: string       // Minimum selectable time (HH:MM)
    maxTime?: string       // Maximum selectable time (HH:MM)
}
```

#### Usage Example:
```tsx
{/* Start Time */}
<TimePicker
    value={formData.start_time}
    onChange={(time) => setFormData({ ...formData, start_time: time })}
    label="Start Time"
    required
/>

{/* End Time - constrained by start time */}
<TimePicker
    value={formData.end_time}
    onChange={(time) => setFormData({ ...formData, end_time: time })}
    label="End Time"
    required
    minTime={formData.start_time} // Can't select time before start time
/>
```

---

## Integration in Study Planner

The components have been integrated into the "New Study Session" modal in `pages/study-planner.tsx`:

```tsx
{/* Date Field */}
<DatePicker
    value={formData.scheduled_date}
    onChange={(date) => setFormData({ ...formData, scheduled_date: date })}
    label="Date"
    required
    minDate={new Date().toISOString().split('T')[0]}
/>

{/* Time Fields */}
<div className="form-row">
    <TimePicker
        value={formData.start_time}
        onChange={(time) => setFormData({ ...formData, start_time: time })}
        label="Start Time"
        required
    />
    <TimePicker
        value={formData.end_time}
        onChange={(time) => setFormData({ ...formData, end_time: time })}
        label="End Time"
        required
        minTime={formData.start_time}
    />
</div>
```

---

## Key Logic Features

### DatePicker Logic:
1. **Date Validation**: Automatically disables dates outside min/max range
2. **Month Management**: Handles month/year transitions correctly
3. **Visual State**: Different styles for today, selected, and disabled dates
4. **Outside Click**: Closes dropdown when clicking outside component

### TimePicker Logic:
1. **Time Validation**: Disables invalid times based on constraints
2. **Quick Select**: Provides quick access to common times
3. **Custom Selection**: Fine-grained control with hour/minute scrollers
4. **Format Conversion**: Stores in 24-hour, displays in 12-hour format
5. **Smart Constraints**: End time respects start time automatically

---

## Styling

Both components use:
- **Scoped Styling**: JSX-in-CSS with `styled-jsx`
- **CSS Variables**: Consistent with app theme (`--cream-text-main`, etc.)
- **Smooth Animations**: Dropdown slide-down, hover effects
- **Premium Design**: Modern, clean UI with proper shadows and borders
- **Accessibility**: Proper ARIA labels and keyboard support

---

## Benefits Over Native Inputs

1. **Better UX**: Visual calendar and time selection vs browser defaults
2. **Consistent Design**: Same look across all browsers and OS
3. **More Control**: Built-in validation and constraints
4. **Premium Feel**: Modern, animated, professional appearance
5. **Mobile Friendly**: Touch-optimized (better than native pickers)
6. **Customizable**: Easy to modify colors, sizes, behavior

---

## Future Enhancements

Possible additions:
- Date range picker (select start and end date together)
- Time zone support
- Recurrence/repeat options
- Keyboard shortcuts (arrow keys for date navigation)
- Custom theming props
- Animation preferences
