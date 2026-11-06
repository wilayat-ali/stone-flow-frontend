const lakh = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

/** Lakh grouping (1,25,000) with Western digits, in every locale. */
export const formatLakh = (amount: number) => lakh.format(amount)

const pad = (n: number) => String(n).padStart(2, '0')

/** A date as `YYYY-MM-DD` in the user's time zone, for forms and the API. */
export const toIsoDate = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** `YYYY-MM-DD` as a local date, or `undefined` when empty. */
export const fromIsoDate = (value: string) => (value ? new Date(`${value}T00:00:00`) : undefined)

export const todayIso = () => toIsoDate(new Date())
