# Project Bills Labs

Upload invoices to **Zoho Books Expenses** with AI-powered data extraction — for **PROJECTX LABS**.

Drop an invoice (image or PDF) → OpenAI Vision extracts all fields → review & edit → one-click upload to Zoho Books.

## Setup

```bash
git clone <repo-url> && cd project-bills-labs
npm install
cp .env.example .env   # fill in your credentials
npm run dev             # http://localhost:3001
```

### Environment Variables

| Variable | Description |
|---|---|
| `ZOHO_CLIENT_ID` | Zoho OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth client secret |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth refresh token |
| `ZOHO_ORG_ID` | Zoho Books organization ID |
| `ZOHO_DOMAIN` | `.in`, `.com`, `.eu`, etc. |
| `OPENAI_API_KEY` | OpenAI API key |
| `COMPANY_NAME` | Your company name (used in AI prompt) |
| `COMPANY_STATE` | Your state (for GST type auto-detection) |
| `PAID_THROUGH_ACCOUNT_NAME` | Default bank/cash account name |

### Zoho API Setup

1. [Zoho API Console](https://api-console.zoho.in/) → Create Self Client
2. Generate code with scope `ZohoBooks.fullaccess.all`
3. Exchange for refresh token
4. Note Org ID from Zoho Books → Settings → Organization Profile

## Deploy to Render

1. Push to GitHub
2. New **Web Service** on [Render](https://render.com)
3. Build: `npm install` · Start: `npm start`
4. Add env vars in Render settings

## License

MIT
