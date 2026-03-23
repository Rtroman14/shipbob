import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
    gatherData,
    checkEligibility,
    checkEvidence,
    analyzeImages,
    makeDecision,
    draftEmail,
} from "@/lib/pipeline.js";

const API_BASE = process.env.SHIPBOB_API_BASE_URL;

const api = async (path, options = {}) => {
    const fetchOptions = { method: options.method || "GET", redirect: "follow" };
    if (options.body) fetchOptions.body = options.body;
    const res = await fetch(`${API_BASE}${path}`, fetchOptions);
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
};

const SYSTEM_PROMPT = `You are a ShipBob claims assistant that helps merchant care reps evaluate damaged-in-transit claims efficiently and accurately.

WORKFLOW:

1. When a rep provides a Case ID, immediately call the evaluate_claim tool with that case_id.

2. After receiving the evaluation results, present them to the rep in this format:

   **Eligibility:** PASSED or FAILED (with reasons)
   **Evidence Review:**
   - Customer report: ✓ or ✗
   - Product damage photo: ✓ or ✗ (with details)
   - Outer packaging photo: ✓ or ✗
   - Invoice verified: ✓ or ✗
   **Image Analysis:** Summarize what was found in each image, referencing filenames.
   **Recommendation:** APPROVE / DENY / REQUEST MORE INFO (with reasoning)
   **Reimbursement:** Amount and product (if approved)

   Then show the draft email in a clearly labeled section.

   Finally, ask: "Would you like to approve and send, request changes to the email, or override the decision?"

3. If the rep requests changes to the email, call the draft_email tool with their instructions. Present the updated draft and ask for approval again.

4. Only call execute_decision after the rep explicitly approves. Look for clear approval language like "approved", "send it", "looks good, send", "go ahead". If ambiguous, ask for confirmation.

RULES:
- Never call execute_decision without explicit rep approval.
- When presenting image analysis, reference specific images by filename so the rep can cross-reference.
- Be concise and professional. Do not editorialize or add opinions about the claim.
- If the evaluation tool returns an error, explain what went wrong and ask the rep how to proceed.
- If eligibility failed, note that evidence review and image analysis were skipped.`;

export async function POST(req) {
    const { messages } = await req.json();

    const result = streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(5),
        tools: {
            evaluate_claim: tool({
                description:
                    "Evaluate a damaged-in-transit claim by running the full assessment pipeline: data gathering, eligibility check, evidence review, image analysis, decision, and email drafting.",
                inputSchema: z.object({
                    case_id: z.string().describe("The case ID to evaluate, e.g. CASE-1001"),
                }),
                execute: async ({ case_id }) => {
                    try {
                        const { caseData, caseSummary, attachments, shipment, invoice } =
                            await gatherData(case_id, api);

                        const eligibility = checkEligibility(caseData, shipment);

                        if (!eligibility.passed) {
                            const decision = {
                                outcome: "deny",
                                reasons: eligibility.failures,
                                reimbursement: null,
                            };
                            const draft_email = await draftEmail(caseData, decision);
                            const evalResult = {
                                case_summary: caseSummary,
                                eligibility,
                                evidence_completeness: null,
                                image_analyses: null,
                                decision,
                                draft_email,
                            };
                            console.log("Evaluation result:", JSON.stringify(evalResult, null, 2));
                            return evalResult;
                        }

                        const evidence_completeness = checkEvidence(caseData, attachments, invoice);

                        if (!evidence_completeness.complete) {
                            const decision = {
                                outcome: "request_info",
                                reasons: evidence_completeness.missing,
                                reimbursement: null,
                            };
                            const draft_email = await draftEmail(caseData, decision);
                            const evalResult = {
                                case_summary: caseSummary,
                                eligibility,
                                evidence_completeness,
                                image_analyses: null,
                                decision,
                                draft_email,
                            };
                            console.log("Evaluation result:", JSON.stringify(evalResult, null, 2));
                            return evalResult;
                        }

                        const image_analyses = await analyzeImages(
                            attachments,
                            caseData.description,
                            invoice.line_items
                        );
                        const decision = makeDecision(image_analyses, invoice);
                        const draft_email = await draftEmail(caseData, decision);

                        const evalResult = {
                            case_summary: caseSummary,
                            eligibility,
                            evidence_completeness,
                            image_analyses,
                            decision,
                            draft_email,
                        };
                        console.log("Evaluation result:", JSON.stringify(evalResult, null, 2));
                        return evalResult;
                    } catch (error) {
                        console.error("Evaluation error:", error);
                        return { error: `Evaluation failed: ${error.message}` };
                    }
                },
            }),

            draft_email: tool({
                description:
                    "Re-draft the merchant email with updated instructions from the rep, without re-running the full evaluation.",
                inputSchema: z.object({
                    case_number: z.string(),
                    account_name: z.string(),
                    contact_email: z.string(),
                    decision_outcome: z.enum(["approve", "deny", "request_info"]),
                    decision_reasons: z.array(z.string()),
                    reimbursement_total: z.number().nullable(),
                    reimbursement_items: z
                        .array(
                            z.object({
                                product_name: z.string(),
                                invoice_price: z.number(),
                                amount: z.number(),
                            })
                        )
                        .nullable(),
                    rep_instructions: z
                        .string()
                        .describe("The rep's instructions for how to change the email"),
                }),
                execute: async ({
                    case_number,
                    account_name,
                    contact_email,
                    decision_outcome,
                    decision_reasons,
                    reimbursement_total,
                    reimbursement_items,
                    rep_instructions,
                }) => {
                    try {
                        const caseData = { case_number, account_name, contact_email };
                        const decision = {
                            outcome: decision_outcome,
                            reasons: decision_reasons,
                            reimbursement:
                                reimbursement_total != null
                                    ? {
                                          items: reimbursement_items || [],
                                          total: reimbursement_total,
                                      }
                                    : null,
                        };
                        return await draftEmail(caseData, decision, rep_instructions);
                    } catch (error) {
                        console.error("Email drafting error:", error);
                        return { error: `Email drafting failed: ${error.message}` };
                    }
                },
            }),

            execute_decision: tool({
                description:
                    "Execute the final decision: submit reimbursement (if approved) and send the email to the merchant. Only call after explicit rep approval.",
                inputSchema: z.object({
                    case_id: z.string(),
                    decision_outcome: z.enum(["approve", "deny", "request_info"]),
                    reimbursement: z
                        .object({
                            order_id: z.string(),
                            user_id: z.string(),
                            shipment_id: z.string(),
                            product_name: z.string(),
                            amount: z.number(),
                        })
                        .nullable(),
                    email: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
                }),
                execute: async ({ case_id, decision_outcome, reimbursement, email }) => {
                    try {
                        let reimbursementResult = null;

                        if (decision_outcome === "approve" && reimbursement) {
                            reimbursementResult = await api("/reimbursements", {
                                method: "POST",
                                body: JSON.stringify({ case_id, ...reimbursement }),
                            });
                        }

                        const emailResult = await api(`/cases/${case_id}/email`, {
                            method: "POST",
                            body: JSON.stringify(email),
                        });

                        const executionResult = {
                            reimbursement: reimbursementResult,
                            email: emailResult,
                        };
                        console.log("Execution result:", JSON.stringify(executionResult, null, 2));
                        return executionResult;
                    } catch (error) {
                        console.error("Execution error:", error);
                        return { error: `Execution failed: ${error.message}` };
                    }
                },
            }),
        },
    });

    return result.toUIMessageStreamResponse();
}
