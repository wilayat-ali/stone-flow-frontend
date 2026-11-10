const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export type SootSize = {
    id: string
    name: string
    isActive: boolean
}

export const sootSizesQueryKey = 'soot-sizes'

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let sizes: SootSize[] = ['14 soot', '6 soot', '4 soot'].map((name) => ({
    id: crypto.randomUUID(),
    name,
    isActive: true,
}))

/** Nothing is ever hard-deleted, so a deactivated size is simply left out of the list. */
export const listSootSizes = async (): Promise<SootSize[]> => {
    await delay()
    return sizes.filter((s) => s.isActive)
}

export type SootSizeInput = { name: string }

export const createSootSize = async (input: SootSizeInput): Promise<SootSize> => {
    await delay()
    const size: SootSize = { ...input, id: crypto.randomUUID(), isActive: true }
    sizes = [...sizes, size]
    return size
}

export const updateSootSize = async (id: string, input: SootSizeInput): Promise<SootSize> => {
    await delay()
    sizes = sizes.map((s) => (s.id === id ? { ...s, ...input } : s))
    return sizes.find((s) => s.id === id) as SootSize
}

/** Sizes are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateSootSize = async (id: string): Promise<void> => {
    await delay()
    sizes = sizes.map((s) => (s.id === id ? { ...s, isActive: false } : s))
}
