"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircleIcon,
    AlertTriangleIcon,
    ImageIcon,
    XIcon,
    ZoomInIcon,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";

const classificationLabels = {
    product_damage: "Product Damage",
    outer_packaging: "Outer Packaging",
    other: "Other",
    unclear: "Unclear",
};

const classificationColors = {
    product_damage: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400",
    outer_packaging: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
    other: "text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400",
    unclear: "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400",
};

function Lightbox({ url, fileName, onClose }) {
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
        >
            <button
                type="button"
                className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                onClick={onClose}
            >
                <XIcon className="size-6" />
            </button>
            <img
                src={url}
                alt={fileName}
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
            />
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white">
                {fileName}
            </span>
        </div>
    );
}

function ImageCard({ analysis, url, onExpand }) {
    return (
        <div className="overflow-hidden rounded-lg border">
            {url && (
                <button
                    type="button"
                    className="group/thumb relative w-full cursor-pointer"
                    onClick={() => onExpand(url, analysis.file_name)}
                >
                    <img
                        src={url}
                        alt={analysis.file_name}
                        className="max-h-48 w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/thumb:bg-black/30">
                        <ZoomInIcon className="size-8 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100" />
                    </div>
                </button>
            )}
            <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{analysis.file_name}</span>
                    <div className="flex gap-1">
                        {analysis.classification.map((cls) => (
                            <Badge
                                key={cls}
                                variant="secondary"
                                className={cn("shrink-0 text-xs", classificationColors[cls])}
                            >
                                {classificationLabels[cls]}
                            </Badge>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                    {analysis.damage_visible && (
                        <Badge variant="outline" className="gap-1 text-red-600 dark:text-red-400">
                            <AlertTriangleIcon className="size-3" />
                            Damage visible
                        </Badge>
                    )}
                    {analysis.product_identifiable && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "gap-1",
                                analysis.classification.includes("product_damage")
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-muted-foreground"
                            )}
                        >
                            <CheckCircleIcon className="size-3" />
                            {analysis.classification.includes("product_damage")
                                ? "Product visible"
                                : "Product name matched"}
                        </Badge>
                    )}
                    {analysis.matched_invoice_item && (
                        <Badge variant="outline" className="gap-1">
                            Matched: {analysis.matched_invoice_item}
                        </Badge>
                    )}
                    <Badge variant="outline" className="gap-1 capitalize">
                        {analysis.confidence} confidence
                    </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    {analysis.reasoning}
                </p>
            </div>
        </div>
    );
}

export function ClaimEvaluation({ output }) {
    const [lightbox, setLightbox] = useState(null);

    const openLightbox = useCallback((url, fileName) => {
        setLightbox({ url, fileName });
    }, []);

    const closeLightbox = useCallback(() => {
        setLightbox(null);
    }, []);

    if (!output || output.error) return null;

    const { image_analyses, attachments } = output;

    const urlMap = {};
    if (attachments) {
        for (const a of attachments) {
            urlMap[a.attachment_id] = a.url;
            urlMap[a.file_name] = a.url;
        }
    }

    if (!image_analyses || image_analyses.length === 0) return null;

    return (
        <>
            <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="size-4 text-muted-foreground" />
                    Evidence Photos ({image_analyses.length})
                </div>
                <p className="text-xs text-muted-foreground">
                    Click any photo to view full size.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {image_analyses.map((analysis) => (
                        <ImageCard
                            key={analysis.attachment_id || analysis.file_name}
                            analysis={analysis}
                            url={urlMap[analysis.attachment_id] || urlMap[analysis.file_name]}
                            onExpand={openLightbox}
                        />
                    ))}
                </div>
            </div>
            {lightbox && (
                <Lightbox
                    url={lightbox.url}
                    fileName={lightbox.fileName}
                    onClose={closeLightbox}
                />
            )}
        </>
    );
}
