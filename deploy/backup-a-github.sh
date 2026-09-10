#!/usr/bin/env bash
# La copia del VPS sube a GitHub. Corre EN EL VPS, por cron, como el usuario crm.
#
#   bash deploy/backup-a-github.sh          # una vez, a mano, para probar
#
# POR QUE EXISTE
# --------------
# Hasta el 10/09/2026 habia dos cadenas de copias y ninguna cubria al VPS:
#
#   la base de la PC   -> disco local, GitHub privado y Drive     (tres copias)
#   la base del VPS    -> UNA copia, en el mismo servidor         (una sola)
#
# Mientras la base de verdad estuvo en la PC eso alcanzaba. En cuanto el VPS
# pasa a ser la fuente de verdad, deja de alcanzar: una copia en el mismo disco
# que los datos no protege de que se caiga el disco. Y el `backup.sh` del
# servidor lo viene avisando en cada corrida, en su propio log.
#
# Esto cierra la cadena: VPS -> GitHub privado -> y de ahi se baja a la PC.
#
# POR QUE UNA LLAVE DE DESPLIEGUE Y NO UN TOKEN
# ---------------------------------------------
# Un token personal en un archivo del servidor es una credencial que abre TODOS
# los repositorios de la cuenta, y ya nos paso tener uno en texto plano. Una
# llave de despliegue sirve para UN repositorio y para nada mas: si alguien
# entra al VPS, se lleva acceso a las copias y no a la cuenta de GitHub.
#
# QUE SUBE
# --------
# El .tar.gz que ya arma `backup.sh`, tal cual. No se descomprime ni se
# reempaqueta: lo que se restaura es exactamente lo que se verifico al crearlo.
#
# Se guardan las ultimas 30. Cada una pesa lo que pese la base comprimida —hoy
# unos cientos de KB— y en git son objetos binarios que no se deltean, asi que
# el limite es lo que evita que el repositorio crezca sin fin.

set -euo pipefail

DESTINO=/opt/crm-globalita
BACKUPS="$DESTINO/backups"
CLON="$DESTINO/repo-datos"
REPO="${REPO_DATOS:-git@github.com:Augustomu/globalita-data.git}"
RETENER=30

# Pararse en una carpeta que el usuario crm pueda leer, ANTES de cualquier
# otra cosa. Corriendo con sudo -u crm desde /root, el find de backup.sh muere
# con "Failed to restore initial working directory" y el backup no se hace.
# En cron el directorio es otro, pero la corrida a mano es la que se usa para
# probar, y una prueba que falla por el directorio no prueba nada.
cd "$DESTINO"

echo "[$(date -Is)] arranca la subida a GitHub"

# 1. Una copia fresca, con el script que ya existe y que verifica lo que arma.
bash "$DESTINO/backup.sh" >/dev/null

ULTIMO=$(ls -1t "$BACKUPS"/crm_*.tar.gz 2>/dev/null | head -1 || true)
if [ -z "$ULTIMO" ]; then
  echo "  ! no hay ningun .tar.gz para subir. No se toca el repositorio."
  exit 1
fi
echo "  copia: $(basename "$ULTIMO")"

# 2. El clon. La primera vez se crea; despues solo se actualiza.
if [ ! -d "$CLON/.git" ]; then
  echo "  clonando $REPO por primera vez"
  git clone --depth 1 "$REPO" "$CLON"
  git -C "$CLON" config user.name  "crm-vps"
  git -C "$CLON" config user.email "finanzas@globalita.tech"
fi
git -C "$CLON" fetch --depth 1 origin main
git -C "$CLON" reset --hard origin/main

# 3. Las copias del servidor van en su propia carpeta: el repositorio ya tiene
#    las de la PC y mezclarlas haria imposible saber de donde vino cada una.
mkdir -p "$CLON/vps"
cp "$ULTIMO" "$CLON/vps/"

# 4. Retencion. Se borran las mas viejas del REPOSITORIO, no del servidor: el
#    servidor tiene su propia retencion y son dos cosas distintas.
COPIAS=$(ls -1 "$CLON/vps"/crm_*.tar.gz 2>/dev/null | wc -l)
if [ "$COPIAS" -gt "$RETENER" ]; then
  ls -1 "$CLON/vps"/crm_*.tar.gz | head -n "-$RETENER" | xargs -r git -C "$CLON" rm -q --
  echo "  retencion: quedan $RETENER"
fi

# 5. Subir. Sin cambios no se hace un commit vacio.
cd "$CLON"
git add -A vps
if git diff --cached --quiet; then
  echo "  sin cambios desde la ultima subida"
  exit 0
fi

REGISTROS=$(sqlite3 "$DESTINO/pb_data/data.db" "select count(*) from lead;" 2>/dev/null || echo "?")
git commit -q -m "copia del VPS $(date -Is) · ${REGISTROS} leads"
git push -q origin main

echo "  subido. $(git rev-list --count HEAD) copias en el historial."
echo "[$(date -Is)] listo"
