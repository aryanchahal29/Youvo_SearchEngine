$envFile = ".env.local"
$lines = Get-Content $envFile

foreach ($line in $lines) {
    if ($line -match '^(?!#)([^=]+)="(.*)"$') {
        $name = $matches[1]
        $val = $matches[2]
        if ($name -ne "VERCEL_OIDC_TOKEN") {
            Write-Host "Adding $name..."
            echo $val | npx vercel env add $name production
            # Vercel env add doesn't support adding to all environments in one non-interactive command easily,
            # but we can just do production. 
            # Oh wait, vercel env add also asks for environments by default unless we specify `production`.
            # Wait, `echo $val | vercel env add $name production` skips the interactive value prompt.
        }
    }
}

$cronSecret = [guid]::NewGuid().ToString()
Write-Host "Adding CRON_SECRET..."
echo $cronSecret | npx vercel env add CRON_SECRET production

Write-Host "Environment variables uploaded."
