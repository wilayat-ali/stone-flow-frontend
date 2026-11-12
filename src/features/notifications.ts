import { request } from '@/lib/client-api'
import type { Paged } from '@/features/approvals/api'

export type Notification = {
    id: string
    type: string
    title: string
    text: string
    /** App path to open, without the locale, e.g. `/approvals`. */
    link: string | null
    readAt: string | null
    createdAt: string
}

export const notificationsKey = ['notifications'] as const

const base = '/api/notifications'

export const listNotifications = () => request<Paged<Notification>>(`${base}?limit=20`)

export const markRead = (id: string) => request<unknown>(`${base}/${id}/read`, { body: {} })

export const markAllRead = () => request<unknown>(`${base}/read-all`, { body: {} })
