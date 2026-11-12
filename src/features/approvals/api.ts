import { request } from '@/lib/client-api'

export const approvalEntityTypes = [
    'purchase',
    'supplier_payment',
    'cash_entry',
    'stock_entry',
    'expense',
    'worker_payment',
] as const

export type ApprovalEntityType = (typeof approvalEntityTypes)[number]

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type Approval = {
    id: string
    entityType: ApprovalEntityType
    entityId: string
    /** Text the module wrote for the list, e.g. "Truck 20/3 · Arshad Khan". */
    summary: string
    amount: number | null
    status: ApprovalStatus
    requestedBy: string
    requestedAt: string
    decidedBy: string | null
    decidedAt: string | null
    reason: string | null
}

export type Paged<T> = { total: number; rows: T[] }

export type ApprovalFilters = { status?: ApprovalStatus; type?: ApprovalEntityType }

/** Prefix of every approvals key; one invalidation refreshes the list, the nav badge and the bell. */
export const approvalsKey = ['approvals'] as const
export const approvalsListKey = (filters: ApprovalFilters) => [...approvalsKey, 'list', filters] as const
export const pendingCountKey = [...approvalsKey, 'pending-count'] as const

// The backend serves approvals under Cash & Bank for now; a generic /approvals comes with 03c.
const base = '/api/cash-bank/approvals'

const query = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    for (const [name, value] of Object.entries(params)) if (value !== undefined) search.set(name, String(value))
    return `?${search}`
}

// The table pages in the browser, so it asks for up to this many at once.
const LIMIT = 200

export const listApprovals = (filters: ApprovalFilters = {}) =>
    request<Paged<Approval>>(`${base}${query({ ...filters, limit: LIMIT })}`)

/** How many entries wait for a decision (the nav badge). */
export const pendingCount = async (): Promise<number> =>
    (await request<Paged<Approval>>(`${base}${query({ status: 'pending', limit: 1 })}`)).total

export const approveEntry = (id: string) => request<unknown>(`${base}/${id}/approve`, { body: {} })

export const rejectEntry = (id: string, reason: string) =>
    request<unknown>(`${base}/${id}/reject`, { body: { reason } })
