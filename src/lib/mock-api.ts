type Entity = { id: string }

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * In-memory stand-in for a REST resource. Same shape as `ResourceApi`,
 * so swapping in real fetch calls does not touch any UI code.
 */
export function createMockApi<T extends Entity>(seed: T[]) {
    let rows = [...seed]

    return {
        list: async (): Promise<T[]> => {
            await delay()
            return rows
        },
        create: async (values: Omit<T, 'id'>): Promise<T> => {
            await delay()
            const row = { ...values, id: crypto.randomUUID() } as T
            rows = [row, ...rows]
            return row
        },
        update: async (id: string, values: Partial<Omit<T, 'id'>>) => {
            await delay()
            rows = rows.map((row) =>
                row.id === id ? { ...row, ...values } : row
            )
            return rows.find((row) => row.id === id) as T
        },
        remove: async (id: string): Promise<void> => {
            await delay()
            rows = rows.filter((row) => row.id !== id)
        },
    }
}
