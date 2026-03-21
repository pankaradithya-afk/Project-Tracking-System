$url = "https://xrdfuxgeyovqhkemvfpy.supabase.co/auth/v1/signup"
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyZGZ1eGdleW92cWhrZW12ZnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzA4ODIsImV4cCI6MjA4OTYwNjg4Mn0.oHNBMrwBf9LWd5XlGbzgMOeLEa_jC3ZNDe-JHzxs0cI"

$headers = @{
    "apikey"       = $key
    "Content-Type" = "application/json"
}

$body = '{"email":"admin@irrigation.local","password":"Admin@1234"}'

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Body: $($response.Content)"
}
catch [System.Net.WebException] {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $responseBody = $reader.ReadToEnd()
    Write-Host "HTTP Error: $($_.Exception.Response.StatusCode)"
    Write-Host "Error Body: $responseBody"
}
