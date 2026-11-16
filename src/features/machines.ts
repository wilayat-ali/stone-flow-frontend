import { request } from '@/lib/client-api'

/** Vertical → 14 soot pieces, gang saw → slabs (both drive Production's output logic). */
export type MachineType = 'vertical' | 'gangSaw' | 'monolama' | 'blockCutter'

export type Machine = {
    id: string
    name: string
    type: MachineType
    /** An own factory — machines never belong to another cutting factory. */
    factoryId: string
    dayThekadar: string
    /** Most factories run one shift; night is optional. */
    nightThekadar: string | null
    isActive: boolean
}

export const machinesQueryKey = 'machines'

const base = '/api/settings/machines'

/** Nothing is ever hard-deleted, so a deactivated machine is simply left out of the list. */
export const listMachines = () => request<Machine[]>(base)

/** The create/edit sheet's own form values: `nightThekadar` arrives as a (possibly empty) string. */
export type MachineInput = {
    name: string
    type: MachineType
    factoryId: string
    dayThekadar: string
    nightThekadar: string
}

const toBody = (input: MachineInput) => ({
    name: input.name,
    type: input.type,
    factoryId: input.factoryId,
    dayThekadar: input.dayThekadar,
    nightThekadar: input.nightThekadar.trim() ? input.nightThekadar : null,
})

export const createMachine = (input: MachineInput) => request<Machine>(base, { body: toBody(input) })

export const updateMachine = (id: string, input: MachineInput) =>
    request<Machine>(`${base}/${id}`, { method: 'PATCH', body: toBody(input) })

/** Machines are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateMachine = async (id: string): Promise<void> => {
    await request<Machine>(`${base}/${id}`, { method: 'PATCH', body: { isActive: false } })
}
