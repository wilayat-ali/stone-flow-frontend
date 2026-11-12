import { ApiError } from '@/lib/client-api'
import { assertMonthOpen } from './month-store'
import { allWorkers, type Worker } from './workers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const attendanceQueryKey = 'attendance'

const today = () => new Date().toISOString().slice(0, 10)

/** One saved day. Everyone is present unless listed as absent; there are no half-days. */
type Day = { date: string; absentIds: string[]; savedBy: string }

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let days: Day[] = [
    { date: '2026-11-10', absentIds: ['w-salman'], savedBy: 'Munshi' },
    { date: '2026-11-11', absentIds: [], savedBy: 'Munshi' },
]

export type AttendanceRow = { worker: Worker; present: boolean }

export type AttendanceSheet = { date: string; saved: boolean; rows: AttendanceRow[] }

/** Daily and monthly workers, who were already working on that day. */
const onRoll = (date: string) => allWorkers().filter((w) => w.isActive && (w.payType === 'day' || w.payType === 'month') && w.joinedOn <= date)

export const getAttendance = async (date: string): Promise<AttendanceSheet> => {
    await delay(250)
    const day = days.find((d) => d.date === date)
    return { date, saved: !!day, rows: onRoll(date).map((worker) => ({ worker, present: !day?.absentIds.includes(worker.id) })) }
}

/** Saving the day is what lets daily workers earn; saving it again replaces the earlier one. */
export const saveAttendance = async (date: string, absentIds: string[], by: string): Promise<void> => {
    await delay()
    if (date > today()) throw new ApiError(400, { code: 'FUTURE_DATE' })
    assertMonthOpen(date)
    const ids = absentIds.filter((id) => onRoll(date).some((w) => w.id === id))
    days = [...days.filter((d) => d.date !== date), { date, absentIds: ids, savedBy: by }]
}

/** The saved days a worker was present, oldest first. */
export const presentDays = (workerId: string): string[] => {
    const worker = allWorkers().find((w) => w.id === workerId)
    if (!worker) return []
    return days
        .filter((d) => d.date >= worker.joinedOn && !d.absentIds.includes(workerId))
        .map((d) => d.date)
        .sort()
}

/** Absent days of a worker in a month (`YYYY-MM`), for the month summary. */
export const absentDays = (workerId: string, month: string) => days.filter((d) => d.date.startsWith(month) && d.absentIds.includes(workerId)).length

/** Saved days in a month, for "x of y days saved". */
export const savedDaysIn = (month: string) => days.filter((d) => d.date.startsWith(month)).length
