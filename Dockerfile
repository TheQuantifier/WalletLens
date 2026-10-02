# Dockerfile
# ---------------------------------------------------------
# Base Image — Node 22 + Debian (Render compatible)
# Includes Python + Tesseract for OCR worker
# ---------------------------------------------------------
FROM node:22-bullseye

# Make Python output unbuffered (critical for OCR piping)
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# ---------------------------------------------------------
# Install system dependencies (Python + Tesseract OCR)
# ---------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        tesseract-ocr \
        tesseract-ocr-eng \
        libtesseract-dev && \
    rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------
# Set project root
# ---------------------------------------------------------
WORKDIR /usr/src/app

# ---------------------------------------------------------
# Install Node dependencies (use api/ package.json)
# ---------------------------------------------------------
COPY api/package*.json ./api/
WORKDIR /usr/src/app/api

# Use npm ci when lockfile exists (more reproducible), fallback is fine if no lock
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ---------------------------------------------------------
# Install Python OCR worker dependencies
# ---------------------------------------------------------
WORKDIR /usr/src/app
COPY worker/requirements.txt ./worker/requirements.txt
RUN pip3 install --no-cache-dir -r worker/requirements.txt

# ---------------------------------------------------------
# Copy full project AFTER deps installed (better layer caching)
# ---------------------------------------------------------
COPY . .

# ---------------------------------------------------------
# Backend working directory
# ---------------------------------------------------------
WORKDIR /usr/src/app/api

# Render will set PORT, but local dev uses 4000
EXPOSE 4000

# Ensure the python binary name matches your env defaults
# (you can still override with PYTHON_BIN)
ENV PYTHON_BIN=python3

CMD ["node", "src/server.js"]
