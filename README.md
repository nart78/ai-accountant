# AI-Powered Accountant

An intelligent accounting system for Canadian businesses that uses AI to automate bookkeeping, document processing, tax compliance, and financial reporting.

## Features

- 🤖 **AI Document Processing**: Automatically categorizes receipts, invoices, and financial documents
- 📊 **Financial Reporting**: Generate P&L statements, balance sheets, and cash flow reports
- 🇨🇦 **Canadian Tax Compliance**: GST/HST tracking, filing reminders, and CRA compliance
- 💰 **Tax Optimization**: AI-powered analysis to minimize tax burden legally
- 👥 **Payroll Management**: Canadian payroll processing with T4 generation
- 🔔 **Smart Reminders**: Never miss GST filing or tax deadlines

## Tech Stack

### Backend
- Python 3.11+ with FastAPI
- PostgreSQL for data storage
- Claude AI for document understanding
- OCR for image processing

### Frontend
- React 18 with TypeScript
- Tailwind CSS
- Vite for build tooling

### Integrations
- Wave API / QuickBooks Online (accounting)
- Anthropic Claude API (AI processing)
- Canadian tax and payroll APIs

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Anthropic API key

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Using Docker

```bash
docker-compose up
```

## Environment Variables

See `.env.example` for required configuration:
- `ANTHROPIC_API_KEY`: Your Claude API key
- `DATABASE_URL`: PostgreSQL connection string
- `WAVE_API_KEY`: Wave accounting API key (optional)

## Project Structure

```
ai-accountant/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── services/ # Business logic & AI processing
│   │   ├── models/   # Database models
│   │   └── db/       # Database utilities
├── frontend/         # React frontend
│   └── src/
│       ├── components/
│       └── pages/
└── uploads/          # Document storage
```

## Security & Compliance

- All financial data encrypted at rest and in transit
- Immutable audit logs for CRA compliance
- Human review option for high-value transactions
- Regular security updates for tax code changes

## Cost Estimate

- Hosting: $20-50/month
- Claude API: $50-200/month (volume-based)
- Accounting API: $0-30/month
- **Total: ~$90-280/month** (vs. $300-1000+/month for traditional accountant)

## Important Note

This system assists with accounting and provides intelligent automation. For initial setup and important filings, consultation with a licensed CPA is recommended to ensure compliance with CRA regulations.

## License

MIT
