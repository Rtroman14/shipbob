import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { nanoid } from "nanoid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", "data", "db.json");

const readDb = () => {
    const raw = readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
};

const writeDb = (db) => {
    writeFileSync(DB_PATH, JSON.stringify(db, null, 4) + "\n");
};

export const fetchMerchantHistory = async (accountName) => {
    const db = readDb();

    const pastCases = db.case_outcomes
        .filter((r) => r.account_name === accountName)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const notes = db.merchant_notes
        .filter((n) => n.account_name === accountName)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { past_cases: pastCases, notes };
};

export const logCaseOutcome = async ({
    case_id,
    case_number,
    account_name,
    merchant_email,
    system_recommendation,
    final_decision,
    was_overridden,
    override_reason,
    reimbursement_amount,
}) => {
    const db = readDb();

    const record = {
        id: nanoid(),
        case_id,
        case_number: case_number || null,
        account_name,
        merchant_email: merchant_email || null,
        system_recommendation,
        final_decision,
        was_overridden,
        override_reason: override_reason || null,
        reimbursement_amount: reimbursement_amount ?? null,
        created_at: new Date().toISOString(),
    };

    db.case_outcomes.push(record);
    writeDb(db);

    return { saved: true, id: record.id };
};

export const saveMerchantNote = async ({ account_name, note, case_id }) => {
    const db = readDb();

    const record = {
        id: nanoid(),
        account_name,
        note,
        case_id: case_id || null,
        created_at: new Date().toISOString(),
    };

    db.merchant_notes.push(record);
    writeDb(db);

    return { saved: true, id: record.id };
};
