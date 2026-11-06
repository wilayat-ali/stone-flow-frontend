'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Info, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { ThemeCard } from '@/components/shared/theme-preview'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { THEME_IDS, type ThemeId } from '@/config/themes'
import { useRouter } from '@/i18n/navigation'
import { ApiError, request } from '@/lib/client-api'
import { useColorTheme } from '@/providers/color-theme-provider'

/** The company's default colour theme. Only an owner or partner reaches this page. */
export function BrandingPage({ current, companyName }: { current: ThemeId; companyName: string }) {
    const t = useTranslations('admin.branding')
    const tt = useTranslations('theme')
    const router = useRouter()
    const { personal } = useColorTheme()
    const [selected, setSelected] = useState<ThemeId>(current)

    const save = useMutation({
        mutationFn: () => request('/api/branding', { method: 'PATCH', body: { theme: selected } }),
        onSuccess: () => {
            toast.success(t('saved'))
            router.refresh()
        },
        onError: (error) => toast.error(error instanceof ApiError && error.status === 403 ? t('errors.forbidden') : t('errors.generic')),
    })

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title={t('title')} description={t('description')} />

            <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-base font-medium">{t('themeTitle')}</h2>
                    <p className="text-muted-foreground text-sm">{t('themeDescription', { company: companyName })}</p>
                </div>

                {personal && (
                    <Alert>
                        <Info />
                        <AlertDescription>{t('personalNote')}</AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {THEME_IDS.map((id) => (
                        <ThemeCard
                            key={id}
                            theme={id}
                            name={tt(`names.${id}`)}
                            selected={selected === id}
                            badge={current === id ? t('current') : undefined}
                            onSelect={() => setSelected(id)}
                            disabled={save.isPending}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <Button onClick={() => save.mutate()} disabled={save.isPending || selected === current}>
                        {save.isPending && <Loader2 className="animate-spin" />}
                        {t('save')}
                    </Button>
                    {selected === current && <span className="text-muted-foreground text-sm">{t('unchanged')}</span>}
                </div>
            </section>
        </div>
    )
}
