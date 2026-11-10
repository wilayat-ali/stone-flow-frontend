'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeftRight,
    ChevronDown,
    Landmark,
    MoreVertical,
    Pencil,
    Plus,
    Power,
    TriangleAlert,
    Wallet,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { SelectableList } from '@/components/shared/selectable-list'
import { StatCard, StatCardGrid } from '@/components/shared/stat-card'
import { SettingsActions } from '@/components/settings/settings-shell'
import {
    accountsKey,
    bankCashKey,
    entriesKey,
    listAccounts,
    listEntries,
    updateAccount,
} from '@/features/bank-cash/api'
import {
    balanceOf,
    statementOf,
    type StatementRow,
} from '@/features/bank-cash/ledger'
import type { AccountKind, AccountOption } from '@/features/bank-cash/types'
import { useErrorMessage } from '@/features/bank-cash/use-error-message'
import { useMoney } from '@/hooks/use-money'
import { formatLakh } from '@/lib/format'
import { AccountSheet } from './account-sheet'
import { CashCountSheet } from './cash-count-sheet'
import { EntrySheet } from './entry-sheet'
import { MoneyEntrySheet, type MoneyMode } from './money-entry-sheet'
import { StatementTable } from './statement-table'
import { TransferSheet } from './transfer-sheet'

const moneyModes: MoneyMode[] = ['deposit', 'otherReceipt', 'otherPayment']

/** Settings → Bank & Cash: totals, the accounts, and the selected account's statement. */
export function BankCashPage() {
    const t = useTranslations('settings.bankCash')
    const tc = useTranslations('common')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useErrorMessage()
    const accounts = useQuery({ queryKey: accountsKey, queryFn: listAccounts })
    const entries = useQuery({ queryKey: entriesKey, queryFn: listEntries })
    const [selectedId, setSelectedId] = useState<string>()
    const [opened, setOpened] = useState<StatementRow | null>(null)
    const [accountSheet, setAccountSheet] = useState<'add' | 'edit' | null>(
        null
    )
    const [moneyMode, setMoneyMode] = useState<MoneyMode | null>(null)
    const [transferOpen, setTransferOpen] = useState(false)
    const [countOpen, setCountOpen] = useState(false)
    const [editingId, setEditingId] = useState<string>()
    const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

    const active = useMemo(
        () => (accounts.data ?? []).filter((a) => a.isActive),
        [accounts.data]
    )
    const balances = useMemo(
        () =>
            new Map(
                active.map((a) => [a.id, balanceOf(a, entries.data ?? [])])
            ),
        [active, entries.data]
    )
    const options = useMemo<AccountOption[]>(
        () =>
            active.map((a) => ({
                id: a.id,
                name: a.name,
                kind: a.kind,
                balance: balances.get(a.id) ?? 0,
            })),
        [active, balances]
    )
    const selected = active.find((a) => a.id === selectedId) ?? active[0]
    const rows = useMemo(
        () => (selected ? statementOf(selected, entries.data ?? []) : []),
        [selected, entries.data]
    )

    const deactivate = useMutation({
        mutationFn: (id: string) => updateAccount(id, { isActive: false }),
        onSuccess: () => {
            toast.success(t('deactivated'))
            setDeactivatingId(null)
            setSelectedId(undefined)
            queryClient.invalidateQueries({ queryKey: bankCashKey })
        },
        onError: (error) => {
            toast.error(errorMessage(error))
            setDeactivatingId(null)
        },
    })

    if (accounts.isLoading || entries.isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    // Without this a stopped server would read as "No accounts yet".
    if (accounts.isError || entries.isError) {
        return (
            <EmptyState
                title={t('loadFailed')}
                icon={TriangleAlert}
                action={
                    <Button
                        variant="outline"
                        onClick={() => {
                            accounts.refetch()
                            entries.refetch()
                        }}
                    >
                        {t('retry')}
                    </Button>
                }
            />
        )
    }

    const balance = (id: string) => balances.get(id) ?? 0
    const sumOf = (kind?: AccountKind) =>
        active
            .filter((a) => !kind || a.kind === kind)
            .reduce((sum, a) => sum + balance(a.id), 0)
    const total = sumOf()

    const addAccount = (
        <Button
            variant="outline"
            className="justify-start"
            onClick={() => setAccountSheet('add')}
        >
            <Plus /> {t('addAccount')}
        </Button>
    )

    const sheets = (
        <>
            <AccountSheet
                open={accountSheet !== null}
                onOpenChange={(open) => !open && setAccountSheet(null)}
                account={
                    accountSheet === 'edit'
                        ? active.find((a) => a.id === editingId)
                        : undefined
                }
            />
            <MoneyEntrySheet
                mode={moneyMode}
                onClose={() => setMoneyMode(null)}
                accounts={options}
                defaultAccountId={selected?.id}
            />
            <TransferSheet
                open={transferOpen}
                onOpenChange={setTransferOpen}
                accounts={options}
                defaultFromId={selected?.id}
            />
            <CashCountSheet
                open={countOpen}
                onOpenChange={setCountOpen}
                accounts={options.filter((a) => a.kind === 'cash')}
            />
        </>
    )

    if (!selected) {
        return (
            <>
                <EmptyState
                    title={t('noAccounts')}
                    icon={Landmark}
                    action={addAccount}
                />
                {sheets}
            </>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <SettingsActions>
                <Button variant="outline" onClick={() => setTransferOpen(true)}>
                    <ArrowLeftRight /> {t('transfer')}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button>
                            <Plus /> {t('newEntry')} <ChevronDown />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {moneyModes.map((mode) => (
                            <DropdownMenuItem
                                key={mode}
                                onClick={() => setMoneyMode(mode)}
                            >
                                {t(`types.${mode}`)}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            disabled={!options.some((a) => a.kind === 'cash')}
                            onClick={() => setCountOpen(true)}
                        >
                            {t('types.adjustment')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SettingsActions>

            <StatCardGrid className="@xl/main:grid-cols-3 @5xl/main:grid-cols-3">
                <StatCard
                    compact
                    label={t('total')}
                    value={money(total)}
                    negative={total < 0}
                />
                <StatCard
                    compact
                    label={t('cash')}
                    value={money(sumOf('cash'))}
                    negative={sumOf('cash') < 0}
                />
                <StatCard
                    compact
                    label={t('banks')}
                    value={money(sumOf('bank'))}
                    negative={sumOf('bank') < 0}
                />
            </StatCardGrid>

            <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
                <SelectableList
                    className="bg-card h-80 overflow-hidden rounded-xl border px-2 shadow-xs [--list-fade:var(--card)] lg:h-0 lg:min-h-full"
                    label={t('accounts')}
                    selectedId={selected.id}
                    onSelect={setSelectedId}
                    count={active.length}
                    action={
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAccountSheet('add')}
                        >
                            <Plus /> {t('addAccount')}
                        </Button>
                    }
                    items={active.map((a) => ({
                        id: a.id,
                        title: a.name,
                        meta: a.last4 ? `••${a.last4}` : t('cash'),
                        value: formatLakh(balance(a.id)),
                        icon: a.kind === 'cash' ? Wallet : Landmark,
                        negative: balance(a.id) < 0,
                        actions: (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label={t('accountMenu')}
                                    >
                                        <MoreVertical />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setEditingId(a.id)
                                            setAccountSheet('edit')
                                        }}
                                    >
                                        <Pencil /> {t('editAccount')}
                                    </DropdownMenuItem>
                                    {a.kind === 'bank' && (
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() =>
                                                setDeactivatingId(a.id)
                                            }
                                        >
                                            <Power /> {t('deactivate')}
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ),
                    }))}
                />

                <div className="min-w-0">
                    <StatementTable
                        key={selected.id}
                        rows={rows}
                        onRowClick={setOpened}
                    />
                </div>
            </div>

            <EntrySheet
                row={opened}
                accountName={selected.name}
                onClose={() => setOpened(null)}
            />
            {sheets}
            <ConfirmDialog
                open={!!deactivatingId}
                onOpenChange={(open) => !open && setDeactivatingId(null)}
                title={t('deactivateTitle', {
                    name:
                        active.find((a) => a.id === deactivatingId)?.name ?? '',
                })}
                description={t('deactivateDescription')}
                confirmLabel={t('deactivate')}
                cancelLabel={tc('cancel')}
                loading={deactivate.isPending}
                onConfirm={() =>
                    deactivatingId && deactivate.mutate(deactivatingId)
                }
            />
        </div>
    )
}
