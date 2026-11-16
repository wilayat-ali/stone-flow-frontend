import { request } from '@/lib/client-api'

export type CounterWidth = {
    id: string
    name: string
    isActive: boolean
}

export const counterWidthsQueryKey = 'counter-widths'

const base = '/api/settings/counter-widths'

/** Nothing is ever hard-deleted, so a deactivated width is simply left out of the list. */
export const listCounterWidths = () => request<CounterWidth[]>(base)

export type CounterWidthInput = { name: string }

export const createCounterWidth = (input: CounterWidthInput) => request<CounterWidth>(base, { body: input })

export const updateCounterWidth = (id: string, input: CounterWidthInput) =>
    request<CounterWidth>(`${base}/${id}`, { method: 'PATCH', body: input })

/** Widths are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateCounterWidth = async (id: string): Promise<void> => {
    await request<CounterWidth>(`${base}/${id}`, { method: 'PATCH', body: { isActive: false } })
}
