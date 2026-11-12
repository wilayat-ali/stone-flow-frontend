/** What a worker earned, added to their khata. Owned by Workers (08b); 05a creates the per-ton ones. */
export type WorkEntry = {
    id: string
    date: string
    workerId: string
    workerName: string
    job: string
    unit: 'ton' | 'sqft' | 'day'
    qty: number
    rate: number
    amount: number
    sourceType: 'truck_cut' | 'production' | 'register'
    sourceId: string
    /** Made by the system from another step, not typed in. */
    auto: boolean
    createdBy: string
    /** A reversed step keeps its row, marked, so the worker's khata can show it was taken back. */
    reversed?: boolean
}

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
const entries: WorkEntry[] = []

/**
 * Adds a work entry for a step, exactly once: posting the same source again returns the one already
 * there, so a repeated request cannot pay the worker twice.
 */
export const postWorkEntry = (entry: Omit<WorkEntry, 'id'>): WorkEntry => {
    const existing = entries.find((e) => e.sourceType === entry.sourceType && e.sourceId === entry.sourceId)
    if (existing) return existing
    const created = { ...entry, id: crypto.randomUUID() }
    entries.push(created)
    return created
}

export const workEntriesFor = (sourceType: WorkEntry['sourceType'], sourceId: string) =>
    entries.filter((e) => e.sourceType === sourceType && e.sourceId === sourceId && !e.reversed)

/** A production entry was reversed: its work entries are taken back (kept, marked), never deleted. */
export const reverseWorkEntries = (sourceType: WorkEntry['sourceType'], sourceId: string) => {
    for (const e of entries) if (e.sourceType === sourceType && e.sourceId === sourceId) e.reversed = true
}

export const allWorkEntries = () => entries.filter((e) => !e.reversed)

/**
 * The Work Register's one entry per worker per day: set it to the feet typed, or take it back when the
 * feet are cleared. The earlier row is kept, marked, never deleted.
 */
export const setRegisterEntry = (entry: Omit<WorkEntry, 'id' | 'sourceType' | 'sourceId' | 'auto'>) => {
    const sourceId = `${entry.date}:${entry.workerId}`
    for (const e of entries) if (e.sourceType === 'register' && e.sourceId === sourceId) e.reversed = true
    if (entry.qty > 0) entries.push({ ...entry, id: crypto.randomUUID(), sourceType: 'register', sourceId, auto: false })
}
