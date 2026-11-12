'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { listNotifications, markAllRead, markRead, notificationsKey, type Notification } from '@/features/notifications'
import { cn } from '@/lib/utils'

/** Bell in the top bar: unread count, the latest notifications, mark-as-read, and a link to each. */
export function NotificationsBell() {
    const t = useTranslations('notifications')
    const format = useFormatter()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)

    const list = useQuery({
        queryKey: notificationsKey,
        queryFn: listNotifications,
        refetchInterval: 60_000,
    })
    const rows = list.data?.rows ?? []
    const unread = rows.filter((n) => !n.readAt).length

    const refresh = () => queryClient.invalidateQueries({ queryKey: notificationsKey })
    const read = useMutation({ mutationFn: markRead, onSuccess: refresh })
    const readAll = useMutation({ mutationFn: markAllRead, onSuccess: refresh })

    const openOne = (n: Notification) => {
        if (!n.readAt) read.mutate(n.id)
        setOpen(false)
        // The backend gives an app path without the locale; the i18n router adds it.
        if (n.link) router.push(n.link)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={t('title')}>
                    <Bell />
                    {unread > 0 && (
                        <span className="bg-primary text-primary-foreground absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-sm font-medium">{t('title')}</span>
                    <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        disabled={unread === 0 || readAll.isPending}
                        onClick={() => readAll.mutate()}
                    >
                        {t('markAllRead')}
                    </Button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {list.isLoading ? (
                        <div className="flex flex-col gap-2 p-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : list.isError ? (
                        <p className="text-muted-foreground p-4 text-center text-sm">{t('loadFailed')}</p>
                    ) : rows.length === 0 ? (
                        <p className="text-muted-foreground p-4 text-center text-sm">{t('empty')}</p>
                    ) : (
                        rows.map((n) => (
                            <button
                                key={n.id}
                                type="button"
                                onClick={() => openOne(n)}
                                className={cn(
                                    'hover:bg-accent flex w-full flex-col gap-0.5 border-b px-3 py-2 text-start last:border-b-0',
                                    !n.readAt && 'bg-accent/40'
                                )}
                            >
                                <span className="text-sm font-medium">{n.title}</span>
                                <span className="text-muted-foreground text-xs">{n.text}</span>
                                <span className="text-muted-foreground text-xs">
                                    {format.relativeTime(new Date(n.createdAt))}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
