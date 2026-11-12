'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from './date-picker'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

type BaseProps<T extends FieldValues> = {
    control: Control<T>
    name: FieldPath<T>
    label: string
    className?: string
}

export function TextField<T extends FieldValues>({
    control,
    name,
    label,
    className,
    ...inputProps
}: BaseProps<T> &
    Omit<ComponentProps<typeof Input>, 'name' | 'defaultValue' | 'value'>) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <Input placeholder={label} {...inputProps} {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export function PasswordField<T extends FieldValues>({
    control,
    name,
    label,
    placeholder,
    showLabel,
    hideLabel,
    labelAside,
    className,
}: BaseProps<T> & {
    placeholder?: string
    showLabel: string
    hideLabel: string
    labelAside?: React.ReactNode
}) {
    const [visible, setVisible] = useState(false)

    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                    <div className="flex items-center justify-between gap-2">
                        <FormLabel>{label}</FormLabel>
                        {labelAside}
                    </div>
                    <div className="relative">
                        <FormControl>
                            <Input
                                {...field}
                                type={visible ? 'text' : 'password'}
                                placeholder={placeholder}
                                className="pe-10"
                                autoComplete="off"
                            />
                        </FormControl>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute inset-y-0 end-0 size-9"
                            onClick={() => setVisible((v) => !v)}
                            aria-label={visible ? hideLabel : showLabel}
                        >
                            {visible ? <EyeOff /> : <Eye />}
                        </Button>
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export function TextareaField<T extends FieldValues>({
    control,
    name,
    label,
    className,
    ...props
}: BaseProps<T> &
    Omit<ComponentProps<typeof Textarea>, 'name' | 'defaultValue' | 'value'>) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <Textarea placeholder={label} {...props} {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export function DateField<T extends FieldValues>({
    control,
    name,
    label,
    placeholder,
    className,
}: BaseProps<T> & { placeholder: string }) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field, fieldState }) => (
                <FormItem className={className}>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder={placeholder}
                            invalid={!!fieldState.error}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export function SelectField<T extends FieldValues>({
    control,
    name,
    label,
    options,
    placeholder,
    className,
}: BaseProps<T> & {
    options: { value: string; label: string }[]
    placeholder?: string
}) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                    <FormLabel>{label}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={placeholder ?? label} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {options.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
