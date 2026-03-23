const invoices = {
    // CASE-1001: shipment_id 342578703, user_id 334430
    342578703: {
        invoice_id: "INV-342578703",
        shipment_id: "342578703",
        line_items: [
            {
                product_id: "1374243085",
                name: "Additional Collagen Ampoule Duo",
                sku: "AMP1",
                quantity: 1,
                unit_price: 38.0,
            },
            {
                product_id: "1309112104",
                name: "Liposomal Tripeptide Collagen",
                sku: "COLLAGEN1",
                quantity: 1,
                unit_price: 52.0,
            },
        ],
        generated_at: "2026-03-21T10:00:00.000+0000",
    },
    344745459: {
        invoice_id: "INV-344745459",
        shipment_id: "344745459",
        line_items: [
            {
                product_id: "897092060",
                name: "CleanBoss Botanical Disinfectant & Cleaner 24oz 2 Pack",
                sku: "A00360",
                quantity: 1,
                unit_price: 24.99,
            },
            {
                product_id: "897518713",
                name: "CleanBoss Multi Surface Cleaner 24oz",
                sku: "A00300",
                quantity: 2,
                unit_price: 12.99,
            },
            {
                product_id: "1377567317",
                name: "CleanBoss Foaming Cleaning Wipes 70 pack",
                sku: "A00299",
                quantity: 1,
                unit_price: 14.99,
            },
        ],
        generated_at: "2026-03-21T10:00:00.000+0000",
    },
    346106093: {
        invoice_id: "INV-346106093",
        shipment_id: "346106093",
        line_items: [
            {
                product_id: "101786572",
                name: "Bomb Popsicle Wrecked Pre-Workout",
                sku: "0041",
                quantity: 1,
                unit_price: 49.99,
            },
            {
                product_id: "1303441538",
                name: "Blue Razz Liquid Carnitine",
                sku: "0199",
                quantity: 1,
                unit_price: 34.99,
            },
            {
                product_id: "101786630",
                name: "Red/Black HUGE Shaker",
                sku: "0157",
                quantity: 1,
                unit_price: 12.99,
            },
            {
                product_id: "101786566",
                name: "2.5LBS White Chocolate Raspberry Huge Whey",
                sku: "0159",
                quantity: 1,
                unit_price: 59.99,
            },
            {
                product_id: "196409482",
                name: "Green Apple Wrecked Core Sample",
                sku: "0180",
                quantity: 1,
                unit_price: 9.99,
            },
            {
                product_id: "136125958",
                name: "Unflavored Liquid Glycerol",
                sku: "0179",
                quantity: 1,
                unit_price: 27.99,
            },
        ],
        generated_at: "2026-03-21T10:00:00.000+0000",
    },
    330936165: {
        invoice_id: "INV-330936165",
        shipment_id: "330936165",
        line_items: [
            {
                product_id: "897531023",
                name: "Organic Castor Oil Roll-on with Frankincense",
                sku: "HG-FRCAST-KITTEDROLL",
                quantity: 1,
                unit_price: 24.99,
            },
        ],
        generated_at: "2026-03-21T10:00:00.000+0000",
    },
    349164073: {
        invoice_id: "INV-349164073",
        shipment_id: "349164073",
        line_items: [
            {
                product_id: "1130664154",
                name: "30-day Pouch LOAM Prebiotic Fiber Formula",
                sku: "LOAM-30DAY-001",
                quantity: 1,
                unit_price: 45.0,
            },
            {
                product_id: "1374224271",
                name: "Insert Card",
                sku: "Health Grows Here - Insert",
                quantity: 1,
                unit_price: 0.0,
            },
        ],
        generated_at: "2026-03-21T10:00:00.000+0000",
    },
};

export const generateInvoice = (shipment_id, user_id) => {
    const invoice = invoices[shipment_id];
    if (!invoice) {
        return {
            error: "invoice_unavailable",
            message: "No invoice could be generated for this shipment.",
        };
    }
    return invoice;
};
