#!/usr/bin/env bash
# Instalacion inicial del CRM en el VPS. Se corre UNA sola vez, como root.
#
#   scp deploy/instalar.sh deploy/crm-globalita.service deploy/backup.sh \
#       deploy/nginx-crm.conf root@45.90.108.64:/tmp/
#   ssh root@45.90.108.64 'bash /tmp/instalar.sh'
#
# EN ESTE VPS YA VIVE bitacorapersonal.online detras de nginx.
# Este script NO toca su configuracion: agrega un server block nuevo y valida
# con `nginx -t` antes de recargar. Si la validacion falla, no recarga nada.

set -euo pipefail

DESTINO=/opt/crm-globalita
USUARIO=crm
DOMINIO="${DOMINIO:-crm.globalita.tech}"
VERSION_PB="${VERSION_PB:-0.40.2}"

echo "==> Chequeos previos"
if ! command -v nginx >/dev/null 2>&1; then
  echo "    ERROR: no encuentro nginx. Este script asume el nginx que ya sirve"
  echo "    bitacorapersonal.online. Revisa antes de seguir."
  exit 1
fi
echo "    nginx: $(nginx -v 2>&1)"

if ss -tlnp 2>/dev/null | grep -q '127.0.0.1:8090'; then
  echo "    ERROR: el puerto 8090 ya esta ocupado. Elegi otro y cambialo en"
  echo "    crm-globalita.service y nginx-crm.conf."
  exit 1
fi

# Guarda de seguridad: si el DNS no apunta aca, certbot va a fallar.
IP_VPS=$(curl -s --max-time 10 https://api.ipify.org || echo "")
IP_DOM=$(getent hosts "$DOMINIO" | awk '{print $1}' | head -1 || echo "")
if [ -n "$IP_VPS" ] && [ "$IP_DOM" != "$IP_VPS" ]; then
  echo
  echo "    OJO: $DOMINIO resuelve a '${IP_DOM:-nada}' y este server es $IP_VPS."
  echo "    Falta el registro A, o todavia no propago. El certificado va a fallar."
  echo "    Podes seguir igual: se instala todo en HTTP y despues corres:"
  echo "        certbot --nginx -d $DOMINIO"
  echo
  read -rp "    Seguir igual? [s/N] " R
  [ "${R,,}" = "s" ] || exit 1
fi

echo "==> Paquetes"
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
chown -R "$USUARIO:$USUARIO" "$DESTINO"

echo "==> Servicio systemd (PocketBase en 127.0.0.1:8090)"
cp /tmp/crm-globalita.service /etc/systemd/system/crm-globalita.service
systemctl daemon-reload
systemctl enable --now crm-globalita
sleep 2
systemctl is-active --quiet crm-globalita || { journalctl -u crm-globalita -n 20 --no-pager; exit 1; }
echo "    activo"

echo "==> nginx: server block para $DOMINIO"
# Respaldo de la config actual, por las dudas.
RESPALDO="/root/nginx-backup-$(date +%Y%m%d-%H%M).tar.gz"
tar -czf "$RESPALDO" /etc/nginx 2>/dev/null || true
echo "    respaldo de /etc/nginx en $RESPALDO"

sed "s/crm\.globalita\.tech/$DOMINIO/g" /tmp/nginx-crm.conf > "/etc/nginx/sites-available/$DOMINIO"
ln -sf "/etc/nginx/sites-available/$DOMINIO" "/etc/nginx/sites-enabled/$DOMINIO"

# Si la config no valida, se saca el enlace y NO se recarga: la bitacora sigue
# andando exactamente igual que antes.
if ! nginx -t 2>/tmp/nginx-test.log; then
  echo "    ERROR: la configuracion de nginx no valida. No se recargo nada."
  cat /tmp/nginx-test.log
  rm -f "/etc/nginx/sites-enabled/$DOMINIO"
  exit 1
fi
systemctl reload nginx
echo "    nginx recargado, bitacorapersonal.online intacto"

echo "==> Certificado HTTPS"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi
if certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos \
     --register-unsafely-without-email --redirect 2>/tmp/certbot.log; then
  echo "    certificado emitido y redirect a HTTPS configurado"
else
  echo "    no se pudo emitir el certificado (queda andando en HTTP):"
  tail -5 /tmp/certbot.log
  echo "    cuando el DNS propague, corre:  certbot --nginx -d $DOMINIO"
fi

echo "==> Backup diario a las 03:15"
cp /tmp/backup.sh "$DESTINO/backup.sh"
chmod +x "$DESTINO/backup.sh"
chown "$USUARIO:$USUARIO" "$DESTINO/backup.sh"
cat > /etc/cron.d/crm-globalita-backup <<'CRON'
15 3 * * * crm /opt/crm-globalita/backup.sh >> /opt/crm-globalita/backups/backup.log 2>&1
CRON

echo
echo "======================================================================"
systemctl --no-pager status crm-globalita | head -5 || true
echo "----------------------------------------------------------------------"
echo "bitacora:  $(curl -s -o /dev/null -w '%{http_code}' https://bitacorapersonal.online || echo 'sin respuesta')  (deberia ser 200)"
echo "crm:       $(curl -s -o /dev/null -w '%{http_code}' -H 'Host: '"$DOMINIO" http://127.0.0.1/api/health || echo 'sin respuesta')  (deberia ser 200)"
echo "======================================================================"
echo
echo "Siguiente:"
echo "  1. Crear el superusuario:"
echo "     sudo -u $USUARIO $DESTINO/pocketbase superuser create --dir $DESTINO/pb_data"
echo "  2. Desde tu maquina:  bash deploy/publicar.sh 45.90.108.64 ~/.ssh/bitacora_vps"
echo "  3. Entrar a:  https://$DOMINIO/_/"
