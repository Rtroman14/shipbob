"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon, StickyNoteIcon } from "lucide-react";

export function MerchantContextSaved({ input }) {
    if (!input) return null;

    return (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircleIcon className="size-4" />
                Context saved for {input.account_name}
            </div>
            <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <StickyNoteIcon className="mt-0.5 size-3.5 shrink-0" />
                <p>{input.note}</p>
            </div>
            {input.case_id && (
                <div className="mt-2">
                    <Badge variant="outline" className="text-xs">
                        {input.case_id}
                    </Badge>
                </div>
            )}
        </div>
    );
}
