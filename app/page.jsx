"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";

export default function Chat() {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);
    const { messages, sendMessage, status } = useChat();

    const isLoading = status === "streaming" || status === "submitted";

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
            <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    ShipBob Claims Assistant
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Enter a Case ID to evaluate a damaged-in-transit claim
                </p>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto max-w-3xl space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="mb-4 rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
                                <svg
                                    className="h-8 w-8 text-zinc-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                                Ready to evaluate claims
                            </h2>
                            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                                Try &quot;Evaluate CASE-1001&quot; to get started
                            </p>
                        </div>
                    )}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                    message.role === "user"
                                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                        : "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
                                }`}
                            >
                                {message.parts.map((part, i) => {
                                    if (part.type === "text") {
                                        return (
                                            <div
                                                key={`${message.id}-${i}`}
                                                className="whitespace-pre-wrap text-sm leading-relaxed"
                                            >
                                                {part.text}
                                            </div>
                                        );
                                    }

                                    if (part.type.startsWith("tool-")) {
                                        const toolName = part.type.replace("tool-", "");
                                        const state = part.state;

                                        if (state === "call") {
                                            return (
                                                <div
                                                    key={`${message.id}-${i}`}
                                                    className="my-2 flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                                >
                                                    <svg
                                                        className="h-3 w-3 animate-spin"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        />
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                        />
                                                    </svg>
                                                    Running {toolName.replace(/_/g, " ")}...
                                                </div>
                                            );
                                        }

                                        if (state === "result") {
                                            return (
                                                <div
                                                    key={`${message.id}-${i}`}
                                                    className="my-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                                >
                                                    <svg
                                                        className="h-3 w-3"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        strokeWidth={2}
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M4.5 12.75l6 6 9-13.5"
                                                        />
                                                    </svg>
                                                    {toolName.replace(/_/g, " ")} completed
                                                </div>
                                            );
                                        }
                                    }

                                    return null;
                                })}
                            </div>
                        </div>
                    ))}

                    {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                                <div className="flex items-center gap-1">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </main>

            <footer className="sticky bottom-0 border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!input.trim() || isLoading) return;
                        sendMessage({ text: input });
                        setInput("");
                    }}
                    className="mx-auto flex max-w-3xl gap-3"
                >
                    <input
                        className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Enter a Case ID (e.g., Evaluate CASE-1001)..."
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                        Send
                    </button>
                </form>
            </footer>
        </div>
    );
}
