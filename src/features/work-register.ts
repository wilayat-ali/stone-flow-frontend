import { request } from '@/lib/client-api'

export const workRegisterQueryKey = 'work-register'

const base = '/api/workers/register'

export type RegisterRow = {
    workerId: string
    workerName: string
    job: string
    rate: number
    /** Feet typed in the register for the day. */
    feet: number
    /** Feet that production entries already gave him that day; shown locked. */
    autoFeet: number
    autoAmount: number
}

export type RegisterSheet = { date: string; rows: RegisterRow[] }

/** The sq.ft workers' grid for a day: what was typed, and what production already credited. */
export const getWorkRegister = (date: string) => request<RegisterSheet>(`${base}?date=${date}`)

/** Save the grid: one entry per worker for the day (feet cleared to 0 takes his entry back). */
export const saveWorkRegister = (date: string, rows: { workerId: string; feet: number }[]) =>
    request<RegisterSheet>(base, { method: 'PUT', body: { date, rows } })
