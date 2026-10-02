# Dockerfile
# ---------------------------------------------------------
# Base Image — Node 22 + Debian Bookworm (Render compatible)
# Includes Python + Tesseract for OCR worker
# ---------------------------------------------------------
FROM node:22-bookworm

# Make Python output unbuffered (critical for OCR piping)
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# ---------------------------------------------------------
# Install system dependencies (Python + Tesseract OCR)
# ---------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
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
ENV VIRTUAL_ENV=/opt/walletlens-venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN python -m pip install --no-cache-dir -r worker/requirements.txt

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

# Use the isolated Python environment for the OCR worker.
# This can still be overridden with Render's PYTHON_BIN variable.
ENV PYTHON_BIN=/opt/walletlens-venv/bin/python

CMD ["node", "src/server.js"]
