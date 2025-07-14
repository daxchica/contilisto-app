# 📊 Contilisto – AI-Powered Accounting SaaS

**Contilisto** is a modern SaaS platform designed to simplify accounting workflows for accountants, SMEs, and bookkeepers in Ecuador and Latin America. It integrates AI-powered PDF invoice parsing (via OpenAI), structured ledger logic based on Ecuadorian accounting standards (PUC), and real-time financial reporting.

---

## 🧠 Key Features

- 📎 Smart PDF invoice parsing (OCR + GPT-based logic)
- 🧾 Automated journal entry generation
- 📂 Multi-entity support per user
- 📊 Real-time P&L and Balance Sheet
- 🔐 Firebase authentication (email/password)
- 🌎 Bilingual support (Spanish & English)
- ⚙️ Modular backend/frontend architecture for scalability

---

## 🧱 Project Structure

contilisto-app/
├── backend/              ← FastAPI backend for PDF parsing, GPT calls, and business logic
│   ├── models/           ← Ledger and entry schemas
│   ├── services/         ← GPT and PDF utilities
│   └── main.py           ← Entry point for backend
├── src/                  ← React + Vite frontend (TypeScript + Tailwind CSS)
│   ├── components/       ← Reusable UI components
│   ├── pages/            ← Route-level React components
│   └── utils/            ← Helpers: mapping, Firestore, invoice logic
├── public/               ← Static assets
├── .env.example          ← Sample environment configuration
├── run.sh                ← Helper script for running both backend/frontend
├── package.json          ← Frontend dependencies and scripts
├── requirements.txt      ← Backend dependencies (Python)

---

## 🧪 Development Roadmap

### ✅ Phase 1: User & Entity System
- [x] Firebase email/password login
- [x] Multi-entity support
- [x] Entity selection and context

### 🔄 Phase 2: PDF Upload & Parsing
- [x] Drag-and-drop file upload
- [x] Extract text via PyMuPDF
- [x] Preview and summary display
- [x] Duplicate prevention (Firestore + LocalStorage)

### 🔄 Phase 3: OpenAI Integration
- [x] Optimized GPT prompts for accounting
- [x] Extract RUC, subtotal, VAT, total
- [x] Automatic classification (income vs. expenses)
- [x] Ledger logic based on Ecuador's PUC

### 🔄 Phase 4: Journal Entries
- [x] Journal preview and editing
- [x] Save entries to Firestore
- [x] Initial balance panel (manual & PDF)

### 🔄 Phase 5: Financial Reporting
- [x] Profit & Loss (P&L)
- [x] Balance Sheet
- [ ] Accounts Payable / Receivable Report
- [ ] Bank reconciliation

### ⬜ Phase 6: Production Readiness
- [ ] Deploy frontend (Netlify or Vercel)
- [ ] Deploy backend (Render or Fly.io)
- [ ] PostgreSQL integration for structured data
- [ ] Backup and recovery strategies

---

## ⚙️ Local Setup

### 🔧 Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

### 🌐 Frontend (React + Vite + Tailwind)
cd contilisto-app
npm install
npm run dev

---

###🔐 Environment Variables
cp .env.example .env

You’ll need to add:
	•	VITE_FIREBASE_API_KEY
	•	OPENAI_API_KEY
	•	FIREBASE_PROJECT_ID
	•	FIRESTORE_COLLECTIONS
	•	Any other Firebase or backend-specific config

Note: .env files should never be committed to Git.

### 🛡️ Security & Secrets

⚠️ All sensitive files (API keys, credentials) are excluded via .gitignore.
⚠️ If a secret is accidentally committed, use git filter-repo to permanently remove it before pushing.


### 👤 Author
Built by Dax Chica
📧 info@newurix.com
🌐 https://newurix.com

Accounting made smart — For finance professionals, by a finance professional.

### 📄 License

This project is currently private and under development.
For licensing inquiries, please contact the author directly.

