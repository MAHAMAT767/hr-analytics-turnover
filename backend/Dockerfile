FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

WORKDIR /app

# libgomp1 est requis par scikit-learn / shap (OpenMP)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY ml/ ./ml/
# Le dataset est requis par /api/stats et /api/dataset a l'execution.
COPY data/ ./data/

# Les artefacts du modèle sont produits par le pipeline ML et injectés au build
# (etape "Download model artifacts" du CI) ou montes en volume a l'execution.
RUN mkdir -p ml/artifacts logs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
