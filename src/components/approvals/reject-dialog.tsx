'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type RejectDialogLabels = {
    title: string
    description: string
    reason: string
    required: string
    submit: string
    cancel: string
}

/** Asks for the reason a rejection needs; the person who entered it sees this text. */
export function RejectDialog({
    open,
    onOpenChange,
    labels,
    pending,
    onSubmit,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    labels: RejectDialogLabels
    pending?: boolean
    onSubmit: (reason: string) => void
}) {
    const [reason, setReason] = useState('')
    const [touched, setTouched] = useState(false)
    const empty = reason.trim() === ''

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setReason('')
                    setTouched(false)
                }
                onOpenChange(next)
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{labels.title}</DialogTitle>
                    <DialogDescription>{labels.description}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="reject-reason">{labels.reason}</Label>
                    <Textarea
                        id="reject-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-invalid={touched && empty}
                    />
                    {touched && empty && <p className="text-destructive text-sm">{labels.required}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                        {labels.cancel}
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                            setTouched(true)
                            if (!empty) onSubmit(reason.trim())
                        }}
                    >
                        {pending && <Loader2 className="animate-spin" />}
                        {labels.submit}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
