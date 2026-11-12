'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardList, Plus, TriangleAlert, Truck, Wallet } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RejectDialog } from '@/components/approvals/reject-dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { canCreateSuppliers, canManageSuppliers } from '@/features/admin/roles'
import { unclearedChequeTotal } from '@/features/customer-cheque-store'
import { customerChequesQueryKey, dueCheques, listCustomerCheques } from '@/features/customer-payments'
import { useRouter } from '@/i18n/navigation'
import { customersQueryKey, listCustomerSummaries } from '@/features/customers'
import { inventoryQueryKey } from '@/features/inventory'
import { useTableLabels } from '@/features/resource-labels'
import {
    billsQueryKey,
    cancelBill,
    cancelOrder,
    lineSqFt,
    listBills,
    listOrders,
    orderStatus,
    ordersQueryKey,
    paymentInfo,
    toCollect,
    type Bill,
    type BillFilters,
    type Collection,
    type PaymentState,
    type SalesOrder,
} from '@/features/sales'
import { useSalesErrorMessage } from '@/features/use-sales-error-message'
import { useMoney } from '@/hooks/use-money'
import { BillDialog, draftsFromOrder, type BillPreset } from './bill-dialog'
import { BillPanel } from './bill-panel'
import { GiveStoneDialog } from './give-stone-dialog'
import { OrderPanel } from './order-panel'
import { OrdersTab } from './orders-tab'
import { GatePassDialog, ParchiDialog } from './parchi'
import { CustomerChequesTab } from './customer-cheques-tab'
import { CustomerPaymentsTab } from './customer-payments-tab'
import { PaymentStateBadge } from './payment-state'
import { ReceivePaymentSheet, type ReceivePreset } from './receive-payment-sheet'

const ALL = 'all'

type Tab = 'bills' | 'orders' | 'payments' | 'cheques'

const thisMonth = () => new Date().toISOString().slice(0, 7)

/**
 * Sales: make a bill with agreed rates, take payment now or leave it as udhaar, and give the stone now
 * or over several days. Stone leaves the yard only when it is collected. Orders, customer payments and
 * cheques have their own steps.
 */
export function SalesPage({ roleKey, userName }: { roleKey: string; userName: string }) {
    const t = useTranslations('sales')
    const format = useFormatter()
    const money = useMoney()
    const labels = useTableLabels()
    const queryClient = useQueryClient()
    const errorMessage = useSalesErrorMessage()
    const canAct = canCreateSuppliers(roleKey)
    const canManage = canManageSuppliers(roleKey)
    const router = useRouter()
    const [receive, setReceive] = useState<ReceivePreset | null>(null)

    const [tab, setTab] = useState<Tab>('bills')
    const [orderDialog, setOrderDialog] = useState(false)
    const [openOrderId, setOpenOrderId] = useState<string | null>(null)
    const [cancellingOrder, setCancellingOrder] = useState<SalesOrder | null>(null)
    const [payment, setPayment] = useState<PaymentState | typeof ALL>(ALL)
    const [collect, setCollect] = useState<'to' | 'done' | typeof ALL>(ALL)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [billDialog, setBillDialog] = useState<{ bill?: Bill; preset?: BillPreset } | null>(null)
    const [giving, setGiving] = useState<Bill | null>(null)
    const [cancelling, setCancelling] = useState<Bill | null>(null)
    const [parchi, setParchi] = useState<Bill | null>(null)
    const [gate, setGate] = useState<{ bill: Bill; collection: Collection } | null>(null)

    const filters = useMemo<BillFilters>(
        () => ({ ...(payment !== ALL && { payment }), ...(collect !== ALL && { collect }) }),
        [payment, collect]
    )
    const list = useQuery({ queryKey: [billsQueryKey, filters], queryFn: () => listBills(filters) })
    // The cards count everything, whatever the table is filtered to.
    const all = useQuery({ queryKey: [billsQueryKey, 'all'], queryFn: () => listBills() })
    const customers = useQuery({ queryKey: [customersQueryKey, 'summaries', 'all'], queryFn: () => listCustomerSummaries() })
    const orders = useQuery({ queryKey: [ordersQueryKey, 'all'], queryFn: () => listOrders() })
    // Refetched whenever a cheque is received, cleared or bounced; the cards and the attention strip read the same rows.
    const chequeList = useQuery({ queryKey: [customerChequesQueryKey, 'all'], queryFn: () => listCustomerCheques() })
    const dueNow = chequeList.data ? dueCheques() : []
    const inHand = chequeList.data ? unclearedChequeTotal() : 0

    const openOrder = (orders.data ?? []).find((o) => o.id === openOrderId) ?? null
    const todayStr = new Date().toISOString().slice(0, 10)
    const soonDate = new Date()
    soonDate.setDate(soonDate.getDate() + 3)
    const soon = soonDate.toISOString().slice(0, 10)
    // Orders due within 3 days, or already late.
    const dueOrders = (orders.data ?? []).filter((o) => orderStatus(o) === 'open' && o.neededBy <= soon)
    const bills = all.data ?? []
    const selected = bills.find((b) => b.id === selectedId) ?? null
    const month = bills.filter((b) => b.status === 'active' && b.date.startsWith(thisMonth()))
    const receivedMonth = bills.flatMap((b) => b.payments).filter((p) => p.date.startsWith(thisMonth())).reduce((s, p) => s + p.amount, 0)
    const udhaar = (customers.data ?? []).reduce((s, c) => s + Math.max(0, c.balance), 0)
    const toCollectBills = bills.filter(toCollect)
    const sqftMonth = month.reduce((s, b) => s + b.lines.reduce((a, l) => a + lineSqFt(l), 0), 0)

    const cancel = useMutation({
        mutationFn: ({ bill, reason }: { bill: Bill; reason: string }) => cancelBill(bill.id, reason, userName),
        onSuccess: () => {
            toast.success(t('cancelled'))
            setCancelling(null)
            for (const key of [billsQueryKey, inventoryQueryKey, customersQueryKey, 'customer-khata']) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const cancelOrderMutation = useMutation({
        mutationFn: (order: SalesOrder) => cancelOrder(order.id),
        onSuccess: () => {
            toast.success(t('orders.cancelled'))
            setCancellingOrder(null)
            setOpenOrderId(null)
            queryClient.invalidateQueries({ queryKey: [ordersQueryKey] })
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const makeBill = (order: SalesOrder) => {
        setOpenOrderId(null)
        setBillDialog({
            preset: { customerId: order.customerId, factoryId: order.factoryId, orderId: order.id, lines: draftsFromOrder(order), note: order.note },
        })
    }

    const summary = (b: Bill) => {
        const sq = b.lines.reduce((s, l) => s + (l.item.itemType === 'piece' ? lineSqFt(l) : 0), 0)
        const inches = b.lines.filter((l) => l.item.itemType === 'counter').reduce((s, l) => s + l.inches, 0)
        const slabs = b.lines.filter((l) => l.item.itemType === 'slab')
        return [
            sq ? `${format.number(sq, { maximumFractionDigits: 1 })} ${t('units.sqft')}` : '',
            inches ? `${format.number(inches)} ${t('units.inchCounters')}` : '',
            slabs.length ? `${format.number(slabs.reduce((s, l) => s + l.qty, 0))} ${t('units.slabs')} · ${format.number(slabs.reduce((s, l) => s + l.tons, 0), { maximumFractionDigits: 1 })} ${t('units.tons')}` : '',
        ]
            .filter(Boolean)
            .join(' · ')
    }

    const columns = useMemo<ColumnDef<Bill>[]>(
        () => [
            {
                accessorKey: 'billNo',
                header: t('columns.bill'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium tabular-nums">{row.original.billNo}</span>
                        <span className="text-muted-foreground text-xs">{format.dateTime(new Date(`${row.original.date}T00:00:00`), { dateStyle: 'medium' })}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'customerName',
                header: t('columns.customer'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{row.original.customerName}</span>
                        <span className="text-muted-foreground text-xs">
                            {row.original.customerId ? row.original.customerPhone : t('walkin')}
                            {row.original.orderId && ` · ${row.original.orderId}`}
                        </span>
                    </div>
                ),
            },
            {
                id: 'items',
                accessorFn: (b) => b.lines.map((l) => l.item.material).join(' '),
                header: t('columns.items'),
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{summary(row.original)}</span>
                        <span className="text-muted-foreground text-xs">{t('itemCount', { count: row.original.lines.length })}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'total',
                header: t('columns.total'),
                meta: { className: 'text-end' },
                cell: ({ row }) => <b className="tabular-nums">{money(row.original.total)}</b>,
            },
            {
                id: 'payment',
                accessorFn: (b) => paymentInfo(b).due,
                header: t('columns.payment'),
                cell: ({ row }) => {
                    const info = paymentInfo(row.original)
                    return (
                        <div className="flex flex-col items-start gap-0.5">
                            <PaymentStateBadge state={info.state} />
                            {info.due > 0 && info.state !== 'cancelled' && <span className="text-destructive text-xs tabular-nums">{t('due', { amount: money(info.due) })}</span>}
                        </div>
                    )
                },
            },
            {
                id: 'stone',
                header: t('columns.stone'),
                enableSorting: false,
                cell: ({ row }) => {
                    const b = row.original
                    if (b.status === 'cancelled') return <span className="text-muted-foreground">—</span>
                    return toCollect(b) ? (
                        canAct ? (
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); setGiving(b) }}>
                                <Truck /> {t('giveStone')}
                            </Button>
                        ) : (
                            <span className="text-destructive text-sm">{t('toCollect')}</span>
                        )
                    ) : (
                        <span className="text-success inline-flex items-center gap-1 text-sm">
                            <Check className="size-4" /> {t('collected')}
                        </span>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, format, money, canAct]
    )

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={t('title')}
                description={t('description')}
                actions={
                    canAct && (
                        <>
                            <Button variant="outline" onClick={() => setReceive({})}>
                                <Wallet /> {t('receivePayment')}
                            </Button>
                            <Button variant="outline" onClick={() => setOrderDialog(true)}>
                                <ClipboardList /> {t('newOrder')}
                            </Button>
                            <Button onClick={() => setBillDialog({})}>
                                <Plus /> {t('newBill')}
                            </Button>
                        </>
                    )
                }
            />

            {(toCollectBills.length > 0 || dueOrders.length > 0 || dueNow.length > 0) && (
                <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm">
                    <TriangleAlert className="text-warning size-4" />
                    <span className="font-medium">{t('attention.title')}</span>
                    {toCollectBills.length > 0 && (
                        <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => {
                                setTab('bills')
                                setCollect('to')
                            }}
                        >
                            {t('attention.toCollect', { count: toCollectBills.length })}
                        </Button>
                    )}
                    {dueNow.map((c) => (
                        <Button key={c.id} variant="link" className="h-auto p-0" onClick={() => setTab('cheques')}>
                            {t('attention.chequeDue', { no: c.chequeNo, customer: c.customerName })}
                        </Button>
                    ))}
                    {dueOrders.map((o) => (
                        <Button key={o.id} variant="link" className={`h-auto p-0 ${o.neededBy < todayStr ? 'text-destructive' : ''}`} onClick={() => setOpenOrderId(o.id)}>
                            {o.neededBy < todayStr ? t('attention.orderLate', { no: o.orderNo }) : t('attention.orderDue', { no: o.orderNo })}
                        </Button>
                    ))}
                </div>
            )}

            <StatCardGrid className="@5xl/main:grid-cols-5">
                <StatCard
                    compact
                    label={t('kpi.sales')}
                    value={money(month.reduce((s, b) => s + b.total, 0))}
                    note={t('kpi.salesNote', { count: month.length, sqft: format.number(sqftMonth, { maximumFractionDigits: 0 }) })}
                />
                <StatCard compact label={t('kpi.received')} value={money(receivedMonth)} note={t('kpi.receivedNote')} />
                <StatCard compact label={t('kpi.udhaar')} value={money(udhaar)} note={t('kpi.udhaarNote')} negative={udhaar > 0} />
                <StatCard compact label={t('kpi.cheques')} value={money(inHand)} note={t('kpi.chequesNote')} />
                <StatCard
                    compact
                    label={t('kpi.toCollect')}
                    value={String(toCollectBills.length)}
                    note={toCollectBills.length ? t('kpi.toCollectNote') : t('kpi.allCollected')}
                    negative={toCollectBills.length > 0}
                />
            </StatCardGrid>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList>
                    {(['bills', 'orders', 'payments', 'cheques'] as const).map((value) => (
                        <TabsTrigger key={value} value={value}>
                            {t(`tabs.${value}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* Without this a stopped server would read as "No records found". */}
            {tab === 'orders' ? (
                <OrdersTab canAct={canAct} onOpen={(o) => setOpenOrderId(o.id)} onMakeBill={makeBill} />
            ) : tab === 'payments' ? (
                <CustomerPaymentsTab canReverse={canManage} onOpenCustomer={(id) => router.push(`/customers?open=${id}`)} />
            ) : tab === 'cheques' ? (
                <CustomerChequesTab canManage={canManage} />
            ) : list.isError ? (
                <EmptyState
                    title={t('loadFailed')}
                    icon={TriangleAlert}
                    action={
                        <Button variant="outline" onClick={() => list.refetch()}>
                            {t('retry')}
                        </Button>
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={list.data ?? []}
                    labels={labels}
                    loading={list.isLoading}
                    pageSize={25}
                    onRowClick={(row) => setSelectedId(row.id)}
                    toolbar={
                        <div className="flex flex-wrap gap-2">
                            <Select value={payment} onValueChange={(v) => setPayment(v as PaymentState | typeof ALL)}>
                                <SelectTrigger className="w-44">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t('filters.allPayments')}</SelectItem>
                                    {(['paid', 'partly', 'udhaar', 'cancelled'] as const).map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {t(`payState.${s}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={collect} onValueChange={(v) => setCollect(v as 'to' | 'done' | typeof ALL)}>
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t('filters.allStone')}</SelectItem>
                                    <SelectItem value="to">{t('filters.toCollect')}</SelectItem>
                                    <SelectItem value="done">{t('filters.collected')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    }
                />
            )}

            <BillPanel
                bill={selected}
                canAct={canAct}
                onClose={() => setSelectedId(null)}
                onGive={setGiving}
                onParchi={setParchi}
                onEdit={(bill) => setBillDialog({ bill })}
                onCancel={setCancelling}
                onGatePass={(bill, collection) => setGate({ bill, collection })}
                onReceive={(bill) => setReceive({ customerId: bill.customerId ?? undefined, billId: bill.id, billNo: bill.billNo, amount: Math.max(0, paymentInfo(bill).due) })}
            />

            <ReceivePaymentSheet open={receive !== null} onOpenChange={(open) => !open && setReceive(null)} userName={userName} preset={receive ?? undefined} />

            <OrderPanel
                order={openOrder}
                canAct={canAct}
                onClose={() => setOpenOrderId(null)}
                onMakeBill={makeBill}
                onReceiveAdvance={(order) => setReceive({ customerId: order.customerId, orderId: order.id, orderNo: order.orderNo })}
                onCancel={setCancellingOrder}
                onOpenBill={(bill) => {
                    setOpenOrderId(null)
                    setTab('bills')
                    setSelectedId(bill.id)
                }}
            />

            <BillDialog
                open={orderDialog}
                mode="order"
                userName={userName}
                onClose={() => setOrderDialog(false)}
                onSaved={() => undefined}
                onSavedOrder={() => setTab('orders')}
            />

            <ConfirmDialog
                open={!!cancellingOrder}
                onOpenChange={(open) => !open && setCancellingOrder(null)}
                title={t('orders.cancelDialog.title', { no: cancellingOrder?.orderNo ?? '' })}
                description={t('orders.cancelDialog.description')}
                confirmLabel={t('orders.cancelDialog.submit')}
                cancelLabel={t('cancelDialog.keep')}
                loading={cancelOrderMutation.isPending}
                onConfirm={() => cancellingOrder && cancelOrderMutation.mutate(cancellingOrder)}
            />

            <BillDialog
                open={billDialog !== null}
                bill={billDialog?.bill}
                preset={billDialog?.preset}
                userName={userName}
                onClose={() => setBillDialog(null)}
                onSaved={setParchi}
            />

            <GiveStoneDialog bill={giving} userName={userName} onClose={() => setGiving(null)} onGiven={(bill, collection) => setGate({ bill, collection })} />

            <ParchiDialog bill={parchi} onClose={() => setParchi(null)} />
            <GatePassDialog target={gate} onClose={() => setGate(null)} />

            <RejectDialog
                open={!!cancelling}
                onOpenChange={(open) => !open && setCancelling(null)}
                pending={cancel.isPending}
                labels={{
                    title: t('cancelDialog.title', { no: cancelling?.billNo ?? '' }),
                    description: cancelling ? t('cancelDialog.description', { amount: money(cancelling.total) }) : '',
                    reason: t('cancelDialog.reason'),
                    required: t('cancelDialog.required'),
                    submit: t('cancelDialog.submit'),
                    cancel: t('cancelDialog.keep'),
                }}
                onSubmit={(reason) => cancelling && cancel.mutate({ bill: cancelling, reason })}
            />
        </div>
    )
}
