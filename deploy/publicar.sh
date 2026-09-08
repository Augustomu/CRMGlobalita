#!/usr/bin/env bash
# Publica una version nueva. Se corre DESDE TU MAQUINA, no desde el VPS.
#
#   bash deploy/publicar.sh 45.90.108.64
#   bash deploy/publicar.sh 45.90.108.64 ~/.ssh/mi_clave
#
# Que hace:
#   1. corre los tests (si fallan, no publica)
#   2. compila la interfaz
#   3. sube la interfaz a pb_public/ y las migraciones a pb_migrations/
#   4. reinicia el servicio, que aplica las migraciones al arrancar
#
# NO toca pb_data: los datos del servidor no se pisan nunca desde aca.

set -euo pipefail

IP="${1:-}"
CLAVE="${2:-}"
USUARIO_SSH="${USUARIO_SSH:-root}"
DESTINO=/opt/crm-globalita

if [ -z "$IP" ]; then
  echo "Falta la IP.  Uso: bash deploy/publicar.sh TU_IP [ruta/a/clave_ssh]"
  exit 1
fi

SSH_ARGS=()
[ -n "$CLAVE" ] && SSH_ARGS=(-i "$CLAVE")

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

echo "==> Tests"
npm test

echo "==> Compilando la interfaz"
npm run web:build

echo "==> Subiendo la interfaz"
# --delete deja pb_public identico al build: sin restos de versiones viejas.
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete -e "ssh ${SSH_ARGS[*]}" pb_public/ "$USUARIO_SSH@$IP:$DESTINO/pb_public/"
else
  ssh "${SSH_ARGS[@]}" "$USUARIO_SSH@$IP" "rm -rf $DESTINO/pb_public/* "
  scp "${SSH_ARGS[@]}" -r pb_public/. "$USUARIO_SSH@$IP:$DESTINO/pb_public/"
fi

echo "==> Subiendo las migraciones"
scp "${SSH_ARGS[@]}" -r packages/db/pb_migrations/. "$USUARIO_SSH@$IP:$DESTINO/pb_migrations/"

echo "==> Subiendo los hooks"
ssh "${SSH_ARGS[@]}" "$USUARIO_SSH@$IP" "mkdir -p $DESTINO/pb_hooks"
scp "${SSH_ARGS[@]}" -r packages/db/pb_hooks/. "$USUARIO_SSH@$IP:$DESTINO/pb_hooks/"

echo "==> Permisos y reinicio"
ssh "${SSH_ARGS[@]}" "$USUARIO_SSH@$IP" "
  chown -R crm:crm $DESTINO/pb_public $DESTINO/pb_migrations $DESTINO/pb_hooks &&
  systemctl restart crm-globalita &&
  sleep 2 &&
  systemctl is-active crm-globalita
"

echo
echo "Publicado. Revisa http://$IP/  (o tu dominio)"
echo
echo "Si algo salio mal:  ssh $USUARIO_SSH@$IP 'journalctl -u crm-globalita -n 40 --no-pager'"
