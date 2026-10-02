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
 * Convert any Date or date string to local YYYY-MM-DD string key
 */
export function toLocalDateKey(value: string | Date | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) {
    if (!isValid(value)) return ''
    return format(value, 'yyyy-MM-dd')
  }

  const str = String(value).trim()
  if (!str) return ''
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  const d = new Date(str)
  if (!isValid(d)) return ''
  return format(d, 'yyyy-MM-dd')
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
