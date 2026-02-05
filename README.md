# 📊 Contilisto – AI-Powered Accounting SaaS

**Contilisto** is a modern AI-assisted accounting SaaS designed to streamline accounting workflows for **accountants, small businesses, and bookkeepers in Ecuador and Latin America**.

The platform combines **PDF invoice extraction powered by AI**, **journal-based accounting aligned with Ecuador’s Chart of Accounts (PUC)**, and **real-time financial reporting**, while enforcing strict auditability and regulatory safety.

Contilisto is built with a **human-in-the-loop philosophy**: AI assists with data extraction and accounting suggestions, but **no financial record is ever saved without explicit user review and confirmation**.

---

## 🧠 Key Features

- 📎 Intelligent PDF invoice parsing (OCR + AI)
- 🧾 AI-assisted journal entry generation with manual review
- 🧩 Multi-entity support per user
- 📊 Real-time Profit & Loss and Balance Sheet
- 📚 Journal, Ledger, and Trial Balance
- 🏦 Bank movements and reconciliation
- 🧾 Electronic invoicing with Ecuadorian SRI integration
- 🔐 Firebase authentication (email/password)
- 🌎 Bilingual support (Spanish & English)
- ⚙️ Modular frontend / backend architecture for scalability and compliance

---

## 🧱 Project Architecture

Contilisto follows a **layered architecture** with clear separation of responsibilities:

[ React UI ]
↓
[ Application & Domain Services ]
↓
[ Persistence & Integrations ]
↓
[ Server / AI / SRI (Netlify Functions) ]

### Core Principles
- **The accounting journal is the single source of truth**
- **No circular dependencies**
- **All cryptography and SRI communication is server-side only**
- **AI never auto-persists accounting data**
- **All accounting actions are auditable**

---

## 🗂️ Project Structure

contilisto-app/
├── src/                     # React + Vite frontend (TypeScript + Tailwind)
│   ├── components/          # Reusable UI components
│   ├── pages/               # Route-level application pages
│   ├── layouts/             # UI layouts
│   ├── context/             # Auth and entity scoping
│   ├── services/            # Business and accounting logic
│   ├── utils/               # Pure accounting and helper utilities
│   ├── types/               # TypeScript domain models
│   └── shared/              # Ecuadorian PUC and shared data
│
├── netlify/
│   ├── functions/           # Server-side logic (AI, XML, SRI, crypto)
│   ├── prompts/             # AI accounting policy prompts
│   └── functions_disabled/  # Disabled or legacy server functions
│
├── public/                  # Static assets
├── .env.example             # Sample environment variables
├── package.json             # Frontend dependencies and scripts
└── README.md

---

## 🔁 Canonical Business Flows

### 1️⃣ Invoice → Journal → Ledger → Financial Reports

Invoice UI
→ invoiceService
→ journalService
→ Firestore (journalEntries)
→ Ledger, P&L, Balance Sheet

### 2️⃣ PDF Invoice → AI → Preview → Save

PDF Upload
→ Netlify AI extraction
→ Journal normalization
→ User preview & confirmation
→ Persisted journal entries

### 3️⃣ Bank → Reconciliation → Journal

Bank movement
→ Reconciliation
→ Journal entry

### 4️⃣ Electronic Invoice → SRI (Ecuador)

Invoice
→ XML generation & signing (server)
→ SRI submission
→ Authorization response

---

## 🧪 Development Roadmap

### ✅ Phase 1: User & Entity System
- [x] Firebase authentication
- [x] Multi-entity support
- [x] Entity selection and context

### ✅ Phase 2: PDF Upload & Parsing
- [x] Drag-and-drop PDF upload
- [x] OCR and layout extraction
- [x] AI-assisted data interpretation
- [x] Duplicate prevention (Firestore + LocalStorage)

### ✅ Phase 3: AI Accounting Logic
- [x] Accounting-aware AI prompts
- [x] Automatic income vs expense classification
- [x] Ecuadorian PUC-based account mapping
- [x] Human-review enforcement

### ✅ Phase 4: Journal & Balances
- [x] Journal preview and editing
- [x] Firestore persistence
- [x] Initial balance loading (manual and PDF)

### 🔄 Phase 5: Financial Operations
- [x] Profit & Loss
- [x] Balance Sheet
- [x] Trial Balance
- [ ] Accounts Receivable & Payable reports
- [ ] Advanced bank reconciliation rules

### ⬜ Phase 6: Production & Scale
- [x] Netlify deployment (frontend + backend)
- [ ] Advanced monitoring and alerts
- [ ] Automated backups
- [ ] Multi-country accounting extensions

---

## ⚙️ Local Development Setup

### 🌐 Frontend
```bash
npm install
npm run dev

cp .env.example .env

Required variables include:
	•	VITE_FIREBASE_API_KEY
	•	VITE_FIREBASE_PROJECT_ID
	•	OPENAI_API_KEY
	•	SRI and Firebase-related configuration

Never commit .env files to Git.

🛡️ Security & Compliance
	•	All cryptographic operations occur server-side
	•	Digital certificates (P12) are never exposed to the client
	•	Firestore rules enforce entity and user isolation
	•	AI output always requires human confirmation
	•	All accounting changes are traceable

⸻

🧱 Codebase Health
	•	No circular dependencies
	•	No orphan production code
	•	Strong TypeScript typing
	•	Explicit separation between UI, business logic, and compliance logic

👤 Author

Dax Chica
Founder & Lead Architect
📧 info@newurix.com
🌐 https://newurix.com

Accounting made smart — for finance professionals, by a finance professional.

⸻

📄 License

This project is currently private and under active development.
For licensing or partnership inquiries, please contact the author directly.

# 📊 Contilisto – AI-Powered Accounting SaaS

**Contilisto** is a modern AI-assisted accounting SaaS designed to streamline accounting workflows for **accountants, small businesses, and bookkeepers in Ecuador and Latin America**.

The platform combines **PDF invoice extraction powered by AI**, **journal-based accounting aligned with Ecuador’s Chart of Accounts (PUC)**, and **real-time financial reporting**, while enforcing strict auditability and regulatory safety.

Contilisto is built with a **human-in-the-loop philosophy**: AI assists with data extraction and accounting suggestions, but **no financial record is ever saved without explicit user review and confirmation**.

---

## 🧠 Key Features

- 📎 Intelligent PDF invoice parsing (OCR + AI)
- 🧾 AI-assisted journal entry generation with manual review
- 🧩 Multi-entity support per user
- 📊 Real-time Profit & Loss and Balance Sheet
- 📚 Journal, Ledger, and Trial Balance
- 🏦 Bank movements and reconciliation
- 🧾 Electronic invoicing with Ecuadorian SRI integration
- 🔐 Firebase authentication (email/password)
- 🌎 Bilingual support (Spanish & English)
- ⚙️ Modular frontend / backend architecture for scalability and compliance

---

## ⭐ Why Contilisto Is Different

Most accounting software focuses on **speed and automation first**, often at the expense of transparency, auditability, and professional control. Contilisto takes a different approach.

**1. Journal-first, not invoice-first**  
In Contilisto, the accounting journal is the **single source of truth**. Invoices, bank movements, AI outputs, and reports all converge into journal entries. This mirrors real accounting practice and guarantees consistency across financial statements.

**2. AI as an assistant, never as an authority**  
AI in Contilisto proposes entries, classifications, and mappings — but it never auto-posts. Every journal entry must be reviewed and confirmed by a human. This prevents silent accounting errors and preserves professional responsibility.

**3. Built for compliance, not retrofitted for it**  
SRI requirements, digital signatures, XML structures, and Ecuadorian PUC logic are not add-ons. They are **core design constraints**. All cryptography and regulatory communication is executed server-side, isolated from the client.

**4. Deterministic accounting logic**  
Financial statements are not recalculated through ad-hoc queries. They are derived deterministically from journal entries, following explicit accounting rules. This makes results explainable, auditable, and defensible.

**5. No “magic” data transformations**  
Contilisto avoids opaque transformations. Every balance, total, and report can be traced back to specific journal entries, source documents, and user actions.

**6. Designed for accountants, not just business owners**  
The system assumes accounting knowledge and respects professional workflows. It does not hide complexity — it organizes it.

---

## 🧱 Project Architecture

Contilisto follows a **layered architecture** with clear separation of responsibilities:

[ React UI ]
↓
[ Application & Domain Services ]
↓
[ Persistence & Integrations ]
↓
[ Server / AI / SRI (Netlify Functions) ]

### Core Principles
- **The accounting journal is the single source of truth**
- **No circular dependencies**
- **All cryptography and SRI communication is server-side only**
- **AI never auto-persists accounting data**
- **All accounting actions are auditable**

---

## 🗂️ Project Structure

contilisto-app/
├── src/                     # React + Vite frontend (TypeScript + Tailwind)
│   ├── components/          # Reusable UI components
│   ├── pages/               # Route-level application pages
│   ├── layouts/             # UI layouts
│   ├── context/             # Auth and entity scoping
│   ├── services/            # Business and accounting logic
│   ├── utils/               # Pure accounting and helper utilities
│   ├── types/               # TypeScript domain models
│   └── shared/              # Ecuadorian PUC and shared data
│
├── netlify/
│   ├── functions/           # Server-side logic (AI, XML, SRI, crypto)
│   ├── prompts/             # AI accounting policy prompts
│   └── functions_disabled/  # Disabled or legacy server functions
│
├── public/                  # Static assets
├── .env.example             # Sample environment variables
├── package.json             # Frontend dependencies and scripts
└── README.md

---

## 🔁 Canonical Business Flows

### 1️⃣ Invoice → Journal → Ledger → Financial Reports

Invoice UI
→ invoiceService
→ journalService
→ Firestore (journalEntries)
→ Ledger, P&L, Balance Sheet

### 2️⃣ PDF Invoice → AI → Preview → Save

PDF Upload
→ Netlify AI extraction
→ Journal normalization
→ User preview & confirmation
→ Persisted journal entries

### 3️⃣ Bank → Reconciliation → Journal

Bank movement
→ Reconciliation
→ Journal entry

### 4️⃣ Electronic Invoice → SRI (Ecuador)

Invoice
→ XML generation & signing (server)
→ SRI submission
→ Authorization response

---

## 🧪 Development Roadmap

### ✅ Phase 1: User & Entity System
- [x] Firebase authentication
- [x] Multi-entity support
- [x] Entity selection and context

### ✅ Phase 2: PDF Upload & Parsing
- [x] Drag-and-drop PDF upload
- [x] OCR and layout extraction
- [x] AI-assisted data interpretation
- [x] Duplicate prevention (Firestore + LocalStorage)

### ✅ Phase 3: AI Accounting Logic
- [x] Accounting-aware AI prompts
- [x] Automatic income vs expense classification
- [x] Ecuadorian PUC-based account mapping
- [x] Human-review enforcement

### ✅ Phase 4: Journal & Balances
- [x] Journal preview and editing
- [x] Firestore persistence
- [x] Initial balance loading (manual and PDF)

### 🔄 Phase 5: Financial Operations
- [x] Profit & Loss
- [x] Balance Sheet
- [x] Trial Balance
- [ ] Accounts Receivable & Payable reports
- [ ] Advanced bank reconciliation rules

### ⬜ Phase 6: Production & Scale
- [x] Netlify deployment (frontend + backend)
- [ ] Advanced monitoring and alerts
- [ ] Automated backups
- [ ] Multi-country accounting extensions

---

## ⚙️ Local Development Setup

### 🌐 Frontend
```bash
npm install
npm run dev

🔐 Environment Variables

cp .env.example .env

Required variables include:
	•	VITE_FIREBASE_API_KEY
	•	VITE_FIREBASE_PROJECT_ID
	•	OPENAI_API_KEY
	•	SRI and Firebase-related configuration

Never commit .env files to Git.

🛡️ Security & Compliance
	•	All cryptographic operations occur server-side
	•	Digital certificates (P12) are never exposed to the client
	•	Firestore rules enforce entity and user isolation
	•	AI output always requires human confirmation
	•	All accounting changes are traceable

⸻

🧱 Codebase Health
	•	No circular dependencies
	•	No orphan production code
	•	Strong TypeScript typing
	•	Explicit separation between UI, business logic, and compliance logic

	👤 Author

Dax Chica
Founder & Lead Architect
📧 info@newurix.com
🌐 https://newurix.com

Accounting made smart — for finance professionals, by a finance professional.

⸻

📄 License

This project is currently private and under active development.
For licensing or partnership inquiries, please contact the author directly.