#!/bin/bash

echo "🔄 Starting FastAPI backend..."

# Step 1: Create virtual environment if not already
if [ ! -d "venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv venv
fi

# Step 2: Activate virtual environment
source venv/bin/activate

# Step 3: Upgrade pip & install dependencies
echo "📥 Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

# Step 4: Run the server
echo "🚀 Running FastAPI server..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload