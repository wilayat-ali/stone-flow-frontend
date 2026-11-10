const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export type ExpenseCategory = {
    id: string
    name: string
    isActive: boolean
}

export const expenseCategoriesQueryKey = 'expense-categories'

// In-memory stand-in for the backend; replace with `request()` calls like `features/admin/members.ts`.
let categories: ExpenseCategory[] = [
    'Worker advances',
    'Salaries',
    'Spare parts',
    'Lunch / tea',
    'Guests',
    'Water tanker',
    'Drain powder',
    'Maintenance',
    'Electricity',
].map((name) => ({ id: crypto.randomUUID(), name, isActive: true }))

/** Nothing is ever hard-deleted, so a deactivated category is simply left out of the list. */
export const listExpenseCategories = async (): Promise<ExpenseCategory[]> => {
    await delay()
    return categories.filter((c) => c.isActive)
}

export type ExpenseCategoryInput = { name: string }

export const createExpenseCategory = async (
    input: ExpenseCategoryInput
): Promise<ExpenseCategory> => {
    await delay()
    const category: ExpenseCategory = { ...input, id: crypto.randomUUID(), isActive: true }
    categories = [...categories, category]
    return category
}

export const updateExpenseCategory = async (
    id: string,
    input: ExpenseCategoryInput
): Promise<ExpenseCategory> => {
    await delay()
    categories = categories.map((c) => (c.id === id ? { ...c, ...input } : c))
    return categories.find((c) => c.id === id) as ExpenseCategory
}

/** Categories are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateExpenseCategory = async (id: string): Promise<void> => {
    await delay()
    categories = categories.map((c) => (c.id === id ? { ...c, isActive: false } : c))
}
