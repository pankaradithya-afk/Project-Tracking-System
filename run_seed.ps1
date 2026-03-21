# run_seed.ps1 — executes seed_club_mahabaleshwar.sql via Supabase Management API
$projectRef = "xrdfuxgeyovqhkemvfpy"
$sqlFile = "$PSScriptRoot\seed_club_mahabaleshwar.sql"

# Read the SQL file
$sql = Get-Content -Path $sqlFile -Raw -Encoding UTF8

# Supabase Management API — /pg/query endpoint (requires service_role key or personal access token)
# We'll use the Supabase REST /rpc endpoint approach via pg_query (admin)
# Actually we use the direct Postgres connection check via the DB REST
# The easiest headless approach: use the Supabase SQL via a fetch using anon key + RPC
# Since the schema uses RLS with authenticated, we use the service-role key from the env or prompt.

Write-Host "Paste your Supabase SERVICE ROLE key (from project Settings > API):"
$svcKey = Read-Host

$body = @{ query = $sql } | ConvertTo-Json -Depth 10

$headers = @{
    "apikey"        = $svcKey
    "Authorization" = "Bearer $svcKey"
    "Content-Type"  = "application/json"
}

$url = "https://$projectRef.supabase.co/rest/v1/rpc/pg_query"

Write-Host "Executing SQL seed... please wait."
try {
    $resp = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
    Write-Host "SUCCESS:" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "Trying alternative endpoint..."
    
    # Alternative: Supabase management API v1
    $mgmtUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"
    Write-Host "Using management API (requires personal access token)."
    Write-Host "Get your PAT from https://supabase.com/dashboard/account/tokens"
    $pat = Read-Host "Paste your Personal Access Token (starts with sbp_)"
    
    $mgmtHeaders = @{
        "Authorization" = "Bearer $pat"
        "Content-Type"  = "application/json"
    }
    $mgmtBody = @{ query = $sql } | ConvertTo-Json -Depth 10
    
    try {
        $resp2 = Invoke-RestMethod -Uri $mgmtUrl -Method POST -Headers $mgmtHeaders -Body $mgmtBody
        Write-Host "SUCCESS via management API!" -ForegroundColor Green
        $resp2 | ConvertTo-Json -Depth 5
    }
    catch {
        Write-Host "Management API also failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "MANUAL OPTION: Open https://supabase.com/dashboard/project/$projectRef/sql/new" -ForegroundColor Yellow
        Write-Host "and paste the contents of seed_club_mahabaleshwar.sql" -ForegroundColor Yellow
    }
}
