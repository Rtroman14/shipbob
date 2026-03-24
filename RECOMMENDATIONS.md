# Production Recommendations

Deferred improvements identified during the initial architecture review. These are not bugs — they are enhancements that would improve robustness and capability in a production deployment.

---

## 1. Re-draft Tool Data Integrity

**Problem:** The `draft_email` tool requires the LLM to reconstruct case and decision fields (case number, account name, contact email, decision outcome, reasons, reimbursement details) from conversation context each time the rep requests a re-draft. If the model drops or halluccinates a field, the re-drafted email could silently use wrong data.

**Recommended approach:**

- Store evaluation results in a session-scoped cache keyed by `case_id`. This could be an in-memory `Map` held in the route handler's closure for a simple implementation, or Redis/similar for a multi-instance deployment.
- Simplify the `draft_email` tool's input schema to accept only `case_id` and `rep_instructions`.
- Internally, the tool looks up the cached evaluation to retrieve case data and decision fields, guaranteeing data consistency regardless of what the LLM passes.
- This eliminates the risk of hallucinated field values during re-drafts and reduces the LLM's burden (fewer parameters to extract from context).

**Complexity:** Low-medium. The main consideration is cache lifetime — it should persist for the duration of the chat session and be cleaned up afterward.

---

## 2. Cross-Session Context Persistence

**Problem:** The problem document states: *"The system should make it easy for that context — and for the rep's corrections — to carry forward. Not just on this case. On the next one too."* Currently, rep corrections and overrides are lost when a chat session ends. A rep who overrides a decision for a specific merchant today will see no trace of that context tomorrow.

**Recommended approach:**

- Add a database table (e.g., a Supabase table) for rep feedback, keyed by merchant/account ID. Each record stores:
  - The case ID and case number
  - What the system recommended vs. what the rep decided
  - Any notes or reasoning the rep provided
  - Timestamp
- During `gatherData`, query this table for the merchant and include any prior feedback history in the evaluation results.
- During `execute_decision`, if the rep overrode the system's recommendation, automatically persist a record of the override.
- Update the system prompt to instruct the LLM to reference this history when presenting results (e.g., *"Note: Rep previously approved a claim for this merchant on CASE-1003 that the system recommended denying — the rep noted the merchant had provided additional context via email."*).

**Complexity:** Medium. This is essentially a lightweight CRM layer on top of the claim pipeline. The data model is simple, but the UX of surfacing historical context without overwhelming the rep requires careful prompt design and potentially a dedicated UI section.
