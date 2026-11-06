'use client'

import { Check, Moon, Palette, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { ThemeDot } from '@/components/shared/theme-preview'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { THEME_IDS } from '@/config/themes'
import { useColorTheme } from '@/providers/color-theme-provider'

/** Light/dark mode, plus the colour theme each person can choose for themselves. */
export function ThemeToggle() {
    const t = useTranslations('common')
    const tt = useTranslations('theme')
    const { setTheme } = useTheme()
    const { active, personal, company, setPersonal } = useColorTheme()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('theme')}>
                    <Sun className="dark:hidden" />
                    <Moon className="hidden dark:block" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                    {t('themeLight')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                    {t('themeDark')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                    {t('themeSystem')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Palette />
                        {tt('colorTheme')}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                        {company && (
                            <>
                                <DropdownMenuItem onClick={() => setPersonal(null)}>
                                    <ThemeDot theme={company} />
                                    {tt('companyDefault')}
                                    {personal === null && <Check className="ms-auto size-4" />}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        {THEME_IDS.map((id) => (
                            <DropdownMenuItem key={id} onClick={() => setPersonal(id)}>
                                <ThemeDot theme={id} />
                                {tt(`names.${id}`)}
                                {(company ? personal === id : active === id) && <Check className="ms-auto size-4" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
