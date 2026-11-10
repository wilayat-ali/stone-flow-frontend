const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export type CounterWidth = {
    id: string
    name: string
    isActive: boolean
}

export const counterWidthsQueryKey = 'counter-widths'

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let widths: CounterWidth[] = ['2 inch', '1.5 inch', '1.25 inch'].map((name) => ({
    id: crypto.randomUUID(),
    name,
    isActive: true,
}))

/** Nothing is ever hard-deleted, so a deactivated width is simply left out of the list. */
export const listCounterWidths = async (): Promise<CounterWidth[]> => {
    await delay()
    return widths.filter((w) => w.isActive)
}

export type CounterWidthInput = { name: string }

export const createCounterWidth = async (input: CounterWidthInput): Promise<CounterWidth> => {
    await delay()
    const width: CounterWidth = { ...input, id: crypto.randomUUID(), isActive: true }
    widths = [...widths, width]
    return width
}

export const updateCounterWidth = async (
    id: string,
    input: CounterWidthInput
): Promise<CounterWidth> => {
    await delay()
    widths = widths.map((w) => (w.id === id ? { ...w, ...input } : w))
    return widths.find((w) => w.id === id) as CounterWidth
}

/** Widths are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateCounterWidth = async (id: string): Promise<void> => {
    await delay()
    widths = widths.map((w) => (w.id === id ? { ...w, isActive: false } : w))
}
