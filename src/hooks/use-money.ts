import { useTranslations } from 'next-intl'
import { formatLakh } from '@/lib/format'

/** Formats PKR amounts in lakh grouping, e.g. `PKR 1,25,000`. */
export function useMoney() {
    const t = useTranslations('common')
    return (amount: number) => `${t('currency')} ${formatLakh(amount)}`
}
