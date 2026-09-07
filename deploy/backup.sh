#!/usr/bin/env bash
# Backup diario. Corre en el VPS por cron, como el usuario `crm`.
#
# Usa el backup online de SQLite (VACUUM INTO), asi que NO hay que parar el
# servicio ni se corre riesgo de copiar la base a mitad de una escritura.
# Copiar el archivo .db con `cp` mientras PocketBase escribe puede dar una
# copia corrupta: por eso no se hace asi.

set -euo pipefail

DESTINO=/opt/crm-globalita
BACKUPS="$DESTINO/backups"
RETENER_DIAS=14
FECHA=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUPS"

echo "[$(date -Is)] arranca backup"

# 1. La base, con copia consistente.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DESTINO/pb_data/data.db" "VACUUM INTO '$BACKUPS/data_$FECHA.db'"
  echo "  base -> data_$FECHA.db"
else
  echo "  ERROR: falta sqlite3. Instalalo con: apt-get install -y sqlite3"
  exit 1
fi

# 2. Los archivos subidos (fotos de los leads).
if [ -d "$DESTINO/pb_data/storage" ]; then
  tar -czf "$BACKUPS/storage_$FECHA.tar.gz" -C "$DESTINO/pb_data" storage
  echo "  archivos -> storage_$FECHA.tar.gz"
fi

# 3. Un solo paquete, que es lo que conviene bajarse.
tar -czf "$BACKUPS/crm_$FECHA.tar.gz" -C "$BACKUPS" "data_$FECHA.db" \
  $( [ -f "$BACKUPS/storage_$FECHA.tar.gz" ] && echo "storage_$FECHA.tar.gz" )
rm -f "$BACKUPS/data_$FECHA.db" "$BACKUPS/storage_$FECHA.tar.gz"

# 4. Verificacion: un backup que no se puede abrir no es un backup.
TAMANO=$(stat -c%s "$BACKUPS/crm_$FECHA.tar.gz")
if ! tar -tzf "$BACKUPS/crm_$FECHA.tar.gz" >/dev/null 2>&1; then
  echo "  ERROR: el paquete quedo corrupto"
  exit 1
fi
echo "  paquete -> crm_$FECHA.tar.gz ($TAMANO bytes, verificado)"

# 5. Rotacion.
find "$BACKUPS" -name 'crm_*.tar.gz' -mtime +$RETENER_DIAS -delete
echo "  quedan $(find "$BACKUPS" -name 'crm_*.tar.gz' | wc -l) backups"

echo "[$(date -Is)] listo"
echo
echo "RECORDATORIO: esto es UNA sola copia, en el mismo servidor que los datos."
echo "Para cumplir la regla de las 3 copias hay que bajarlo:"
echo "  bash deploy/traer-backup.sh TU_IP"
