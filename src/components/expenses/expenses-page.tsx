'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HandCoins, Plus, TriangleAlert, UserRound } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { PaymentSheet, type PaymentPreset } from '@/components/purchases/payment-sheet'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { canCloseMonth, canEnterExpenses, canManageExpenses, canReopenMonth } from '@/features/admin/roles'
import {
    expensesQueryKey,
    getMunshiCash,
    isDueSoon,
    isOverdue,
    isUnpaidBill,
    listExpenses,
    munshiCashQueryKey,
    type ExpenseStatus,
} from '@/features/expenses'
import { listSuppliers, suppliersQueryKey } from '@/features/suppliers'
import { workersPayable, workerKhataQueryKey } from '@/features/worker-khata'
import { workersQueryKey } from '@/features/workers'
import { useRouter } from '@/i18n/navigation'
import { useMoney } from '@/hooks/use-money'
import { AttendanceTab } from './attendance-tab'
import { ExpenseSheet } from './expense-sheet'
import { ExpensesTab } from './expenses-tab'
import { GiveCashSheet } from './give-cash-sheet'
import { MonthEndTab } from './month-end-tab'
import { PayWorkerSheet, type PayWorkerPreset } from './pay-worker-sheet'
import { ShopsTab } from './shops-tab'
import { WorkRegisterTab } from './work-register-tab'
import { WorkersTab } from './workers-tab'

type Tab = 'expenses' | 'register' | 'attendance' | 'workers' | 'monthEnd' | 'shops'

const tabs: Tab[] = ['expenses', 'register', 'attendance', 'workers', 'monthEnd', 'shops']

/** Munshi cash under this is flagged on the page as running low. */
const MUNSHI_LOW = 5000

const thisMonth = () => new Date().toISOString().slice(0, 7)

/**
 * Daily factory spending: record an expense, pay unpaid bills, give the munshi petty cash and see which shops
 * give on credit. Owner, Partner and Manager approve, cancel and give cash; a munshi records expenses
 * (they wait for approval when it is on) and pays from Munshi cash.
 */
export function ExpensesPage({ roleKey, userName }: { roleKey: string; userName: string }) {
    const t = useTranslations('expenses')
    const format = useFormatter()
    const money = useMoney()
    const router = useRouter()
    const canEnter = canEnterExpenses(roleKey)
    const canManage = canManageExpenses(roleKey)

    const [tab, setTab] = useState<Tab>('expenses')
    const [status, setStatus] = useState<ExpenseStatus | 'all'>('all')
    const [sheet, setSheet] = useState(false)
    const [give, setGive] = useState(false)
    const [payment, setPayment] = useState<PaymentPreset | null>(null)
    const [payWorker, setPayWorker] = useState<PayWorkerPreset | null>(null)

    // The cards count everything, whatever the table is filtered to.
    const all = useQuery({ queryKey: [expensesQueryKey, 'all'], queryFn: () => listExpenses() })
    const munshi = useQuery({ queryKey: [munshiCashQueryKey], queryFn: getMunshiCash })
    // Refetched whenever a worker is paid or earns; the card reads the same rows.
    const workers = useQuery({ queryKey: [workersQueryKey, 'payable', workerKhataQueryKey], queryFn: async () => workersPayable() })
    const shops = useQuery({ queryKey: [suppliersQueryKey, { type: 'shop' }], queryFn: () => listSuppliers({ type: 'shop' }) })

    const expenses = all.data ?? []
    const pending = expenses.filter((e) => e.status === 'pending')
    const monthTotal = expenses.filter((e) => e.status === 'approved' && e.date.startsWith(thisMonth())).reduce((s, e) => s + e.amount, 0)
    const unpaid = expenses.filter(isUnpaidBill)
    const nextDue = unpaid.map((e) => e.dueDate ?? '').filter(Boolean).sort()[0]
    const dueSoon = expenses.filter(isDueSoon)
    const overdue = expenses.filter(isOverdue)
    const shopsOwed = (shops.data ?? []).reduce((s, x) => s + Math.max(0, x.balance), 0)
    const munshiBalance = munshi.data?.balance ?? 0

    const showAttention = (canManage && pending.length > 0) || dueSoon.length > 0 || (!!munshi.data && munshiBalance < MUNSHI_LOW)

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canEnter && (
                        <>
                            {canManage && (
                                <Button variant="outline" onClick={() => setGive(true)}>
                                    <HandCoins /> {t('give.open')}
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setPayWorker({})}>
                                <UserRound /> {t('payWorker.open')}
                            </Button>
                            <Button onClick={() => setSheet(true)}>
                                <Plus /> {t('create')}
                            </Button>
                        </>
                    )
                }
            />

            {showAttention && (
                <div className="bg-muted flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-2 text-sm">
                    <TriangleAlert className="text-warning size-4" />
                    {canManage && pending.length > 0 && (
                        <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => {
                                setTab('expenses')
                                setStatus('pending')
                            }}
                        >
                            {t('attention.toApprove', { count: pending.length })}
                        </Button>
                    )}
                    {dueSoon.length > 0 && (
                        <span className={overdue.length > 0 ? 'text-destructive font-medium' : 'font-medium'}>
                            {overdue.length > 0
                                ? t('attention.overdue', { count: overdue.length })
                                : t('attention.dueSoon', { count: dueSoon.length, date: format.dateTime(new Date(`${dueSoon[0].dueDate}T00:00:00`), { dateStyle: 'medium' }) })}
                        </span>
                    )}
                    {munshi.data && munshiBalance < 0 && <span className="text-destructive font-medium">{t('attention.munshiNegative', { amount: money(-munshiBalance) })}</span>}
                    {munshi.data && munshiBalance >= 0 && munshiBalance < MUNSHI_LOW && <span className="font-medium">{t('attention.munshiLow', { amount: money(munshiBalance) })}</span>}
                </div>
            )}

            <StatCardGrid className="@5xl/main:grid-cols-5">
                <StatCard compact label={t('kpi.month')} value={money(monthTotal)} note={t('kpi.monthNote')} />
                <StatCard
                    compact
                    label={t('kpi.unpaid')}
                    value={money(unpaid.reduce((s, e) => s + e.amount, 0))}
                    note={nextDue ? t('kpi.nextDue', { date: format.dateTime(new Date(`${nextDue}T00:00:00`), { dateStyle: 'medium' }) }) : t('kpi.noneUnpaid')}
                />
                <StatCard
                    compact
                    label={t('kpi.munshi')}
                    value={money(munshiBalance)}
                    negative={munshiBalance < 0}
                    note={munshiBalance < 0 ? t('kpi.ownerOwes', { amount: money(-munshiBalance) }) : t('kpi.munshiNote')}
                />
                <StatCard compact label={t('kpi.workers')} value={money(workers.data ?? 0)} note={t('kpi.workersNote')} />
                <StatCard compact label={t('kpi.shops')} value={money(shopsOwed)} note={t('kpi.shopsNote')} />
            </StatCardGrid>

            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <TabsList>
                    {tabs.map((value) => (
                        <TabsTrigger key={value} value={value}>
                            {t(`tabs.${value}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {tab === 'register' ? (
                <WorkRegisterTab canEnter={canEnter} userName={userName} />
            ) : tab === 'attendance' ? (
                <AttendanceTab canEnter={canEnter} userName={userName} />
            ) : tab === 'workers' ? (
                <WorkersTab canEnter={canEnter} canManage={canManage} onPay={(worker) => setPayWorker({ workerId: worker.id })} />
            ) : tab === 'monthEnd' ? (
                <MonthEndTab canClose={canCloseMonth(roleKey)} canReopen={canReopenMonth(roleKey)} userName={userName} />
            ) : tab === 'shops' ? (
                <ShopsTab
                    canPay={canEnter}
                    onOpen={(shop) => router.push(`/suppliers?open=${shop.id}`)}
                    onPay={(shop) => setPayment({ supplierId: shop.id, amount: Math.max(0, shop.balance) })}
                />
            ) : (
                <ExpensesTab canEnter={canEnter} canManage={canManage} status={status} onStatusChange={setStatus} />
            )}

            <ExpenseSheet open={sheet} onOpenChange={setSheet} roleKey={roleKey} userName={userName} />
            <GiveCashSheet open={give} onOpenChange={setGive} userName={userName} />
            <PayWorkerSheet open={payWorker !== null} onOpenChange={(open) => !open && setPayWorker(null)} roleKey={roleKey} userName={userName} preset={payWorker ?? undefined} />
            <PaymentSheet
                open={payment !== null}
                onOpenChange={(open) => !open && setPayment(null)}
                roleKey={roleKey}
                userName={userName}
                preset={payment ?? undefined}
            />
        </div>
    )
}
