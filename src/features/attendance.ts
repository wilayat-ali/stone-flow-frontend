import { request } from '@/lib/client-api'
import type { Worker } from './workers'

export const attendanceQueryKey = 'attendance'

const base = '/api/workers/attendance'

/** One saved day's roll: everyone is present unless listed as absent; there are no half-days. */
export type AttendanceRow = { worker: Worker; present: boolean }

export type AttendanceSheet = { date: string; saved: boolean; rows: AttendanceRow[] }

/** The day's roll: daily and monthly workers who had joined by then. */
export const getAttendance = (date: string) => request<AttendanceSheet>(`${base}?date=${date}`)

/** Saving the day is what lets daily workers earn; saving it again replaces the earlier one. */
export const saveAttendance = (date: string, absentIds: string[]) =>
    request<AttendanceSheet>(base, { method: 'PUT', body: { date, absentIds } })

type MonthSummary = { savedDays: number; absent: Record<string, number> }

const months: Record<string, MonthSummary> = {}

/** The saved days and the absences of a month (`YYYY-MM`); read by the month summary once loaded. */
export const loadAttendanceSummary = async (month: string): Promise<MonthSummary> => {
    const summary = await request<MonthSummary>(`${base}/summary?month=${month}`)
    months[month] = summary
    return summary
}

/** Absent days of a worker in a month, from the last summary loaded for it. */
export const absentDays = (workerId: string, month: string) => months[month]?.absent[workerId] ?? 0

/** Saved days in a month, from the last summary loaded for it. */
export const savedDaysIn = (month: string) => months[month]?.savedDays ?? 0
