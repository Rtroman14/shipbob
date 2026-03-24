import { tool } from "ai";
import { z } from "zod";
import {
    generatePrompt,
    gatherData,
    checkEligibility,
    checkEvidence,
    analyzeImages,
    makeDecision,
    draftEmail,
} from "@/lib/pipeline.js";
import { createApi } from "@/lib/api.js";
import { logCaseOutcome, saveMerchantNote } from "@/lib/db.js";

const api = createApi(process.env.SHIPBOB_API_BASE_URL);

export const systemPrompt = generatePrompt("prompts/system.md");

export const tools = {
    evaluate_claim: tool({
        description:
            "Evaluate a damaged-in-transit claim by running the full assessment pipeline: data gathering, eligibility check, evidence review, image analysis, decision, and email drafting.",
        inputSchema: z.object({
            case_id: z.string().describe("The case ID to evaluate, e.g. CASE-1001"),
        }),
        execute: async ({ case_id }) => {
            try {
                const { caseData, caseSummary, attachments, shipment, invoice, merchantHistory } =
                    await gatherData(case_id, api);

                const eligibility = checkEligibility(caseData, shipment);

                const attachmentSummaries = attachments.map((a) => ({
                    attachment_id: a.attachment_id,
                    file_name: a.file_name,
                    url: a.url,
                }));

                if (!eligibility.passed) {
                    const decision = {
                        outcome: "deny",
                        reasons: eligibility.failures,
                        reimbursement: null,
                    };
                    const draft_email = await draftEmail(caseData, decision);
                    return {
                        case_summary: caseSummary,
                        merchant_history: merchantHistory,
                        eligibility,
                        evidence_completeness: null,
                        image_analyses: null,
                        attachments: attachmentSummaries,
                        decision,
                        draft_email,
                    };
                }

                const evidence_completeness = checkEvidence(caseData, attachments, invoice);

                if (!evidence_completeness.complete) {
                    const decision = {
                        outcome: "request_info",
                        reasons: evidence_completeness.missing,
                        reimbursement: null,
                    };
                    const draft_email = await draftEmail(caseData, decision);
                    return {
                        case_summary: caseSummary,
                        merchant_history: merchantHistory,
                        eligibility,
                        evidence_completeness,
                        image_analyses: null,
                        attachments: attachmentSummaries,
                        decision,
                        draft_email,
                    };
                }

                const image_analyses = await analyzeImages(
                    attachments,
                    caseData.description,
                    invoice.line_items
                );
                const decision = makeDecision(image_analyses, invoice);
                const draft_email = await draftEmail(caseData, decision);

                return {
                    case_summary: caseSummary,
                    merchant_history: merchantHistory,
                    eligibility,
                    evidence_completeness,
                    image_analyses,
                    attachments: attachmentSummaries,
                    decision,
                    draft_email,
                };
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
                            ? { items: reimbursement_items || [], total: reimbursement_total }
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
            case_number: z.string().describe("The case number, e.g. 01838218"),
            account_name: z.string().describe("The merchant account name"),
            decision_outcome: z.enum(["approve", "deny", "request_info"]),
            system_recommendation: z
                .enum(["approve", "deny", "request_info"])
                .describe("The original recommendation from the evaluation pipeline"),
            override_reason: z
                .string()
                .optional()
                .describe("If the rep overrode the system recommendation, why"),
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
        needsApproval: true,
        execute: async ({
            case_id,
            case_number,
            account_name,
            decision_outcome,
            system_recommendation,
            override_reason,
            reimbursement,
            email,
        }) => {
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

                await logCaseOutcome({
                    case_id,
                    case_number,
                    account_name,
                    merchant_email: email.to,
                    system_recommendation,
                    final_decision: decision_outcome,
                    was_overridden: system_recommendation !== decision_outcome,
                    override_reason: override_reason || null,
                    reimbursement_amount: reimbursement?.amount || null,
                });

                return { reimbursement: reimbursementResult, email: emailResult };
            } catch (error) {
                console.error("Execution error:", error);
                return { error: `Execution failed: ${error.message}` };
            }
        },
    }),

    save_merchant_context: tool({
        description:
            "Save a note or context about a merchant for future reference. Use when a rep provides information that should carry forward to future claims for this merchant.",
        inputSchema: z.object({
            account_name: z.string().describe("The merchant's account name"),
            note: z.string().describe("The context or note to save"),
            case_id: z.string().optional().describe("The related case ID, if applicable"),
        }),
        execute: async ({ account_name, note, case_id }) => {
            try {
                return await saveMerchantNote({ account_name, note, case_id });
            } catch (error) {
                console.error("Save context error:", error);
                return { error: `Failed to save context: ${error.message}` };
            }
        },
    }),
};
