#!/usr/bin/env bash
# Baja el backup mas nuevo del VPS a tu maquina. Se corre DESDE TU MAQUINA.
#
#   bash deploy/traer-backup.sh 45.90.108.64
#
# Un backup que vive en el mismo servidor que los datos no es un backup: si se
# pierde el servidor, se pierden los dos. Esto es lo que convierte una copia en
# tres (VPS + tu PC + de ahi a Drive).

set -euo pipefail

IP="${1:-}"
CLAVE="${2:-}"
USUARIO_SSH="${USUARIO_SSH:-root}"
DESTINO_LOCAL="${DESTINO_LOCAL:-$HOME/globalita-backups/crm}"

if [ -z "$IP" ]; then
  echo "Falta la IP.  Uso: bash deploy/traer-backup.sh TU_IP [ruta/a/clave_ssh]"
  exit 1
fi

SSH_ARGS=()
[ -n "$CLAVE" ] && SSH_ARGS=(-i "$CLAVE")

mkdir -p "$DESTINO_LOCAL"

echo "==> Buscando el backup mas nuevo"
ULTIMO=$(ssh "${SSH_ARGS[@]}" "$USUARIO_SSH@$IP" \
  "ls -t /opt/crm-globalita/backups/crm_*.tar.gz 2>/dev/null | head -1")

if [ -z "$ULTIMO" ]; then
  echo "No hay ningun backup todavia."
  echo "Genera uno a mano con:  ssh $USUARIO_SSH@$IP 'sudo -u crm /opt/crm-globalita/backup.sh'"
  exit 1
fi

echo "    $ULTIMO"
scp "${SSH_ARGS[@]}" "$USUARIO_SSH@$IP:$ULTIMO" "$DESTINO_LOCAL/"

ARCHIVO="$DESTINO_LOCAL/$(basename "$ULTIMO")"
echo "==> Verificando la copia local"
tar -tzf "$ARCHIVO" >/dev/null && echo "    se abre bien"

echo
echo "Guardado en: $ARCHIVO"
echo
echo "Copia 3 de 3: subilo a Drive. Ojo con el limite de 48KB de create_file:"
echo "para un archivo de este tamano hay que subirlo desde el navegador."
