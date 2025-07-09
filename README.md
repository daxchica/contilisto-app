# Contalisto.io – AI-Powered Accounting SaaS

Contalisto is a Software-as-a-Service (SaaS) platform designed for accountants and small to mid-sized entities. It combines PDF parsing, AI (OpenAI), and structured financial logic to simplify bookkeeping and generate financial statements in compliance with Ecuadorian practices.

---

## 🧱 Project Structure

```
contalisto-app/
├── backend/              ← FastAPI backend for PDF parsing and AI logic
├── src/                  ← React + Vite frontend
├── uploaded_pdfs/        ← Folder for uploaded files
├── .env                  ← Environment variables (ignored in Git)
├── run.sh                ← Shell script for launching services
├── package.json          ← Frontend dependencies
├── requirements.txt      ← Python backend dependencies
```

---

## 🚀 Development Phases & Checkpoints

### ✅ Phase 1: Auth + Entity System
- [x] Firebase login + registration (email/password)
- [x] Create/manage multiple entities per user (in-memory or Firestore)
- [ ] Connect entity to upload + AI workflow

### ⬜ Phase 2: PDF Upload + Text Parsing
- [ ] Drag & drop PDF upload
- [ ] Extract text with PyMuPDF
- [ ] Preview text + metadata

### ⬜ Phase 3: OpenAI Integration
- [x] GPT prompt generation with ledger schema
- [ ] Return structured entries (date, account, debit, credit, etc.)
- [ ] Connect entries to selected entity

### ⬜ Phase 4: Ledger Entry Management
- [ ] List & edit AI-generated ledger entries
- [ ] Connect with account code registry
- [ ] Save to backend DB

### ⬜ Phase 5: Financial Reports
- [ ] Balance Sheet, P&L
- [ ] Date range filtering
- [ ] Export to PDF

### ⬜ Phase 6: Deployment
- [ ] Deploy frontend (e.g. Vercel)
- [ ] Deploy backend (e.g. Fly.io, Render)
- [ ] PostgreSQL for production DB

---

## 📦 Environment Setup

### 🔧 Backend
```bash
cd backend
source .venv/bin/activate  # or: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 🌐 Frontend
```bash
cd contalisto-app
npm install
npm run dev
```

---

## 📬 Contact
Built by Dax Chica – For finance professionals, by a finance professional.
# contalisto-app
