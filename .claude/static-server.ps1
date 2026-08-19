$root = Split-Path -Parent $PSScriptRoot
$port = 8123
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    continue
  }
  try {
    $req = $context.Request
    $res = $context.Response
    $res.KeepAlive = $false
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq '/') { $path = '/index.html' }
    $filePath = Join-Path $root $path.TrimStart('/')

    if (Test-Path -LiteralPath $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath)
      $contentType = $mime[$ext]
      if (-not $contentType) { $contentType = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentType = $contentType
      $res.ContentLength64 = $bytes.LongLength
      if ($req.HttpMethod -ne 'HEAD') {
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } else {
      $res.StatusCode = 404
      $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.ContentLength64 = $notFound.LongLength
      if ($req.HttpMethod -ne 'HEAD') {
        $res.OutputStream.Write($notFound, 0, $notFound.Length)
      }
    }
  } catch {
    Write-Host "Request error: $_"
  } finally {
    try { $context.Response.OutputStream.Close() } catch {}
    try { $context.Response.Close() } catch {}
  }
}
