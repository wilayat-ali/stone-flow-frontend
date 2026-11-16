import { request } from '@/lib/client-api'

export type ExpenseCategory = {
    id: string
    name: string
    isActive: boolean
}

export const expenseCategoriesQueryKey = 'expense-categories'

const base = '/api/settings/expense-categories'

/** Nothing is ever hard-deleted, so a deactivated category is simply left out of the list. */
export const listExpenseCategories = () => request<ExpenseCategory[]>(base)

export type ExpenseCategoryInput = { name: string }

export const createExpenseCategory = (input: ExpenseCategoryInput) => request<ExpenseCategory>(base, { body: input })

export const updateExpenseCategory = (id: string, input: ExpenseCategoryInput) =>
    request<ExpenseCategory>(`${base}/${id}`, { method: 'PATCH', body: input })

/** Categories are never deleted — this only hides the row by setting `isActive: false`. */
export const deactivateExpenseCategory = async (id: string): Promise<void> => {
    await request<ExpenseCategory>(`${base}/${id}`, { method: 'PATCH', body: { isActive: false } })
}
