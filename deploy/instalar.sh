#!/usr/bin/env bash
# Instalacion inicial del CRM en el VPS. Se corre UNA sola vez, como root.
#
#   scp deploy/instalar.sh root@TU_IP:/tmp/
#   ssh root@TU_IP 'bash /tmp/instalar.sh'
#
# Deja el servicio andando y listo para recibir el primer despliegue con
# deploy/publicar.sh desde tu maquina.

set -euo pipefail

DESTINO=/opt/crm-globalita
USUARIO=crm
VERSION_PB="${VERSION_PB:-0.40.2}"

echo "==> Paquetes basicos"
apt-get update -qq
apt-get install -y -qq unzip curl ca-certificates sqlite3

echo "==> Usuario de servicio ($USUARIO), sin login"
id -u "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$USUARIO"

echo "==> Carpetas en $DESTINO"
mkdir -p "$DESTINO"/{pb_data,pb_public,pb_migrations,backups}

echo "==> PocketBase $VERSION_PB"
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  PB_ARCH=amd64 ;;
  aarch64) PB_ARCH=arm64 ;;
  *) echo "Arquitectura no contemplada: $ARCH"; exit 1 ;;
esac
cd /tmp
curl -sSLo pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION_PB}/pocketbase_${VERSION_PB}_linux_${PB_ARCH}.zip"
unzip -o -q pb.zip pocketbase
mv -f pocketbase "$DESTINO/pocketbase"
chmod +x "$DESTINO/pocketbase"
rm -f pb.zip

echo "==> Permisos"
chown -R "$USUARIO:$USUARIO" "$DESTINO"

echo "==> Firewall"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp   >/dev/null 2>&1 || true
  ufw allow 80/tcp   >/dev/null 2>&1 || true
  ufw allow 443/tcp  >/dev/null 2>&1 || true
  echo "    puertos 22, 80 y 443 abiertos"
else
  echo "    ufw no esta instalado; revisa el firewall del panel de Hostinger"
fi

echo "==> Servicio systemd"
if [ -f /tmp/crm-globalita.service ]; then
  cp /tmp/crm-globalita.service /etc/systemd/system/crm-globalita.service
else
  echo "    FALTA /tmp/crm-globalita.service - subilo y volve a correr:"
  echo "    scp deploy/crm-globalita.service root@TU_IP:/tmp/"
  exit 1
fi
systemctl daemon-reload
systemctl enable --now crm-globalita

echo "==> Backup diario a las 03:15"
if [ -f /tmp/backup.sh ]; then
  cp /tmp/backup.sh "$DESTINO/backup.sh"
  chmod +x "$DESTINO/backup.sh"
  chown "$USUARIO:$USUARIO" "$DESTINO/backup.sh"
  cat > /etc/cron.d/crm-globalita-backup <<'CRON'
15 3 * * * crm /opt/crm-globalita/backup.sh >> /opt/crm-globalita/backups/backup.log 2>&1
CRON
  echo "    cron instalado"
else
  echo "    OJO: falta /tmp/backup.sh, el backup NO quedo configurado"
fi

sleep 2
echo
echo "======================================================================"
systemctl --no-pager status crm-globalita | head -6 || true
echo "======================================================================"
echo
echo "Listo. Ahora, en este orden:"
echo
echo "  1. Crear el superusuario (te pide mail y clave):"
echo "     sudo -u $USUARIO $DESTINO/pocketbase superuser create --dir $DESTINO/pb_data"
echo
echo "  2. Desde tu maquina, subir la app y el esquema:"
echo "     bash deploy/publicar.sh TU_IP"
echo
echo "  3. Entrar al panel:  http://TU_IP/_/   (o https://TU_DOMINIO/_/)"
