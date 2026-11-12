'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DateField, SelectField, TextField } from '@/components/shared/form-fields'
import { FormSheet } from '@/components/shared/form-sheet'
import { TileField } from '@/components/shared/tile-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { companySettingsKey, getCompanySettings } from '@/features/company-settings'
import { expenseCategoriesQueryKey, listExpenseCategories } from '@/features/expense-categories'
import { createExpense, expensesQueryKey, MUNSHI_ACCOUNT_ID, munshiCashQueryKey, payModes } from '@/features/expenses'
import { expenseSchema, type ExpenseValues } from '@/features/expenses-schema'
import { factoriesQueryKey, listFactories } from '@/features/factories'
import { listSuppliers, suppliersQueryKey } from '@/features/suppliers'
import { useExpenseErrorMessage } from '@/features/use-expense-error-message'
import { useMoney } from '@/hooks/use-money'
import { todayIso } from '@/lib/format'
import { useAccountBalances } from './use-account-balances'

const emptyValues = (roleKey: string): ExpenseValues => ({
    date: todayIso(),
    categoryId: '',
    description: '',
    amount: '',
    factoryId: '',
    payMode: 'paid',
    // A munshi spends from his own cash.
    accountId: roleKey === 'munshi' ? MUNSHI_ACCOUNT_ID : '',
    dueDate: '',
    shopId: '',
    photoName: '',
})

/**
 * One day's spending: pick the category, say what for and how much, then how it is paid. Paid now comes
 * out of an account (or the munshi's cash, which may go negative); an unpaid bill waits for Pay Bill;
 * credit from a shop goes on that shop's khata.
 */
export function ExpenseSheet({
    open,
    onOpenChange,
    roleKey,
    userName,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    roleKey: string
    userName: string
}) {
    const t = useTranslations('expenses.sheet')
    const tc = useTranslations('common')
    const tv = useTranslations('validation')
    const money = useMoney()
    const queryClient = useQueryClient()
    const errorMessage = useExpenseErrorMessage()
    const schema = useMemo(() => expenseSchema(tv), [tv])

    const form = useForm<ExpenseValues>({ resolver: zodResolver(schema), defaultValues: emptyValues(roleKey) })

    const categories = useQuery({ queryKey: [expenseCategoriesQueryKey], queryFn: listExpenseCategories, enabled: open })
    const factories = useQuery({ queryKey: [factoriesQueryKey], queryFn: listFactories, enabled: open })
    const shops = useQuery({ queryKey: [suppliersQueryKey, { type: 'shop' }], queryFn: () => listSuppliers({ type: 'shop' }), enabled: open })
    const settings = useQuery({ queryKey: companySettingsKey, queryFn: getCompanySettings })
    const { accounts, munshi } = useAccountBalances(open, t('munshiCash'))

    useEffect(() => {
        if (open) form.reset(emptyValues(roleKey))
    }, [open, roleKey, form])

    const [payMode, accountId, amount, factoryId] = useWatch({ control: form.control, name: ['payMode', 'accountId', 'amount', 'factoryId'] })

    // The first factory of our own is the usual one.
    useEffect(() => {
        const first = factories.data?.find((f) => f.isActive && f.kind === 'own')
        if (open && first && !factoryId) form.setValue('factoryId', first.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, factories.data])

    const payAccounts = [munshi, ...accounts]
    const account = payAccounts.find((a) => a.id === accountId)
    const spending = Number(amount) || 0
    const short = payMode === 'paid' && !!account && account.kind !== 'munshi' && account.balance !== null && spending > account.balance
    const munshiAfter = payMode === 'paid' && account?.kind === 'munshi' && account.balance !== null ? account.balance - spending : null

    const save = useMutation({
        mutationFn: (values: ExpenseValues) => {
            const category = categories.data?.find((c) => c.id === values.categoryId)
            const factory = factories.data?.find((f) => f.id === values.factoryId)
            const shop = shops.data?.find((s) => s.id === values.shopId)
            return createExpense(
                {
                    date: values.date,
                    categoryId: values.categoryId,
                    categoryName: category?.name ?? '',
                    description: values.description,
                    amount: Number(values.amount),
                    factoryId: values.factoryId,
                    factoryName: factory?.name ?? '',
                    payMode: values.payMode,
                    accountId: values.accountId,
                    accountName: payAccounts.find((a) => a.id === values.accountId)?.name ?? '',
                    dueDate: values.dueDate || null,
                    shopId: values.shopId || null,
                    shopName: shop?.name ?? '',
                    photoName: values.photoName || null,
                },
                { pending: roleKey === 'munshi' && (settings.data?.approvalRequired ?? true), by: userName }
            )
        },
        onSuccess: (expense) => {
            toast.success(expense.status === 'pending' ? t('savedPending') : t('saved'))
            onOpenChange(false)
            for (const key of [expensesQueryKey, munshiCashQueryKey, suppliersQueryKey]) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
        },
        onError: (error) => toast.error(errorMessage(error)),
    })

    const summary = short
        ? t('short', { account: account?.name ?? '', amount: money(account?.balance ?? 0) })
        : munshiAfter !== null && munshiAfter < 0
          ? t('ownerOwes', { amount: money(-munshiAfter) })
          : undefined

    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            title={t('title')}
            description={t('description')}
            form={form}
            onSubmit={(values) => save.mutate(values)}
            submitLabel={t('save')}
            cancelLabel={tc('cancel')}
            pending={save.isPending}
            submitDisabled={short}
            summary={summary && <span className={short ? 'text-destructive' : undefined}>{summary}</span>}
        >
            <TileField
                control={form.control}
                name="categoryId"
                label={t('category')}
                options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <TextField control={form.control} name="description" label={t('what')} placeholder={t('whatPlaceholder')} autoComplete="off" />
            <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="amount" label={t('amount')} placeholder={t('amountPlaceholder')} inputMode="numeric" autoComplete="off" />
                <DateField control={form.control} name="date" label={t('date')} placeholder={t('datePlaceholder')} />
            </div>
            <SelectField
                control={form.control}
                name="factoryId"
                label={t('factory')}
                placeholder={t('chooseFactory')}
                options={(factories.data ?? []).filter((f) => f.isActive && f.kind === 'own').map((f) => ({ value: f.id, label: f.name }))}
            />
            <TileField
                control={form.control}
                name="payMode"
                label={t('howPaid')}
                options={payModes.map((m) => ({ value: m, label: t(`payModes.${m}`) }))}
            />
            {payMode === 'paid' && (
                <SelectField
                    control={form.control}
                    name="accountId"
                    label={t('paidFrom')}
                    placeholder={t('chooseAccount')}
                    options={payAccounts.map((a) => ({ value: a.id, label: a.balance === null ? a.name : `${a.name} · ${money(a.balance)}` }))}
                />
            )}
            {payMode === 'unpaid' && (
                <>
                    <DateField control={form.control} name="dueDate" label={t('dueDate')} placeholder={t('datePlaceholder')} />
                    <p className="text-muted-foreground text-sm">{t('unpaidNote')}</p>
                </>
            )}
            {payMode === 'shop_credit' && (
                <>
                    <SelectField
                        control={form.control}
                        name="shopId"
                        label={t('shop')}
                        placeholder={t('chooseShop')}
                        options={(shops.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
                    />
                    <p className="text-muted-foreground text-sm">{t('creditNote')}</p>
                </>
            )}
            <div className="flex flex-col gap-2">
                <Label htmlFor="expense-photo">{t('photo')}</Label>
                <Input id="expense-photo" type="file" accept="image/*" onChange={(e) => form.setValue('photoName', e.target.files?.[0]?.name ?? '')} />
            </div>
        </FormSheet>
    )
}
