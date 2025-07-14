from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import fitz  # PyMuPDF
import os
import json
from openai import OpenAI

# 🌍 Load environment variables
env_path = Path(__file__).resolve().parent.parent / ".env"
print(f"🔍 Looking for .env at: {env_path}")
env_loaded = load_dotenv(dotenv_path=env_path)
print(f"✅ .env loaded: {env_loaded}")

# 🔐 Validate API key
api_key = os.getenv("VITE_OPENAI_API_KEY")
if not api_key:
    raise ValueError("❌ OPENAI_API_KEY not set in .env file!")
print(f"🔑 Retrieved partial API key: {api_key[:10]}...")

# 🤖 Initialize OpenAI client
client = OpenAI(api_key=api_key)

# 🚀 FastAPI app
app = FastAPI()

# 🌐 Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "✅ Backend is running and CORS-enabled"}

@app.post("/api/parse")
async def parse_pdf(file: UploadFile = File(...)):
    try:
        print(f"📥 Received file: {file.filename}, type: {file.content_type}")
        contents = await file.read()

        # 💾 Save to temporarily file
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(contents)

        # 📄 Extract text using PyMuPDF
        text = ""
        with fitz.open(temp_path) as doc:
            for page in doc:
                text += page.get_text()
        os.remove(temp_path)
        print(f"🧾 Extracted text length: {len(text)}")

        # 📚 Build GPT prompt
        prompt = f"""
You are a financial assistant. Your task is to extract key accounting data from the following invoice text.

Respond ONLY with a valid JSON structure like this:

{{
    "invoice": {{
        "date": "YYYY-MM-DD",
        "invoice_number": "string",
        "vendor": "string",
        "client": "string",
        "classification": "venta_servicios | utility_service | internet | office_supplies | purchase_goods | inventory_purchase | fixed_asset | others",
        "subtotal": number,
        "tax": number,
        "total": number
    }}
}}

Allowedd classifications:
- venta_servicios
- utility_service
- internet
office_supplies
- purchase_goods
- fixed_asset
- other

Do not include any explanation or commentary. Respond only with valid JSON.

--- START OF TEXT ---
{text}
--- END OF TEXT ---
"""

        # 🧠 Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a strict financial assistant. Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
        )

        output = response.choices[0].message.content.strip()
        print("🧠 Raw OpenAI Output:", output)

        # Try to parse it
        try:
            parsed = json.loads(output)
        except json.JSONDecodeError as e:
            print("❌ JSON parsing error:", e)
            return {"error": "OpenAI response was not valid JSON."}
        
        return parsed

    except Exception as e:
        print("❌ Unexpected error during parsing:", e)
        return {"error": str(e)}