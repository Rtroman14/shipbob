"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { MessageSquare, CheckIcon, XIcon, ShieldAlertIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
    Tool,
    ToolHeader,
    ToolContent,
    ToolInput,
    ToolOutput,
} from "@/components/ai-elements/tool";
import {
    Confirmation,
    ConfirmationRequest,
    ConfirmationAccepted,
    ConfirmationRejected,
    ConfirmationActions,
    ConfirmationAction,
} from "@/components/ai-elements/confirmation";
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputFooter,
    PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClaimEvaluation } from "@/components/claim-evaluation";

const CASE_SUGGESTIONS = [1001, 1002, 1003, 1004, 1005].map(
    (n) => `Evaluate CASE-${n}`
);

function ExecuteDecisionConfirmation({ part, addToolApprovalResponse }) {
    const [dialogOpen, setDialogOpen] = useState(false);

    if (!part.approval) return null;

    const outcome = part.input?.decision_outcome;
    const amount = part.input?.reimbursement?.amount;
    const recipient = part.input?.email?.to;

    return (
        <>
            <Confirmation approval={part.approval} state={part.state}>
                <ConfirmationRequest>
                    <div className="space-y-1">
                        <p className="font-medium">Ready to execute decision</p>
                        <p className="text-sm text-muted-foreground">
                            Outcome: <strong>{outcome}</strong>
                            {amount != null && (
                                <>
                                    {" "}
                                    &middot; Reimbursement: <strong>${amount}</strong>
                                </>
                            )}
                            {recipient && (
                                <>
                                    {" "}
                                    &middot; Email to: <strong>{recipient}</strong>
                                </>
                            )}
                        </p>
                    </div>
                </ConfirmationRequest>
                <ConfirmationAccepted>
                    <CheckIcon className="size-4" />
                    <span>Decision approved and executed</span>
                </ConfirmationAccepted>
                <ConfirmationRejected>
                    <XIcon className="size-4" />
                    <span>Decision execution rejected</span>
                </ConfirmationRejected>
                <ConfirmationActions>
                    <ConfirmationAction
                        variant="outline"
                        onClick={() =>
                            addToolApprovalResponse({
                                id: part.approval.id,
                                approved: false,
                            })
                        }
                    >
                        Reject
                    </ConfirmationAction>
                    <ConfirmationAction variant="default" onClick={() => setDialogOpen(true)}>
                        Approve
                    </ConfirmationAction>
                </ConfirmationActions>
            </Confirmation>

            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <ShieldAlertIcon className="size-5 text-amber-500" />
                        <AlertDialogTitle>Confirm Decision Execution</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will{" "}
                            {outcome === "approve"
                                ? "submit the reimbursement"
                                : "finalize the decision"}
                            {amount != null && (
                                <>
                                    {" "}
                                    of <strong>${amount}</strong>
                                </>
                            )}{" "}
                            and send the email to <strong>{recipient || "the merchant"}</strong>.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                addToolApprovalResponse({
                                    id: part.approval.id,
                                    approved: true,
                                });
                                setDialogOpen(false);
                            }}
                        >
                            Confirm &amp; Send
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function ToolPart({ part }) {
    return (
        <Tool defaultOpen={part.state === "output-available" || part.state === "output-error"}>
            <ToolHeader type={part.type} state={part.state} />
            <ToolContent>
                <ToolInput input={part.input} />
                <ToolOutput
                    output={
                        part.output && typeof part.output === "object" && !part.output.error ? (
                            <MessageResponse>
                                {`\`\`\`json\n${JSON.stringify(part.output, null, 2)}\n\`\`\``}
                            </MessageResponse>
                        ) : (
                            part.output
                        )
                    }
                    errorText={part.errorText || part.output?.error}
                />
            </ToolContent>
        </Tool>
    );
}

export default function Chat() {
    const [input, setInput] = useState("");
    const { messages, setMessages, sendMessage, status, addToolApprovalResponse, stop } = useChat();

    const handleSubmit = (message) => {
        if (message.text.trim()) {
            sendMessage({ text: message.text });
            setInput("");
        }
    };

    const handleSuggestionClick = (suggestion) => {
        sendMessage({ text: suggestion });
        setInput("");
    };

    const suggestionsBusy = status === "streaming" || status === "submitted";

    return (
        <div className="flex h-dvh flex-col bg-background">
            <header className="sticky top-0 z-10 border-b bg-background px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">ShipBob Claims Assistant</h1>
                        <p className="text-sm text-muted-foreground">
                            Enter a Case ID to evaluate a damaged-in-transit claim
                        </p>
                    </div>
                    {messages.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setMessages([]);
                                setInput("");
                            }}
                        >
                            <PlusIcon className="size-4" />
                            New Chat
                        </Button>
                    )}
                </div>
            </header>

            <Conversation className="flex-1">
                <ConversationContent className="mx-auto max-w-3xl">
                    {messages.length === 0 ? (
                        <ConversationEmptyState
                            icon={<MessageSquare className="size-12" />}
                            title="Ready to evaluate claims"
                            description='Try "Evaluate CASE-1001" to get started'
                        />
                    ) : (
                        messages.map((message) => (
                            <Message from={message.role} key={message.id}>
                                <MessageContent>
                                    {message.parts.map((part, i) => {
                                        if (part.type === "text") {
                                            return (
                                                <MessageResponse key={`${message.id}-text-${i}`}>
                                                    {part.text}
                                                </MessageResponse>
                                            );
                                        }

                                        if (part.type === "tool-evaluate_claim") {
                                            return (
                                                <div key={`${message.id}-tool-${i}`}>
                                                    <ToolPart part={part} />
                                                    {part.state === "output-available" && (
                                                        <ClaimEvaluation output={part.output} />
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (part.type === "tool-execute_decision") {
                                            return (
                                                <div key={`${message.id}-tool-${i}`}>
                                                    <ToolPart part={part} />
                                                    <ExecuteDecisionConfirmation
                                                        part={part}
                                                        addToolApprovalResponse={
                                                            addToolApprovalResponse
                                                        }
                                                    />
                                                </div>
                                            );
                                        }

                                        if (part.type?.startsWith("tool-")) {
                                            return (
                                                <ToolPart
                                                    key={`${message.id}-tool-${i}`}
                                                    part={part}
                                                />
                                            );
                                        }

                                        return null;
                                    })}
                                </MessageContent>
                            </Message>
                        ))
                    )}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <div className="border-t bg-background px-4 py-4">
                {messages.length === 0 && (
                    <div className="mx-auto mb-3 max-w-3xl">
                        <Suggestions>
                            {CASE_SUGGESTIONS.map((text) => (
                                <Suggestion
                                    key={text}
                                    suggestion={text}
                                    onClick={handleSuggestionClick}
                                    disabled={suggestionsBusy}
                                />
                            ))}
                        </Suggestions>
                    </div>
                )}
                <PromptInput onSubmit={handleSubmit} className="mx-auto max-w-3xl">
                    <PromptInputTextarea
                        value={input}
                        onChange={(e) => setInput(e.currentTarget.value)}
                        placeholder="Enter a Case ID (e.g., Evaluate CASE-1001)..."
                        className="pr-12"
                    />
                    <PromptInputFooter>
                        <div />
                        <PromptInputSubmit
                            status={
                                status === "streaming"
                                    ? "streaming"
                                    : status === "submitted"
                                      ? "submitted"
                                      : "ready"
                            }
                            onStop={stop}
                            disabled={
                                status !== "ready" && status !== "error" ? false : !input.trim()
                            }
                        />
                    </PromptInputFooter>
                </PromptInput>
            </div>
        </div>
    );
}
