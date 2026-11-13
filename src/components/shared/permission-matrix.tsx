'use client'

import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export type PermissionGroup = {
    id: string
    title: string
    items: { id: string; label: string }[]
}

/** One card per module with a checkbox per action and a select-all for the module. Labels come from the caller. */
export function PermissionMatrix({
    groups,
    value,
    onChange,
    disabled,
    selectAllLabel,
}: {
    groups: PermissionGroup[]
    value: string[]
    onChange: (value: string[]) => void
    disabled?: boolean
    selectAllLabel: string
}) {
    const uid = useId()
    const selected = new Set(value)

    const toggle = (ids: string[], on: boolean) => {
        const next = new Set(selected)
        for (const id of ids) {
            if (on) next.add(id)
            else next.delete(id)
        }
        onChange([...next])
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => {
                const ids = group.items.map((item) => item.id)
                const count = ids.filter((id) => selected.has(id)).length
                const all = count === ids.length ? true : count === 0 ? false : 'indeterminate'

                return (
                    <fieldset key={group.id} className="bg-card flex flex-col gap-3 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                            <legend className="text-sm font-medium">{group.title}</legend>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={`${uid}-${group.id}`}
                                    checked={all}
                                    disabled={disabled}
                                    onCheckedChange={(checked) => toggle(ids, checked === true)}
                                />
                                <Label htmlFor={`${uid}-${group.id}`} className="text-muted-foreground text-xs font-normal">
                                    {selectAllLabel}
                                </Label>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            {group.items.map((item) => (
                                <div key={item.id} className="flex items-start gap-2">
                                    <Checkbox
                                        id={`${uid}-${item.id}`}
                                        className="mt-0.5"
                                        checked={selected.has(item.id)}
                                        disabled={disabled}
                                        onCheckedChange={(checked) => toggle([item.id], checked === true)}
                                    />
                                    <Label htmlFor={`${uid}-${item.id}`} className="text-sm leading-snug font-normal">
                                        {item.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </fieldset>
                )
            })}
        </div>
    )
}
