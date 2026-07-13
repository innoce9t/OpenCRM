# Deploy OpenCRM to Google Cloud Run
# Builds a Docker image, pushes it to Google Container Registry, and deploys to Cloud Run.
#
# Secrets (GEMINI_API_KEY, etc.) are read from the git-ignored .env file at deploy
# time and passed to Cloud Run - they are NOT hard-coded in this script. The
# Firebase web config is public (shipped to the browser) so it is fine in env.
# Run from the repo root:  ./deploy.ps1

$PROJECT_ID   = "gen-lang-client-0536773966"
$SERVICE_NAME = "opencrm"
$REGION       = "us-central1"
$IMAGE_NAME   = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Starting deployment to Google Cloud Run" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Step 1: Ensure correct project is set
Write-Host "`nStep 1: Setting Google Cloud project..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Step 2: Enable required APIs
Write-Host "`nStep 2: Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com firestore.googleapis.com

# Step 3: Build Docker image
Write-Host "`nStep 3: Building Docker image..." -ForegroundColor Yellow
Write-Host "  Image: $IMAGE_NAME" -ForegroundColor Gray
docker build -t $IMAGE_NAME .
if ($LASTEXITCODE -ne 0) { Write-Host "Docker build failed!" -ForegroundColor Red; exit 1 }
Write-Host "Docker image built successfully!" -ForegroundColor Green

# Step 4: Configure Docker for GCR
Write-Host "`nStep 4: Configuring Docker authentication..." -ForegroundColor Yellow
gcloud auth configure-docker --quiet

# Step 5: Push image to Google Container Registry
Write-Host "`nStep 5: Pushing image to Google Container Registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME
if ($LASTEXITCODE -ne 0) { Write-Host "Docker push failed!" -ForegroundColor Red; exit 1 }
Write-Host "Image pushed successfully!" -ForegroundColor Green

# Step 6: Assemble env vars (non-secret config here + everything from .env)
Write-Host "`nStep 6: Preparing environment variables..." -ForegroundColor Yellow
$envPairs = @()
$envPairs += "NODE_ENV=production"
$envPairs += "FIRESTORE_PROJECT_ID=$PROJECT_ID"   # app data lives in this project's Firestore (via ADC)

$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line -split "=", 2
            $key = $parts[0].Trim()
            $val = $parts[1].Trim()
            # Skip local-only keys; keep Firebase/Gemini config + keys.
            if ($val -and $key -ne "FIRESTORE_PROJECT_ID" -and $key -ne "OPENCRM_DATA_DIR") {
                $envPairs += "$key=$val"
            }
        }
    }
    Write-Host "  Loaded config from $envFile" -ForegroundColor Gray
} else {
    Write-Host "  WARNING: .env not found - deploying without Firebase/Gemini config." -ForegroundColor Red
}
$envString = $envPairs -join ","

# Step 7: Deploy to Cloud Run
Write-Host "`nStep 7: Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host "  Service: $SERVICE_NAME  |  Region: $REGION" -ForegroundColor Gray
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --memory 1Gi `
    --cpu 1 `
    --timeout 300 `
    --max-instances 5 `
    --set-env-vars $envString
if ($LASTEXITCODE -ne 0) { Write-Host "Cloud Run deployment failed!" -ForegroundColor Red; exit 1 }
Write-Host "Service deployed successfully!" -ForegroundColor Green

# Step 8: Show the live URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format "value(status.url)"

Write-Host "`nDeployment successful!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Your service is live at:" -ForegroundColor Green
Write-Host "   $SERVICE_URL" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "   1. For Google sign-in: add the URL's hostname to Firebase project" -ForegroundColor Gray
Write-Host "      'opencrm-72386' -> Authentication -> Settings -> Authorized domains." -ForegroundColor Gray
Write-Host "   2. Check logs: gcloud run services logs read $SERVICE_NAME --region=$REGION" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Cyan
