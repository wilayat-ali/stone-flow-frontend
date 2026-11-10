const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

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

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let machines: Machine[] = [
    {
        id: 'vertical-1',
        name: 'Vertical Cutter 1',
        type: 'vertical',
        factoryId: 'main',
        dayThekadar: 'Rashid Khan',
        nightThekadar: null,
        isActive: true,
    },
    {
        id: 'vertical-2',
        name: 'Vertical Cutter 2',
        type: 'vertical',
        factoryId: 'main',
        dayThekadar: 'Aslam Baig',
        nightThekadar: 'Bilal Ahmed',
        isActive: true,
    },
    {
        id: 'gangsaw-1',
        name: 'Gang Saw 1',
        type: 'gangSaw',
        factoryId: 'main',
        dayThekadar: 'Shahid Pervez',
        nightThekadar: null,
        isActive: true,
    },
    {
        id: 'gangsaw-2',
        name: 'Gang Saw 2',
        type: 'gangSaw',
        factoryId: 'north-yard',
        dayThekadar: 'Imran Ali',
        nightThekadar: null,
        isActive: true,
    },
    {
        id: 'monolama-1',
        name: 'Monolama 1',
        type: 'monolama',
        factoryId: 'north-yard',
        dayThekadar: 'Tariq Mehmood',
        nightThekadar: null,
        isActive: true,
    },
]

/** Nothing is ever hard-deleted, so a deactivated machine is simply left out of the list. */
export const listMachines = async (): Promise<Machine[]> => {
    await delay()
    return machines.filter((m) => m.isActive)
}

/** The create/edit sheet's own form values: `nightThekadar` arrives as a (possibly empty) string. */
export type MachineInput = {
    name: string
    type: MachineType
    factoryId: string
    dayThekadar: string
    nightThekadar: string
}

const toMachine = (input: MachineInput) => ({
    name: input.name,
    type: input.type,
    factoryId: input.factoryId,
    dayThekadar: input.dayThekadar,
    nightThekadar: input.nightThekadar.trim() ? input.nightThekadar : null,
})

export const createMachine = async (input: MachineInput): Promise<Machine> => {
    await delay()
    const machine: Machine = { ...toMachine(input), id: crypto.randomUUID(), isActive: true }
    machines = [...machines, machine]
    return machine
}

export const updateMachine = async (id: string, input: MachineInput): Promise<Machine> => {
    await delay()
    machines = machines.map((m) => (m.id === id ? { ...m, ...toMachine(input) } : m))
    return machines.find((m) => m.id === id) as Machine
}

/** Machines are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateMachine = async (id: string): Promise<void> => {
    await delay()
    machines = machines.map((m) => (m.id === id ? { ...m, isActive: false } : m))
}
