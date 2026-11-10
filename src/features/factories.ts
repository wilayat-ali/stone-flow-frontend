const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

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

const baseFactories: Factory[] = [
    {
        id: 'main',
        name: 'Saadat Marble — Main Factory',
        kind: 'own',
        ratePerTon: null,
        isActive: true,
    },
    {
        id: 'north-yard',
        name: 'North Yard',
        kind: 'own',
        ratePerTon: null,
        isActive: true,
    },
    {
        id: 'khan-cutting',
        name: 'Khan Cutting Works',
        kind: 'cutting',
        ratePerTon: 350,
        isActive: true,
    },
]

/** Temporary: pads the mock list so scrolling and pagination can be checked. Set to `false` to remove. */
const LOAD_TEST = true

const extraCuttingFactories = [
    'Rashid Cutting House', 'City Marble Cutting', 'Al-Noor Cutting Works', 'Chenab Stone Cutting',
    'Zamzam Cutting Factory', 'Punjab Cutting Mills', 'Shahbaz Cutting Co.', 'Baba Cutting Works',
    'Elite Stone Cutters', 'Gulshan Cutting Factory', 'Margalla Cutting Works', 'Hamza Cutting Mills',
    'Sialkot Cutting House', 'Diamond Stone Cutters', 'Crescent Cutting Factory', 'Haji Cutting Works',
    'Falcon Stone Cutters', 'Jinnah Cutting Mills', 'Ravi Cutting Factory', 'Shan Cutting Works',
    'National Cutting House', 'Al-Hamd Cutting Co.', 'Ittehad Cutting Mills', 'Zafar Cutting Works',
    'Khyber Cutting Factory', 'Model Cutting House', 'Pearl Stone Cutters', 'Faisal Cutting Works',
]

const extraOwnFactories = ['East Yard', 'Riverside Factory', 'Hill Road Factory']

const factoriesSeed: Factory[] = LOAD_TEST
    ? [
          ...baseFactories,
          ...extraOwnFactories.map(
              (name, i): Factory => ({
                  id: `own-${i}`,
                  name,
                  kind: 'own',
                  ratePerTon: null,
                  isActive: true,
              })
          ),
          ...extraCuttingFactories.map(
              (name, i): Factory => ({
                  id: `cutting-${i}`,
                  name,
                  kind: 'cutting',
                  ratePerTon: 280 + ((i * 15) % 220),
                  isActive: true,
              })
          ),
      ]
    : baseFactories

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let factories: Factory[] = [...factoriesSeed]

/** Nothing is ever hard-deleted, so a deactivated factory is simply left out of the list. */
export const listFactories = async (): Promise<Factory[]> => {
    await delay()
    return factories.filter((f) => f.isActive)
}

/** The create/edit sheet's own form values: `ratePerTon` arrives as a string. */
export type FactoryInput = { name: string; kind: FactoryKind; ratePerTon: string }

const toFactory = (input: FactoryInput) => ({
    name: input.name,
    kind: input.kind,
    ratePerTon: input.ratePerTon.trim() ? Number(input.ratePerTon) : null,
})

export const createFactory = async (input: FactoryInput): Promise<Factory> => {
    await delay()
    const factory: Factory = { ...toFactory(input), id: crypto.randomUUID(), isActive: true }
    factories = [...factories, factory]
    return factory
}

export const updateFactory = async (id: string, input: FactoryInput): Promise<Factory> => {
    await delay()
    factories = factories.map((f) => (f.id === id ? { ...f, ...toFactory(input) } : f))
    return factories.find((f) => f.id === id) as Factory
}

/** Factories are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateFactory = async (id: string): Promise<void> => {
    await delay()
    factories = factories.map((f) => (f.id === id ? { ...f, isActive: false } : f))
}
