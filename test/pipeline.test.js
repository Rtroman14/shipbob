import {
    gatherData,
    checkEligibility,
    checkEvidence,
    analyzeImages,
    makeDecision,
    draftEmail,
} from "../lib/pipeline.js";

const API_BASE = "https://e41238c7-aefe-4d20-8866-747c74eac48f.mock.pstmn.io";

const api = async (path, options = {}) => {
    const fetchOptions = { method: options.method || "GET", redirect: "follow" };
    if (options.body) fetchOptions.body = options.body;
    const res = await fetch(`${API_BASE}${path}`, fetchOptions);
    if (!res.ok) throw new Error(`API ${fetchOptions.method} ${path}: ${res.status}`);
    return res.json();
};

const evaluateClaim = async (case_id) => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`EVALUATING: ${case_id}`);
    console.log("=".repeat(70));

    // Step 1: Data gathering
    console.log("\n--- Step 1: Data Gathering ---");
    const { caseData, caseSummary, attachments, shipment, invoice } = await gatherData(
        case_id,
        api
    );
    console.log(`  Case: ${caseData.case_number} - ${caseData.account_name}`);
    console.log(`  Attachments: ${attachments.length}`);
    console.log(`  Shipment: ${shipment.shipment_id} (insured: ${shipment.is_insured})`);
    console.log(`  Invoice items: ${invoice.line_items.length}`);

    // Step 2: Eligibility gate
    console.log("\n--- Step 2: Eligibility Gate ---");
    const eligibility = checkEligibility(caseData, shipment);
    console.log(`  Passed: ${eligibility.passed}`);
    if (!eligibility.passed) {
        console.log(`  Failures: ${eligibility.failures.join("; ")}`);

        const decision = { outcome: "deny", reasons: eligibility.failures, reimbursement: null };
        console.log("\n--- Step 6: Draft Email (deny) ---");
        const email = await draftEmail(caseData, decision);
        console.log(`  Subject: ${email.subject}`);
        console.log(`  Body:\n${email.body}`);

        return {
            case_summary: caseSummary,
            eligibility,
            evidence_completeness: null,
            image_analyses: null,
            decision,
            draft_email: email,
        };
    }

    // Step 3: Evidence completeness
    console.log("\n--- Step 3: Evidence Completeness ---");
    const evidence = checkEvidence(caseData, attachments, invoice);
    console.log(`  Complete: ${evidence.complete}`);
    if (!evidence.complete) {
        console.log(`  Missing: ${evidence.missing.join("; ")}`);

        const decision = {
            outcome: "request_info",
            reasons: evidence.missing,
            reimbursement: null,
        };
        console.log("\n--- Step 6: Draft Email (request_info) ---");
        const email = await draftEmail(caseData, decision);
        console.log(`  Subject: ${email.subject}`);
        console.log(`  Body:\n${email.body}`);

        return {
            case_summary: caseSummary,
            eligibility,
            evidence_completeness: evidence,
            image_analyses: null,
            decision,
            draft_email: email,
        };
    }

    // Step 4: Image analysis
    console.log("\n--- Step 4: Image Analysis ---");
    const imageAnalyses = await analyzeImages(
        attachments,
        caseData.description,
        invoice.line_items
    );

    // Step 5: Decision logic
    console.log("\n--- Step 5: Decision Logic ---");
    const decision = makeDecision(imageAnalyses, invoice);
    console.log(`  Outcome: ${decision.outcome}`);
    console.log(`  Reasons: ${decision.reasons.join("; ")}`);
    if (decision.reimbursement) {
        console.log(`  Reimbursement: $${decision.reimbursement.total}`);
        for (const item of decision.reimbursement.items) {
            console.log(
                `    - ${item.product_name}: $${item.amount} (invoice: $${item.invoice_price})`
            );
        }
    }

    // Step 6: Draft email
    console.log("\n--- Step 6: Draft Email ---");
    const email = await draftEmail(caseData, decision);
    console.log(`  To: ${email.to}`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  Body:\n${email.body}`);

    return {
        case_summary: caseSummary,
        eligibility,
        evidence_completeness: evidence,
        image_analyses: imageAnalyses,
        decision,
        draft_email: email,
    };
};

const main = async () => {
    console.log("Fetching cases from API...");
    const { cases } = await api("/cases");
    console.log(`Found ${cases.length} case(s): ${cases.map((c) => c.case_id).join(", ")}\n`);

    const results = [];
    for (const { case_id } of cases) {
        try {
            const result = await evaluateClaim(case_id);
            results.push(result);
        } catch (error) {
            console.error(`\nERROR processing ${case_id}:`, error.message);
            results.push({ case_id, error: error.message });
        }
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log("SUMMARY");
    console.log("=".repeat(70));
    for (const r of results) {
        if (r.error) {
            console.log(`  ${r.case_id}: ERROR - ${r.error}`);
        } else {
            const id = r.case_summary.case_id;
            const outcome = r.decision.outcome;
            const amount = r.decision.reimbursement ? `$${r.decision.reimbursement.total}` : "N/A";
            console.log(`  ${id}: ${outcome.toUpperCase()} | reimbursement: ${amount}`);
        }
    }
};

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
