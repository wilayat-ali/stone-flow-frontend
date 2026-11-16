import { request } from '@/lib/client-api'

export type SootSize = {
    id: string
    name: string
    isActive: boolean
}

export const sootSizesQueryKey = 'soot-sizes'

const base = '/api/settings/soot-sizes'

/** Nothing is ever hard-deleted, so a deactivated size is simply left out of the list. */
export const listSootSizes = () => request<SootSize[]>(base)

export type SootSizeInput = { name: string }

export const createSootSize = (input: SootSizeInput) => request<SootSize>(base, { body: input })

export const updateSootSize = (id: string, input: SootSizeInput) =>
    request<SootSize>(`${base}/${id}`, { method: 'PATCH', body: input })

/** Sizes are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateSootSize = async (id: string): Promise<void> => {
    await request<SootSize>(`${base}/${id}`, { method: 'PATCH', body: { isActive: false } })
}
