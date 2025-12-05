# Utiliser Python 3.11 (compatible TensorFlow 2.16.2)
FROM python:3.11-slim

# Définir le répertoire de travail
WORKDIR /app

# Variables d'environnement pour optimiser TensorFlow
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    PORT=8080

# Installer les dépendances système (requises pour TensorFlow)
RUN apt-get update && apt-get install -y \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements
COPY requirements.txt .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code de l'application
COPY main.py .
COPY models/ ./models/
COPY serviceAccountKey.json .

# Exposer le port (Cloud Run utilise PORT env variable)
EXPOSE 8080

# Commande de démarrage
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
