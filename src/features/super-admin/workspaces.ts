import { ApiError, request } from '@/lib/client-api'

/** Product modules a workspace can be given access to (the backend's "platforms"). */
export const platformKeys = ['factory', 'showroom', 'mine'] as const

export type PlatformKey = (typeof platformKeys)[number]

export type WorkspaceStatus = 'active' | 'suspended'

export type Workspace = {
    id: string
    name: string
    slug: string
    status: WorkspaceStatus
    createdAt: string
    owner: {
        userId: number | string
        firstName: string | null
        lastName: string | null
        phone: string | null
        email: string | null
    }
    platforms: Record<PlatformKey, boolean>
}

export type CreateWorkspaceInput = {
    name: string
    slug: string
    platforms: PlatformKey[]
    owner: { firstName: string; lastName?: string; phone?: string; email?: string }
}

export type CreateWorkspaceResult = {
    company: { id: string; name: string; slug: string; status: string }
    owner: { userId: number | string; memberId: string; memberStatus: string; accountExisted: boolean }
    invite: { inviteLink: string; whatsappLink: string; expiresAt: string } | null
}

export const workspacesKey = ['workspaces'] as const

const base = '/api/s-admin/companies'
const PAGE_SIZE = 50

type Page = { data: Workspace[]; page: number; total: number }

/** Every workspace, fetched page by page (the backend allows at most 50 per page). */
export async function listWorkspaces(): Promise<Workspace[]> {
    const all: Workspace[] = []
    for (let page = 1; ; page++) {
        const result = await request<Page>(`${base}?page=${page}&limit=${PAGE_SIZE}`)
        all.push(...result.data)
        if (all.length >= result.total || result.data.length === 0) return all
    }
}

export const createWorkspace = (input: CreateWorkspaceInput) =>
    request<CreateWorkspaceResult>(base, { body: input })

export const setWorkspaceActive = (id: string, active: boolean) =>
    request<unknown>(`${base}/${id}/${active ? 'reactivate' : 'suspend'}`, { method: 'PATCH', body: {} })

export const setWorkspacePlatform = (id: string, key: PlatformKey, isEnabled: boolean) =>
    request<Record<PlatformKey, boolean>>(`${base}/${id}/platforms/${key}`, {
        method: 'PUT',
        body: { isEnabled },
    })

export const ownerName = (owner: Workspace['owner']) =>
    [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email || owner.phone || ''

/** Lowercase letters, digits and single hyphens, at most 40 characters, for a workspace name. */
export const slugify = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
        .replace(/-+$/, '')

/** Starts with a letter or digit, ends with one, 3-40 characters (the backend also blocks reserved words). */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

const firstString = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
        for (const inner of Object.values(value)) {
            const found = firstString(inner)
            if (found) return found
        }
    }
}

/** Which message key explains a failed request, for the toast. */
export function failureKey(error: unknown): string {
    if (!(error instanceof ApiError)) return 'generic'
    const body = error.body as { errors?: unknown } | null
    if (error.status === 403) return 'forbidden'
    const nested = firstString(body?.errors)
    // Our own failures are short codes; field validation comes back as a sentence.
    if (nested && !nested.includes(' ')) return nested
    const fields = body?.errors && typeof body.errors === 'object' ? Object.keys(body.errors) : []
    if (fields.includes('slug')) return 'slugInvalid'
    return 'generic'
}
