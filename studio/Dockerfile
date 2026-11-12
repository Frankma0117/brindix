# Estudio de videos de Brindix: Chromium (Playwright) graba el escenario y las páginas reales; ffmpeg arma el MP4.
FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
