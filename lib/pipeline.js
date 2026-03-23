import { Output, generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { generateInvoice } from "./mock-invoices.js";
import { createOpenAI } from "@ai-sdk/openai";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const generatePrompt = (filePath, variables = {}) => {
    const fullPath = resolve(__dirname, "..", filePath);
    let template = readFileSync(fullPath, "utf-8");
    for (const [key, value] of Object.entries(variables)) {
        template = template.replaceAll(`{{${key}}}`, value);
    }
    return template.trim();
};

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Step 1: Fetch all data needed for a case
export const gatherData = async (case_id, api) => {
    const caseData = await api(`/cases/${case_id}`);

    const [attachmentsRes, shipment, order] = await Promise.all([
        api(`/cases/${case_id}/attachments`),
        api(`/shipments/${caseData.shipment_id}`),
        api(`/orders/${caseData.order_id}`),
    ]);

    const attachments = attachmentsRes.attachments || [];
    const invoice = generateInvoice(caseData.shipment_id, caseData.user_id);

    const caseSummary = {
        case_id: caseData.case_id,
        case_number: caseData.case_number,
        account_name: caseData.account_name,
        contact_email: caseData.contact_email,
        subject: caseData.subject,
        description: caseData.description,
        delivered_date: caseData.delivered_date,
        claim_date: caseData.created_date,
        shipment_id: caseData.shipment_id,
        order_id: caseData.order_id,
        user_id: caseData.user_id,
    };

    return { caseData, caseSummary, attachments, shipment, order, invoice };
};

// Step 2: Eligibility gate
export const checkEligibility = (caseData, shipment) => {
    const failures = [];

    const deliveredDate = new Date(shipment.delivered_date || caseData.delivered_date);
    const createdDate = new Date(caseData.created_date);
    const daysDiff = (createdDate - deliveredDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
        failures.push(
            `Claim filed ${Math.round(daysDiff)} days after delivery — exceeds 30-day window`
        );
    }

    if (shipment.is_insured) {
        failures.push("Shipment is insured — must use insurance claim process");
    }

    if (!caseData.sub_category || !caseData.sub_category.includes("Damaged in Transit")) {
        failures.push(
            `Claim type "${caseData.sub_category || "unknown"}" is not "Damaged in Transit"`
        );
    }

    if (!caseData.shipment_id) failures.push("Missing shipment_id on case");
    if (!caseData.order_id) failures.push("Missing order_id on case");
    if (!caseData.user_id) failures.push("Missing user_id on case");

    return { passed: failures.length === 0, failures };
};

// Step 3: Evidence completeness
export const checkEvidence = (caseData, attachments, invoice) => {
    const missing = [];

    if (!caseData.description || caseData.description.trim() === "") {
        missing.push("No customer report — case description is empty");
    }

    if (!attachments || attachments.length === 0) {
        missing.push("No attachments found — photos of damage and packaging required");
    }

    if (!invoice.line_items || invoice.line_items.length === 0) {
        missing.push("Invoice has no line items — cannot verify product pricing");
    }

    return { complete: missing.length === 0, missing };
};

// Step 4: Analyze images via LLM (parallel calls)
export const analyzeImages = async (attachments, caseDescription, invoiceLineItems) => {
    const prompt = buildImageAnalysisPrompt(caseDescription, invoiceLineItems);

    const results = await Promise.all(
        attachments.map(async (attachment) => {
            const { output } = await generateText({
                model: openai("gpt-5.4"),
                output: Output.object({
                    schema: z.object({
                        classification: z.enum([
                            "product_damage",
                            "outer_packaging",
                            "other",
                            "unclear",
                        ]),
                        damage_visible: z.boolean(),
                        product_identifiable: z.boolean(),
                        matched_invoice_item: z.string().nullable(),
                        confidence: z.enum(["high", "medium", "low"]),
                        reasoning: z.string(),
                    }),
                }),
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image", image: new URL(attachment.url) },
                        ],
                    },
                ],
            });

            return {
                attachment_id: attachment.attachment_id,
                file_name: attachment.file_name,
                ...output,
            };
        })
    );

    return results;
};

// Step 5: Decision logic
export const makeDecision = (imageAnalyses, invoice) => {
    const hasProductDamage = imageAnalyses.some(
        (img) => img.classification === "product_damage" && img.damage_visible
    );
    const hasOuterPackaging = imageAnalyses.some((img) => img.classification === "outer_packaging");

    const matchedItems = imageAnalyses
        .filter((img) => img.product_identifiable && img.matched_invoice_item)
        .map((img) => img.matched_invoice_item);

    const invoiceNames = invoice.line_items.map((item) => item.name);
    const verifiedMatches = matchedItems.filter((name) => invoiceNames.includes(name));

    const reasons = [];
    if (!hasProductDamage) reasons.push("No photo showing visible product damage found");
    if (!hasOuterPackaging) reasons.push("No photo of outer packaging found");
    if (verifiedMatches.length === 0)
        reasons.push("Cannot identify damaged product matching invoice in photos");

    if (reasons.length > 0) {
        return { outcome: "request_info", reasons, reimbursement: null };
    }

    const uniqueMatched = [...new Set(verifiedMatches)];
    const reimbursementItems = uniqueMatched.map((name) => {
        const invoiceItem = invoice.line_items.find((item) => item.name === name);
        const amount = Math.min(invoiceItem.unit_price, 100);
        return { product_name: name, invoice_price: invoiceItem.unit_price, amount };
    });

    const total = Math.min(
        reimbursementItems.reduce((sum, item) => sum + item.amount, 0),
        100
    );

    return {
        outcome: "approve",
        reasons: ["All evidence requirements met"],
        reimbursement: { items: reimbursementItems, total },
    };
};

// Step 6: Draft an email via LLM
export const draftEmail = async (caseData, decision, repInstructions) => {
    const prompt = buildEmailPrompt(caseData, decision, repInstructions);
    const { output } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        output: Output.object({
            schema: z.object({
                subject: z.string().describe("The email subject line"),
                body: z.string().describe("The email body text"),
            }),
        }),
        prompt,
    });
    return { to: caseData.contact_email, subject: output.subject, body: output.body };
};

// ─── Helpers (prompt builders / parsers) ─────────────────────────────────────

export const buildImageAnalysisPrompt = (caseDescription, invoiceLineItems) => {
    const invoiceLineItemsText = invoiceLineItems
        .map((item) => `- ${item.name} (SKU: ${item.sku}, Price: $${item.unit_price})`)
        .join("\n");

    return generatePrompt("prompts/image-analysis.md", {
        caseDescription,
        invoiceLineItems: invoiceLineItemsText,
    });
};

export const buildEmailPrompt = (caseData, decision, repInstructions) => {
    const reimbursementDetails = decision.reimbursement
        ? `Total: $${decision.reimbursement.total}\nItems: ${decision.reimbursement.items.map((i) => `${i.product_name} ($${i.amount})`).join(", ")}`
        : "N/A";

    const repInstructionsText = repInstructions
        ? `Additional instructions from the reviewing rep: ${repInstructions}`
        : "";

    return generatePrompt("prompts/email-draft.md", {
        caseNumber: caseData.case_number,
        accountName: caseData.account_name,
        contactEmail: caseData.contact_email,
        decisionOutcome: decision.outcome,
        decisionReasons: decision.reasons.join(". "),
        reimbursementDetails,
        repInstructions: repInstructionsText,
    });
};
