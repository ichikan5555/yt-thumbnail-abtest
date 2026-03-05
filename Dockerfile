# --- Stage 1: Build frontend ---
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python runtime ---
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY --from=frontend /app/frontend/dist ./frontend/dist

RUN mkdir -p data/thumbnails data/reports data/backups

EXPOSE 8888

CMD ["python", "-m", "app.main", "web"]
