'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
    companySettingsKey,
    getCompanySettings,
    updateCompanySettings,
} from '@/features/company-settings'

/**
 * Company-wide approval policy: on by default, it is read here and enforced wherever
 * purchases, payments and stock entries are recorded (those modules are not built yet).
 */
export function ApprovalSettingCard({ canManage }: { canManage: boolean }) {
    const t = useTranslations('admin.roles.approval')
    const queryClient = useQueryClient()
    const settings = useQuery({
        queryKey: companySettingsKey,
        queryFn: getCompanySettings,
    })

    const save = useMutation({
        mutationFn: (approvalRequired: boolean) =>
            updateCompanySettings({ approvalRequired }),
        onSuccess: () => {
            toast.success(t('updated'))
            queryClient.invalidateQueries({ queryKey: companySettingsKey })
        },
        onError: () => toast.error(t('saveFailed')),
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {settings.isLoading ? (
                    <Skeleton className="h-6 w-full max-w-sm" />
                ) : (
                    <div className="flex items-center gap-3">
                        <Switch
                            id="approval-required"
                            checked={settings.data?.approvalRequired ?? true}
                            disabled={!canManage || save.isPending}
                            onCheckedChange={(checked) => save.mutate(checked)}
                        />
                        <Label htmlFor="approval-required" className="font-normal">
                            {t('switchLabel')}
                        </Label>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
