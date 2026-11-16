import { request } from '@/lib/client-api'

export type FactoryKind = 'own' | 'cutting'

export type Factory = {
    id: string
    name: string
    kind: FactoryKind
    /** PKR charged per ton of cutting; only meaningful for cutting factories. */
    ratePerTon: number | null
    isActive: boolean
}

export const factoriesQueryKey = 'factories'

const base = '/api/settings/factories'

/** Nothing is ever hard-deleted, so a deactivated factory is simply left out of the list. */
export const listFactories = () => request<Factory[]>(base)

/** The create/edit sheet's own form values: `ratePerTon` arrives as a string. */
export type FactoryInput = { name: string; kind: FactoryKind; ratePerTon: string }

const toBody = (input: FactoryInput) => ({
    name: input.name,
    kind: input.kind,
    ratePerTon: input.kind === 'cutting' && input.ratePerTon.trim() ? Number(input.ratePerTon) : null,
})

export const createFactory = (input: FactoryInput) => request<Factory>(base, { body: toBody(input) })

export const updateFactory = (id: string, input: FactoryInput) =>
    request<Factory>(`${base}/${id}`, { method: 'PATCH', body: toBody(input) })

/** Factories are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateFactory = async (id: string): Promise<void> => {
    await request<Factory>(`${base}/${id}`, { method: 'PATCH', body: { isActive: false } })
}
