# Cloud Scheduler Setup Guide

## Overview
Configuration automatique du pipeline de réentraînement ML via Google Cloud Scheduler.

## Prérequis
- Projet Google Cloud configuré
- Cloud Scheduler API activée
- Backend déployé sur Cloud Run avec endpoint `/admin/retrain`
- Variable d'environnement `ADMIN_API_KEY` configurée

## 1. Activer Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

## 2. Créer le Job de Réentraînement Hebdomadaire

### Option A: Via gcloud CLI (Recommandé)

```bash
# Configuration des variables
PROJECT_ID="ai-pictionary-4f8f2"
REGION="europe-west1"
SERVICE_URL="https://backend-service-url.run.app"  # Remplacer par l'URL Cloud Run
ADMIN_API_KEY="votre_admin_api_key_secret"  # Générer une clé sécurisée

# Créer le job Cloud Scheduler
gcloud scheduler jobs create http retrain-model-weekly \
  --location=${REGION} \
  --schedule="0 2 * * 0" \
  --time-zone="Europe/Paris" \
  --uri="${SERVICE_URL}/admin/retrain" \
  --http-method=POST \
  --headers="Authorization=Bearer ${ADMIN_API_KEY}" \
  --description="Réentraînement hebdomadaire du modèle CNN avec Active Learning" \
  --attempt-deadline=3600s \
  --project=${PROJECT_ID}
```

### Option B: Via Console Google Cloud

1. Aller sur [Cloud Scheduler Console](https://console.cloud.google.com/cloudscheduler)
2. Cliquer sur **"Créer un job"**
3. Configuration:
   - **Nom**: `retrain-model-weekly`
   - **Région**: `europe-west1`
   - **Description**: "Réentraînement hebdomadaire du modèle CNN"
   - **Fréquence (Cron)**: `0 2 * * 0` (Dimanche à 2h du matin)
   - **Fuseau horaire**: `Europe/Paris`
   
4. Configuration de la cible:
   - **Type**: HTTP
   - **URL**: `https://votre-backend.run.app/admin/retrain`
   - **Méthode HTTP**: POST
   - **En-têtes**:
     - `Authorization`: `Bearer VOTRE_ADMIN_API_KEY`
   - **Délai d'expiration**: 3600s (1 heure)

5. Cliquer sur **"Créer"**

## 3. Format Cron

```
┌───────────── minute (0 - 59)
│ ┌───────────── heure (0 - 23)
│ │ ┌───────────── jour du mois (1 - 31)
│ │ │ ┌───────────── mois (1 - 12)
│ │ │ │ ┌───────────── jour de la semaine (0 - 6) (Dimanche = 0)
│ │ │ │ │
│ │ │ │ │
0 2 * * 0  → Chaque dimanche à 2h00
```

### Exemples de fréquences:

- **Hebdomadaire (dimanche 2h)**: `0 2 * * 0`
- **Bi-hebdomadaire**: `0 2 */14 * *`
- **Mensuel (1er du mois)**: `0 2 1 * *`
- **Quotidien (3h du matin)**: `0 3 * * *`
- **Toutes les 6 heures**: `0 */6 * * *`

## 4. Variables d'Environnement Backend

Ajouter à `.env` ou Cloud Run environment variables:

```bash
# Admin API Key (générer avec: openssl rand -hex 32)
ADMIN_API_KEY=your_secure_random_key_here

# Chemin du script de réentraînement
RETRAIN_SCRIPT_PATH=/app/ml-training/scripts/retrain_pipeline.py

# Firebase credentials
FIREBASE_CREDENTIALS_PATH=/app/serviceAccountKey.json
```

## 5. Générer une Admin API Key sécurisée

```bash
# Générer une clé aléatoire de 32 bytes (64 caractères hexadécimaux)
openssl rand -hex 32

# Exemple de sortie:
# 8f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
```

## 6. Tester le Job Manuellement

### Via gcloud CLI:
```bash
gcloud scheduler jobs run retrain-model-weekly --location=europe-west1
```

### Via curl:
```bash
curl -X POST https://votre-backend.run.app/admin/retrain \
  -H "Authorization: Bearer VOTRE_ADMIN_API_KEY"
```

### Réponse attendue:
```json
{
  "status": "triggered",
  "message": "Model retraining pipeline started in background",
  "triggered_at": "2024-12-06T10:30:00",
  "job_id": "retrain_20241206_103000"
}
```

## 7. Monitoring des Jobs

### Voir les logs d'exécution:
```bash
gcloud scheduler jobs describe retrain-model-weekly --location=europe-west1
```

### Voir l'historique des exécutions:
```bash
gcloud logging read "resource.type=cloud_scheduler_job AND \
  resource.labels.job_id=retrain-model-weekly" \
  --limit=10 \
  --format=json
```

### Voir les logs du backend pendant le réentraînement:
```bash
gcloud run logs read backend-service --limit=100
```

## 8. Notifications (Optionnel)

### Email de notification via Pub/Sub:

1. Créer un topic Pub/Sub:
```bash
gcloud pubsub topics create retrain-notifications
```

2. Modifier le backend pour publier des notifications:
```python
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, 'retrain-notifications')

# Dans la fonction trigger_retraining_pipeline:
if result.returncode == 0:
    publisher.publish(topic_path, 
        b'Retraining successful',
        job_id=job_id,
        status='success'
    )
```

3. Configurer Cloud Functions pour envoyer des emails:
```bash
# Créer une Cloud Function qui écoute le topic et envoie un email via SendGrid/Gmail
```

## 9. Gestion des Erreurs

### Si le job échoue:
1. Vérifier les logs Cloud Scheduler
2. Vérifier les logs du backend Cloud Run
3. Tester l'endpoint manuellement avec curl
4. Vérifier que l'API key est correcte
5. Vérifier que le script retrain_pipeline.py est présent

### Retry Policy:
Cloud Scheduler retry automatiquement en cas d'erreur:
- Nombre de tentatives: 3 (par défaut)
- Intervalle entre tentatives: Exponentiel backoff
- Configuration personnalisée:
```bash
gcloud scheduler jobs update http retrain-model-weekly \
  --max-retry-attempts=5 \
  --max-backoff=3600s \
  --location=europe-west1
```

## 10. Sécurité

### Recommandations:
1. **Ne jamais** commit l'ADMIN_API_KEY dans Git
2. Utiliser Google Secret Manager pour stocker la clé:
```bash
echo -n "your_admin_key" | gcloud secrets create admin-api-key --data-file=-
```

3. Configurer Cloud Run pour accéder au secret:
```bash
gcloud run services update backend-service \
  --update-secrets=ADMIN_API_KEY=admin-api-key:latest \
  --region=europe-west1
```

4. Restreindre l'accès avec Cloud IAM:
```bash
gcloud scheduler jobs add-iam-policy-binding retrain-model-weekly \
  --location=europe-west1 \
  --member=serviceAccount:scheduler@ai-pictionary-4f8f2.iam.gserviceaccount.com \
  --role=roles/cloudscheduler.jobRunner
```

## 11. Alternative: Manual Trigger Endpoint

Si Cloud Scheduler n'est pas disponible, créer un endpoint protégé pour déclencher manuellement:

```bash
# Déclencher via interface admin (à implémenter)
# Ou via script local:
python3 -m ml-training.scripts.retrain_pipeline
```

## Résumé

**Workflow complet:**
1. Cloud Scheduler → déclenche chaque dimanche à 2h
2. POST `/admin/retrain` avec Authorization header
3. Backend vérifie l'API key
4. Lance `retrain_pipeline.py` en background
5. Script récupère ≥500 corrections depuis Firestore
6. Télécharge les images depuis Storage
7. Fine-tune le modèle CNN
8. Valide la précision (threshold: 2% drop max)
9. Upload le nouveau modèle vers Storage
10. Met à jour les métadonnées dans Firestore
11. Logs de succès/erreur dans Cloud Logging

**Fréquence recommandée:** Hebdomadaire (balance entre fraîcheur du modèle et coûts)
