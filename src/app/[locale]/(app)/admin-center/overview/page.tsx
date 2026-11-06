import { ArrowUpRight, ShieldCheck, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/shared/page-header'
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

export default async function AdminOverviewPage() {
    const t = await getTranslations('admin')
    const tn = await getTranslations('nav')

    const links = [
        { href: '/admin-center/users', icon: Users, title: tn('users'), description: t('users.description') },
        { href: '/admin-center/roles', icon: ShieldCheck, title: tn('roles'), description: t('roles.description') },
    ] as const

    return (
        <>
            <PageHeader title={t('overview.title')} description={t('overview.description')} />
            <div className="grid gap-4 md:grid-cols-2">
                {links.map(({ href, icon: Icon, title, description }) => (
                    <Link key={href} href={href}>
                        <Card className="hover:bg-accent/50 h-full transition-colors">
                            <CardHeader>
                                <div className="bg-muted text-muted-foreground mb-2 flex size-10 items-center justify-center rounded-md">
                                    <Icon className="size-5" aria-hidden />
                                </div>
                                <CardTitle className="flex items-center justify-between">
                                    {title}
                                    <ArrowUpRight className="text-muted-foreground size-4 rtl:-scale-x-100" aria-hidden />
                                </CardTitle>
                                <CardDescription>{description}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </>
    )
}
