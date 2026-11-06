import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import calendar from 'dayjs/plugin/calendar'
import duration from 'dayjs/plugin/duration'
import timezone from 'dayjs/plugin/timezone'
import isBetween from 'dayjs/plugin/isBetween'
import relativeTime from 'dayjs/plugin/relativeTime'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/en'

dayjs.extend(utc)
dayjs.extend(calendar)
dayjs.extend(duration)
dayjs.extend(timezone)
dayjs.extend(isBetween)
dayjs.extend(relativeTime)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(customParseFormat)

export const calendarDate = (date: string | number | Date | Dayjs): string => {
    return dayjs(date).calendar(undefined, {
        sameDay: '[Today,] MMM DD, YYYY [at] h:mm A',
        nextDay: '[Tomorrow,] MMM DD, YYYY [at] h:mm A',
        lastDay: '[Yesterday,] MMM DD, YYYY [at] h:mm A',
        lastWeek: 'dddd[,] MMM DD, YYYY [at] h:mm A',
        sameElse: 'dddd[,] MMM DD, YYYY [at] h:mm A',
    })
}

export const dateDifference = ({
    startDate,
    endDate,
}: {
    startDate?: string | number | Date | Dayjs
    endDate?: string | number | Date | Dayjs
}): string => {
    const start = startDate ? dayjs(startDate) : dayjs()
    const end = endDate ? dayjs(endDate) : dayjs()

    const diffInHours = end.diff(start, 'hour')
    if (diffInHours < 24 && diffInHours > 0) {
        return '1D'
    }

    const years = end.diff(start, 'year')
    let current = start.clone().add(years, 'year')
    const months = end.diff(current, 'month')
    current = current.add(months, 'month')
    const days = end.diff(current, 'day')

    let result = ''
    if (years > 0) {
        result = `${years}Y${months > 0 || days > 0 ? ', ' : ''}`
    }

    if (months > 0) {
        result += `${months}M${days > 0 ? ', ' : ''}`
    }

    if (days > 0) {
        result += `${days}D`
    }

    return result
}

/**
 * Returns the relative time difference.
 * @param date - The date to compare.
 * @param lang - Language code ('en', etc.)
 * @returns Relative time (e.g., "5 minutes ago")
 */
export const timeFromNow = (
    date: string | number | Date | Dayjs,
    lang: string = 'en'
): string => {
    dayjs.locale(lang)
    return dayjs(date).fromNow()
}

export const convertTimeStringToDate = (time?: string | null): Date | null => {
    return time
        ? dayjs.utc(`1970-01-01T${time}`, 'YYYY-MM-DD HH:mm:ss').toDate()
        : null
}

export const format = (
    date: string | number | Date | Dayjs,
    lang: string = 'en'
): string => {
    dayjs.locale(lang)
    return dayjs(date).format('MMM D, YYYY h:mm a')
}

export const dateNow = (): number => {
    return dayjs().valueOf()
}

export default dayjs
