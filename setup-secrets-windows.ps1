# PowerShell script to set up AWS SSM Parameter Store secrets
# Run this script: .\setup-secrets-windows.ps1

param(
    [string]$Stage = "dev",
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AWS SSM Secret Setup for FB Scheduler" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Stage: $Stage" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host ""

# Generate new encryption keys
Write-Host "Generating new encryption keys..." -ForegroundColor Green
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$keyBytes = New-Object byte[] 32
$rng.GetBytes($keyBytes)
$ENCRYPTION_KEY = [Convert]::ToBase64String($keyBytes)

$secretBytes = New-Object byte[] 32
$rng.GetBytes($secretBytes)
$ENCRYPTION_SECRET = [Convert]::ToBase64String($secretBytes)

$jwtBytes = New-Object byte[] 64
$rng.GetBytes($jwtBytes)
$JWT_SECRET = [Convert]::ToBase64String($jwtBytes)
$rng.Dispose()

Write-Host "Encryption keys generated" -ForegroundColor Green
Write-Host ""

# Prompt for Facebook App credentials
Write-Host "Please enter your Facebook App credentials:" -ForegroundColor Cyan
Write-Host ""

$FACEBOOK_APP_ID = Read-Host "Facebook App ID"
$FACEBOOK_APP_SECRET = Read-Host "Facebook App Secret (NEW - rotate the old one!)" -AsSecureString
$FACEBOOK_APP_SECRET_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($FACEBOOK_APP_SECRET))

Write-Host ""
Write-Host "Note: You will get the redirect URI after first deployment" -ForegroundColor Yellow
$FACEBOOK_REDIRECT_URI = Read-Host "Facebook Redirect URI (or press Enter to use placeholder)"
if ([string]::IsNullOrWhiteSpace($FACEBOOK_REDIRECT_URI)) {
    $FACEBOOK_REDIRECT_URI = "https://PLACEHOLDER.execute-api.$Region.amazonaws.com/auth/callback"
    Write-Host "Using placeholder: $FACEBOOK_REDIRECT_URI" -ForegroundColor Yellow
}

Write-Host ""
$FRONTEND_URL = Read-Host "Frontend URL"
$ALLOWED_ORIGINS = Read-Host "Allowed Origins (comma-separated)"

Write-Host ""
Write-Host "Creating SSM parameters..." -ForegroundColor Green

# Create SSM parameters
try {
    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/facebook-app-id" `
        --value "$FACEBOOK_APP_ID" `
        --type "String" `
        --region "$Region" `
        --overwrite 2>$null

    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/facebook-app-secret" `
        --value "$FACEBOOK_APP_SECRET_PLAIN" `
        --type "SecureString" `
        --region "$Region" `
        --overwrite 2>$null

    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/facebook-redirect-uri" `
        --value "$FACEBOOK_REDIRECT_URI" `
        --type "String" `
        --region "$Region" `
        --overwrite 2>$null

    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/encryption-key" `
        --value "$ENCRYPTION_KEY" `
        --type "SecureString" `
        --region "$Region" `
        --overwrite 2>$null

    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/encryption-secret" `
        --value "$ENCRYPTION_SECRET" `
        --type "SecureString" `
        --region "$Region" `
        --overwrite 2>$null

    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/jwt-secret" `
        --value "$JWT_SECRET" `
        --type "SecureString" `
        --region "$Region" `
        --overwrite 2>$null

    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/frontend-url" `
        --value "$FRONTEND_URL" `
        --type "String" `
        --region "$Region" `
        --overwrite 2>$null

    aws ssm put-parameter `
        --name "/fb-scheduler/$Stage/allowed-origins" `
        --value "$ALLOWED_ORIGINS" `
        --type "String" `
        --region "$Region" `
        --overwrite 2>$null

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  All secrets configured successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "IMPORTANT: Save these values securely:" -ForegroundColor Yellow
    Write-Host "ENCRYPTION_KEY=$ENCRYPTION_KEY" -ForegroundColor Gray
    Write-Host "ENCRYPTION_SECRET=$ENCRYPTION_SECRET" -ForegroundColor Gray
    Write-Host "JWT_SECRET=$JWT_SECRET" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Delete .env and lambda\.env files" -ForegroundColor White
    Write-Host "2. Run: cd lambda" -ForegroundColor White
    Write-Host "3. Run: npm run deploy" -ForegroundColor White
    Write-Host "4. Update Facebook Redirect URI with actual API Gateway URL" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "Error creating SSM parameters:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "- AWS credentials are configured (aws sts get-caller-identity)" -ForegroundColor White
    Write-Host "- You have permissions to create SSM parameters" -ForegroundColor White
    Write-Host "- Region is correct: $Region" -ForegroundColor White
    exit 1
}
