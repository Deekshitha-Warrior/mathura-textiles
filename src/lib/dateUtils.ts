import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  format,
  isValid,
} from 'date-fns'

/**
 * Universal Safari/WebKit safe date parser.
 * Handles Postgres timestamps with space separator (e.g., "2026-10-02 18:30:00+00" or ".123456+00"),
 * missing minutes in timezone offsets (+00), microsecond precision, ISO strings, and Date objects.
 */
export function safeParseDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return isValid(value) ? value : null
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return isValid(d) ? d : null
  }

  let str = String(value).trim()
  if (!str) return null

  // If already pure YYYY-MM-DD, parse as local calendar date (midnight)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    const localDate = new Date(y, m - 1, d)
    return isValid(localDate) ? localDate : null
  }

  // Normalize Postgres / SQL format with space separator to ISO 'T'
  // e.g. "2026-10-02 18:30:00.123456+00" -> "2026-10-02T18:30:00.123456+00"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T')
  }

  // Normalize microseconds to 3-digit milliseconds for Safari (.123456 -> .123)
  str = str.replace(/\.(\d{3})\d+([Z+-]|$)/, '.$1$2')

  // Normalize 2-digit timezone offset (+00 / -05) to (+00:00 / -05:00) for Safari
  if (/[T:].*[+-]\d{2}$/.test(str)) {
    str = str + ':00'
  }

  // Try standard parse with normalized string
  const parsed = new Date(str)
  if (isValid(parsed)) return parsed

  // If still invalid on older Safari WebKit, strip timezone and parse local time
  const cleanStr = str.replace(/[Z+-].*$/, '')
  const fallback = new Date(cleanStr)
  if (isValid(fallback)) return fallback

  // Last resort: extract YYYY-MM-DD and construct local Date
  const dateMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (dateMatch) {
    const [, y, m, d] = dateMatch
    const lastResort = new Date(Number(y), Number(m) - 1, Number(d))
    if (isValid(lastResort)) return lastResort
  }

  return null
}

/**
 * Convert any Date or date string to local YYYY-MM-DD string key.
 * Guaranteed to succeed on iOS Safari / WebKit without returning empty string on valid records.
 */
export function toLocalDateKey(value: string | number | Date | null | undefined): string {
  if (!value) return ''
  const parsed = safeParseDate(value)
  if (!parsed) {
    if (typeof value === 'string') {
      const match = value.match(/(\d{4})-(\d{2})-(\d{2})/)
      if (match) return `${match[1]}-${match[2]}-${match[3]}`
    }
    return ''
  }
  return format(parsed, 'yyyy-MM-dd')
}

export type DatePresetKey = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

/**
 * Returns exact start and end date strings (YYYY-MM-DD) for presets.
 * - 'today': today to today
 * - 'week': Monday of current week to Sunday of current week (weekStartsOn: 1)
 * - 'month': 1st day of current month to last day of current month
 * - 'year': Jan 1 to Dec 31 of current year
 * - 'all' / 'custom': empty strings
 */
export function getPresetDateRange(
  preset: DatePresetKey,
  refDate: Date = new Date()
): { from: string; to: string } {
  if (preset === 'all' || preset === 'custom') {
    return { from: '', to: '' }
  }

  if (preset === 'today') {
    const todayStr = format(refDate, 'yyyy-MM-dd')
    return { from: todayStr, to: todayStr }
  }

  if (preset === 'week') {
    const monday = startOfWeek(refDate, { weekStartsOn: 1 })
    const sunday = endOfWeek(refDate, { weekStartsOn: 1 })
    return {
      from: format(monday, 'yyyy-MM-dd'),
      to: format(sunday, 'yyyy-MM-dd'),
    }
  }

  if (preset === 'month') {
    const first = startOfMonth(refDate)
    const last = endOfMonth(refDate)
    return {
      from: format(first, 'yyyy-MM-dd'),
      to: format(last, 'yyyy-MM-dd'),
    }
  }

  if (preset === 'year') {
    const first = startOfYear(refDate)
    const last = endOfYear(refDate)
    return {
      from: format(first, 'yyyy-MM-dd'),
      to: format(last, 'yyyy-MM-dd'),
    }
  }

  return { from: '', to: '' }
}

/**
 * Returns ISO strings for querying backend databases by timestamps.
 * - 'week' spans from Monday 00:00:00 to Sunday 23:59:59.999
 */
export function getPresetIsoRange(
  preset: 'today' | 'week' | 'month' | 'year' | 'all',
  refDate: Date = new Date()
): { start?: string; end?: string } {
  if (preset === 'all') return {}

  if (preset === 'today') {
    return {
      start: startOfDay(refDate).toISOString(),
      end: endOfDay(refDate).toISOString(),
    }
  }

  if (preset === 'week') {
    const monday = startOfWeek(refDate, { weekStartsOn: 1 })
    const sunday = endOfWeek(refDate, { weekStartsOn: 1 })
    return {
      start: startOfDay(monday).toISOString(),
      end: endOfDay(sunday).toISOString(),
    }
  }

  if (preset === 'month') {
    const first = startOfMonth(refDate)
    const last = endOfMonth(refDate)
    return {
      start: startOfDay(first).toISOString(),
      end: endOfDay(last).toISOString(),
    }
  }

  if (preset === 'year') {
    const first = startOfYear(refDate)
    const last = endOfYear(refDate)
    return {
      start: startOfDay(first).toISOString(),
      end: endOfDay(last).toISOString(),
    }
  }

  return {}
}

/**
 * Returns current date in local YYYY-MM-DD format
 */
export function getTodayLocalDateKey(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Check if a date string or Date falls within an inclusive [from, to] YYYY-MM-DD range
 */
export function isDateInRange(
  date: string | Date | null | undefined,
  from?: string,
  to?: string
): boolean {
  const key = toLocalDateKey(date)
  if (!key) return false
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}

/**
 * Checks if a date falls in today (local time)
 */
export function isDateToday(date: string | Date | null | undefined, refDate: Date = new Date()): boolean {
  const key = toLocalDateKey(date)
  return Boolean(key && key === format(refDate, 'yyyy-MM-dd'))
}

/**
 * Checks if a date falls in current calendar week (Monday to Sunday, local time)
 */
export function isDateThisWeek(date: string | Date | null | undefined, refDate: Date = new Date()): boolean {
  const { from, to } = getPresetDateRange('week', refDate)
  return isDateInRange(date, from, to)
}

/**
 * Checks if a date falls in current calendar month (local time)
 */
export function isDateThisMonth(date: string | Date | null | undefined, refDate: Date = new Date()): boolean {
  const { from, to } = getPresetDateRange('month', refDate)
  return isDateInRange(date, from, to)
}

/**
 * Checks if a date falls in current calendar year (local time)
 */
export function isDateThisYear(date: string | Date | null | undefined, refDate: Date = new Date()): boolean {
  const { from, to } = getPresetDateRange('year', refDate)
  return isDateInRange(date, from, to)
}

/**
 * Safely converts local YYYY-MM-DD date strings into start-of-day and end-of-day ISO strings
 * for querying Postgres timestamps without timezone or leap-second skew.
 */
export function localDateStrToIsoRange(
  fromStr?: string,
  toStr?: string
): { startIso?: string; endIso?: string } {
  let startIso: string | undefined
  let endIso: string | undefined
  if (fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr.trim())) {
    const [y, m, d] = fromStr.trim().split('-').map(Number)
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0)
    if (isValid(dt)) startIso = dt.toISOString()
  }
  if (toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr.trim())) {
    const [y, m, d] = toStr.trim().split('-').map(Number)
    const dt = new Date(y, m - 1, d, 23, 59, 59, 999)
    if (isValid(dt)) endIso = dt.toISOString()
  }
  return { startIso, endIso }
}
