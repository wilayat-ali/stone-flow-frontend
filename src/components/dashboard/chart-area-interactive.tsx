'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { useFormatter, useTranslations } from 'next-intl'
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
    REFERENCE_DATE,
    rangeDays,
    visitors,
    type DashboardRange,
} from '@/features/dashboard/data'
import { useIsMobile } from '@/hooks/use-mobile'

const RANGES: DashboardRange[] = ['90d', '30d', '7d']

/** The dashboard-01 "Total Visitors" card: gradient area chart with a range switch. */
export function ChartAreaInteractive() {
    const t = useTranslations('dashboard')
    const format = useFormatter()
    const isMobile = useIsMobile()
    const [chosen, setChosen] = useState<DashboardRange | null>(null)
    const range = chosen ?? (isMobile ? '7d' : '90d')

    const data = useMemo(() => {
        const start = new Date(REFERENCE_DATE)
        start.setDate(start.getDate() - rangeDays[range])
        return visitors.filter((item) => new Date(item.date) >= start)
    }, [range])

    const formatDay = (value: string) =>
        format.dateTime(new Date(value), {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        })

    const config = {
        visitors: { label: t('visitors.title') },
        desktop: { label: t('visitors.desktop'), color: 'var(--primary)' },
        mobile: { label: t('visitors.mobile'), color: 'var(--primary)' },
    } satisfies ChartConfig

    return (
        <Card className="@container/card">
            <CardHeader>
                <CardTitle>{t('visitors.title')}</CardTitle>
                <CardDescription>
                    <span className="hidden @[540px]/card:block">
                        {t('visitors.description', {
                            range: t(`rangeSentence.${range}`),
                        })}
                    </span>
                    <span className="@[540px]/card:hidden">
                        {t(`ranges.${range}`)}
                    </span>
                </CardDescription>
                <CardAction>
                    <ToggleGroup
                        type="single"
                        value={range}
                        onValueChange={(value) =>
                            value && setChosen(value as DashboardRange)
                        }
                        variant="outline"
                        className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
                    >
                        {RANGES.map((value) => (
                            <ToggleGroupItem key={value} value={value}>
                                {t(`ranges.${value}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <Select
                        value={range}
                        onValueChange={(value) =>
                            setChosen(value as DashboardRange)
                        }
                    >
                        <SelectTrigger
                            className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                            size="sm"
                            aria-label={t('visitors.select')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {RANGES.map((value) => (
                                <SelectItem
                                    key={value}
                                    value={value}
                                    className="rounded-lg"
                                >
                                    {t(`ranges.${value}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardAction>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                {/* Time axis stays left-to-right in every locale */}
                <div dir="ltr">
                    <ChartContainer
                        config={config}
                        className="aspect-auto h-[250px] w-full"
                    >
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient
                                    id="fillDesktop"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-desktop)"
                                        stopOpacity={1.0}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-desktop)"
                                        stopOpacity={0.1}
                                    />
                                </linearGradient>
                                <linearGradient
                                    id="fillMobile"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-mobile)"
                                        stopOpacity={0.8}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-mobile)"
                                        stopOpacity={0.1}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                minTickGap={32}
                                tickFormatter={formatDay}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        labelFormatter={(value) =>
                                            formatDay(String(value))
                                        }
                                        indicator="dot"
                                    />
                                }
                            />
                            <Area
                                dataKey="mobile"
                                type="natural"
                                fill="url(#fillMobile)"
                                stroke="var(--color-mobile)"
                                stackId="a"
                            />
                            <Area
                                dataKey="desktop"
                                type="natural"
                                fill="url(#fillDesktop)"
                                stroke="var(--color-desktop)"
                                stackId="a"
                            />
                        </AreaChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    )
}
