import { useEffect, useRef, useState } from 'react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parse(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return { y, m: m - 1, d }
}

function formatDisplay(dateStr) {
  const p = parse(dateStr)
  if (!p) return ''
  return `${MONTH_NAMES[p.m].slice(0, 3)} ${p.d}, ${p.y}`
}

// A small self-built calendar, since a native <input type="date"> pops up
// an OS-drawn picker that no CSS can reach inside of.
export default function DatePicker({ value, onChange, min, max, placeholder = 'select date' }) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const [viewY, setViewY] = useState(() => (parse(value) ?? { y: today.getFullYear() }).y)
  const [viewM, setViewM] = useState(() => (parse(value) ?? { m: today.getMonth() }).m)
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function openPicker() {
    const p = parse(value)
    setViewY(p ? p.y : today.getFullYear())
    setViewM(p ? p.m : today.getMonth())
    setOpen((o) => !o)
  }

  function prevMonth() {
    if (viewM === 0) {
      setViewM(11)
      setViewY((y) => y - 1)
    } else {
      setViewM((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewM === 11) {
      setViewM(0)
      setViewY((y) => y + 1)
    } else {
      setViewM((m) => m + 1)
    }
  }

  const startWeekday = new Date(viewY, viewM, 1).getDay()
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const cells = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  function isDisabled(d) {
    const str = toDateStr(viewY, viewM, d)
    if (min && str < min) return true
    if (max && str > max) return true
    return false
  }

  function pick(d) {
    if (isDisabled(d)) return
    onChange(toDateStr(viewY, viewM, d))
    setOpen(false)
  }

  return (
    <div className="datepicker" ref={ref}>
      <button type="button" className="field datepicker-input" onClick={openPicker}>
        {value ? formatDisplay(value) : <span className="datepicker-placeholder">{placeholder}</span>}
      </button>
      {open && (
        <div className="datepicker-pop">
          <div className="datepicker-head">
            <button type="button" className="datepicker-nav" onClick={prevMonth} aria-label="previous month">
              ‹
            </button>
            <span className="datepicker-title">
              {MONTH_NAMES[viewM]} {viewY}
            </span>
            <button type="button" className="datepicker-nav" onClick={nextMonth} aria-label="next month">
              ›
            </button>
          </div>
          <div className="datepicker-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="datepicker-grid">
            {cells.map((d, i) =>
              d === null ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  className={`datepicker-day${value === toDateStr(viewY, viewM, d) ? ' selected' : ''}`}
                  disabled={isDisabled(d)}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
