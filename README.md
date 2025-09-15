# 🚗 License Plate Recognition — v1-local

Local development setup for FastAPI backend + Next.js frontend.

---

## 🖥️ Desktop Setup

```bash
# 1. Create a Conda environment
conda create -n DeepLearning python=3.10 -y
conda activate DeepLearning

# 2. Install Python dependencies
pip install -r requirements (from main branch requirements.txt)

# 3. Run the FastAPI backend
cd <project-root>
python -m uvicorn pipelines.server:app --app-dir src --reload --port 8000

# 4. Open a new terminal (Ctrl + Shift + ` in VS Code)
#    Install and run the frontend
npm install
npm run dev

# Open in browser
# http://localhost:3000

```

## 📱 Phone Setup (Same Wi-Fi Network)

```bash
# 1. Start SSL proxy (maps HTTPS 3443 → localhost:3000)
npx local-ssl-proxy --source 3443 --target 3000

# 2. Run frontend in another terminal
npm run dev

# 3. Find your PC's IP
ipconfig
# Look for:
# IPv4 Address . . . . . . . . . . : 192.168.xx.xxx

# 4. On your phone’s browser, enter:
# https://192.168.xx.xxx:3443

```

## 🛠️ Tech Stack

```bash
Backend: FastAPI, Uvicorn, Ultralytics YOLO, fast-plate-ocr, EasyOCR, OpenCV

Frontend: Next.js, React, Tailwind, shadcn/ui

Local Testing: local-ssl-proxy
```
