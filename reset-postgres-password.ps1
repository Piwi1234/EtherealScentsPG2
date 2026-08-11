# Ejecutar esto en una PowerShell abierta como Administrador ("Ejecutar como administrador").
# Resetea la contraseña del usuario 'postgres' a la que definas abajo.

$NuevaPassword = "CambiaEstaPassword123"   # <-- cambia esto por la contraseña que quieras usar
$PgData = "C:\Program Files\PostgreSQL\17\data"
$HbaFile = "$PgData\pg_hba.conf"
$BackupFile = "$PgData\pg_hba.conf.bak"

Write-Host "Deteniendo servicio PostgreSQL..."
Stop-Service postgresql-x64-17

Write-Host "Respaldando pg_hba.conf..."
Copy-Item $HbaFile $BackupFile -Force

Write-Host "Cambiando autenticacion local a 'trust' temporalmente..."
(Get-Content $HbaFile) |
    ForEach-Object {
        if ($_ -match '^(host|local)\s+all\s+all\s') {
            $_ -replace '\s(scram-sha-256|md5|password)\s*$', ' trust'
        } else {
            $_
        }
    } | Set-Content $HbaFile

Write-Host "Iniciando servicio PostgreSQL..."
Start-Service postgresql-x64-17
Start-Sleep -Seconds 3

Write-Host "Cambiando password del usuario postgres..."
$env:PGPASSWORD = ""
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "ALTER USER postgres WITH PASSWORD '$NuevaPassword';"

Write-Host "Restaurando pg_hba.conf original..."
Copy-Item $BackupFile $HbaFile -Force
Remove-Item $BackupFile

Write-Host "Reiniciando servicio PostgreSQL con autenticacion normal..."
Restart-Service postgresql-x64-17

Write-Host ""
Write-Host "Listo. Nueva password del usuario postgres: $NuevaPassword"
Write-Host "Guardala, la vamos a usar en el .env del proyecto."
