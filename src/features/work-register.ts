import { ApiError } from '@/lib/client-api'
import { assertMonthOpen } from './month-store'
import { allWorkEntries, setRegisterEntry } from './work-entries'
import { allWorkers, effectiveRate } from './workers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export const workRegisterQueryKey = 'work-register'

const today = () => new Date().toISOString().slice(0, 10)

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
export const getWorkRegister = async (date: string): Promise<RegisterSheet> => {
    await delay(250)
    const entries = allWorkEntries().filter((e) => e.date === date && e.unit === 'sqft')
    const rows = allWorkers()
        .filter((w) => w.isActive && w.payType === 'sqft')
        .map((w): RegisterRow => {
            const own = entries.filter((e) => e.workerId === w.id)
            const typed = own.filter((e) => e.sourceType === 'register')
            const auto = own.filter((e) => e.auto)
            return {
                workerId: w.id,
                workerName: w.name,
                job: w.defaultJob || w.jobTitle,
                rate: effectiveRate(w),
                feet: typed.reduce((s, e) => s + e.qty, 0),
                autoFeet: auto.reduce((s, e) => s + e.qty, 0),
                autoAmount: auto.reduce((s, e) => s + e.amount, 0),
            }
        })
    return { date, rows }
}

const post = (date: string, workerId: string, feet: number, by: string) => {
    const worker = allWorkers().find((w) => w.id === workerId)
    if (!worker) return
    const rate = effectiveRate(worker)
    setRegisterEntry({
        date,
        workerId,
        workerName: worker.name,
        job: worker.defaultJob || worker.jobTitle,
        unit: 'sqft',
        qty: feet,
        rate,
        amount: Math.round(feet * rate),
        createdBy: by,
    })
}

/** Save the grid: one entry per worker for the day (feet cleared to 0 takes his entry back). */
export const saveWorkRegister = async (date: string, rows: { workerId: string; feet: number }[], by: string): Promise<void> => {
    await delay()
    if (date > today()) throw new ApiError(400, { code: 'FUTURE_DATE' })
    assertMonthOpen(date)
    if (rows.some((r) => !(r.feet >= 0))) throw new ApiError(400, { code: 'INVALID_AMOUNT' })
    for (const row of rows) post(date, row.workerId, row.feet, by)
}

// Two days of typed feet so the register and the khata have something to show.
for (const [workerId, feet] of [['w-imran-s', 1200], ['w-shahid-r', 900], ['w-rafiq', 700]] as const) post('2026-11-10', workerId, feet, 'Munshi')
for (const [workerId, feet] of [['w-imran-s', 1500], ['w-rafiq', 800]] as const) post('2026-11-11', workerId, feet, 'Munshi')
