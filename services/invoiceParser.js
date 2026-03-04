const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COMPANY = process.env.COMPANY_NAME || 'Our Company';
const STATE = process.env.COMPANY_STATE || 'Karnataka';

function buildPrompt() {
    return `You extract structured data from Indian invoices. Our company is ${COMPANY}, ${STATE}. Return ONLY valid JSON.

JSON schema:
{
  "vendor_name": "seller name (not our company)",
  "vendor_gstin": "GSTIN or null",
  "invoice_number": "string",
  "invoice_date": "YYYY-MM-DD",
  "vendor_state": "state name",
  "gst_type": "inter_state if vendor outside ${STATE}, else intra_state",
  "tax_treatment": "exclusive if tax added on top of subtotal, inclusive if prices include tax",
  "reverse_charge": false,
  "sub_total": 0,
  "tax_amount": 0,
  "total_amount": 0,
  "line_items": [
    { "description": "exact text from invoice", "amount": 0, "gst_rate": 0 }
  ]
}

Rules:
- gst_rate per item = TOTAL GST (e.g. CGST 9% + SGST 9% = 18)
- Transcribe descriptions EXACTLY as printed. Do not guess or substitute.
- Every table row = one line_items entry. Do not skip or merge rows.`;
}

async function parseInvoiceImage(filePath) {
    const buf = fs.readFileSync(filePath);
    const ext = filePath.toLowerCase().split('.').pop();
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || 'image/jpeg';

    const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: buildPrompt() },
            {
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}`, detail: 'high' } },
                    { type: 'text', text: 'Extract invoice data. List every line item row — do not skip any.' },
                ],
            },
        ],
        max_tokens: 4096,
        temperature: 0,
    });

    return extractJSON(res.choices[0].message.content);
}

async function parseInvoicePDF(filePath) {
    const buf = fs.readFileSync(filePath);
    const pdf = await pdfParse(buf);
    if (!pdf.text || pdf.text.trim().length < 20) {
        throw new Error('PDF has no extractable text. Upload an image instead.');
    }

    const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: buildPrompt() },
            { role: 'user', content: `Extract invoice data from this text:\n\n${pdf.text}` },
        ],
        max_tokens: 4096,
        temperature: 0,
    });

    return extractJSON(res.choices[0].message.content);
}

async function parseInvoice(filePath) {
    return path.extname(filePath).toLowerCase() === '.pdf'
        ? parseInvoicePDF(filePath)
        : parseInvoiceImage(filePath);
}

function extractJSON(text) {
    const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(cleaned); } catch { }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch { }
    }
    throw new Error('Could not parse AI response as JSON');
}

module.exports = { parseInvoice };
