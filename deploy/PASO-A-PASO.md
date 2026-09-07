# Poner el CRM online — paso a paso

Datos concretos de esta instalación:

| | |
|---|---|
| VPS | `srv1961198.hstgr.cloud` → **45.90.108.64** |
| Dominio del CRM | **`crm.globalita.tech`** (hay que crearlo, paso 2) |
| Ruta en el servidor | `/opt/crm-globalita` |
| Ojo | en ese VPS **ya vive la bitácora personal** |

---

## Paso 0 · Renovar `globalita.tech` — HOY

**Vence en 25 días.** Si se vence: se cae el CRM, se cae tu sitio web, y el
dominio queda liberado para que lo agarre cualquiera. Los `.tech` no tienen un
período de gracia largo.

1. En el panel de Hostinger, arriba, el aviso amarillo → botón **Renovar**.
2. Después, entrá a **Dominios → globalita.tech** y activá la
   **renovación automática**. Esto no debería depender de que alguien se acuerde.

No sigas con lo demás hasta resolver esto.

---

## Paso 1 · Ver qué hay corriendo en el VPS

Hace falta saberlo **antes** de instalar, porque el CRM quiere los puertos 80 y
443, y la bitácora podría estar usándolos.

1. Panel de Hostinger → **VPS** → `srv1961198.hstgr.cloud`
2. Arriba a la derecha: botón **Consola web**
3. Pegá esto y mandame la salida:

```bash
echo "=== PUERTOS 80/443/8090 ==="; ss -tlnp | grep -E ':(80|443|8090)\s' || echo "LIBRES"
echo "=== SERVICIOS ==="; systemctl list-units --type=service --state=running | grep -viE 'systemd|dbus|cron|ssh|getty|polkit|network|resolved|journal|user@' | head
echo "=== DOCKER ==="; docker ps 2>/dev/null || echo "sin docker"
echo "=== ESPACIO ==="; df -h / | tail -1; free -m | head -2
```

**Qué significa la respuesta:**

- Si dice **LIBRES** → seguimos derecho, el CRM toma 80 y 443.
- Si aparece algo escuchando en 80 o 443 → hay que poner un proxy que reparta
  por nombre de dominio. Se resuelve, pero cambia los pasos 4 y 5. Avisame.

---

## Paso 2 · Crear el subdominio `crm.globalita.tech`

Esto **no toca tu sitio web**: `globalita.tech` sigue apuntando al hosting, y
solo el subdominio `crm` va al VPS.

1. Barra lateral izquierda → **Dominios**
2. Click en **globalita.tech**
3. Buscá **DNS / Nameservers** (o **Administrador de DNS**)
4. Botón **Añadir registro** (o *Add record*)
5. Cargá exactamente esto:

| Campo | Valor |
|---|---|
| Tipo | `A` |
| Nombre / Host | `crm` |
| Apunta a / Points to | `45.90.108.64` |
| TTL | dejá el que viene |

6. **Guardar**

En el campo Nombre va solo `crm`, **no** `crm.globalita.tech` — el panel le
agrega el dominio solo. Si ponés el nombre completo te queda
`crm.globalita.tech.globalita.tech`, que es el error más común acá.

---

## Paso 3 · Esperar y verificar

El DNS tarda entre 5 minutos y un par de horas. Para verificar, en tu PC:

```bash
nslookup crm.globalita.tech
```

Tiene que responder **45.90.108.64**. Hasta que no diga eso, no sigas: el
certificado HTTPS se pide contra ese nombre y va a fallar.

---

## Paso 4 · Instalar (una sola vez)

Desde tu PC, en la carpeta del proyecto:

```bash
cd ~/Projects/CRMGlobalita

scp -i ~/.ssh/bitacora_vps \
  deploy/instalar.sh deploy/crm-globalita.service deploy/backup.sh \
  root@45.90.108.64:/tmp/

ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'apt-get install -y sqlite3 && bash /tmp/instalar.sh'
```

Deja instalado: PocketBase, un usuario `crm` sin acceso, el servicio arrancando
solo al bootear, el firewall abierto en 22/80/443 y el backup diario a las 03:15.

---

## Paso 5 · Crear tu usuario administrador

```bash
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 \
  'sudo -u crm /opt/crm-globalita/pocketbase superuser create --dir /opt/crm-globalita/pb_data'
```

Te pide mail y contraseña. **Esa clave no queda guardada en ningún archivo del
proyecto** — anotala donde guardes tus contraseñas.

---

## Paso 6 · Publicar la app

```bash
bash deploy/publicar.sh 45.90.108.64 ~/.ssh/bitacora_vps
```

Corre los tests (si fallan, no publica), compila la interfaz, la sube y
reinicia. Al arrancar, PocketBase aplica las migraciones y pide el certificado.

La primera vez, el certificado tarda unos segundos. Si el navegador se queja,
esperá un minuto y recargá.

---

## Paso 7 · Entrar

| Para qué | URL |
|---|---|
| El CRM | https://crm.globalita.tech |
| El panel de la base | https://crm.globalita.tech/_/ |

En el panel creás los usuarios reales del equipo: **Colecciones → users →
Nuevo registro**, con su `rol` (administrador o colaborador) y `estado` activo.

Los datos de demo (Alberto, Sofía, los 8 leads) **no se suben**: son de prueba y
viven solo en tu máquina.

---

## Paso 8 · Probar que el backup sirve

Esto no es opcional, y es lo que evita repetir lo de septiembre.

```bash
# generar uno a mano, sin esperar a las 03:15
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'sudo -u crm /opt/crm-globalita/backup.sh'

# bajarlo a tu PC
bash deploy/traer-backup.sh 45.90.108.64 ~/.ssh/bitacora_vps
```

Queda en `~/globalita-backups/crm/`. **Subí ese archivo a Drive**: recién ahí
tenés las tres copias (VPS + tu PC + Drive).

---

## Si algo sale mal

```bash
# estado del servicio
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'systemctl status crm-globalita'

# los últimos errores
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'journalctl -u crm-globalita -n 40 --no-pager'
```

**Los dos errores más probables:**

1. *"cannot bind to :80"* → algo más ya usa el puerto. Es lo que revisamos en el
   paso 1.
2. *No saca el certificado* → `crm.globalita.tech` todavía no resuelve al VPS, o
   el puerto 80 está cerrado (Let's Encrypt lo necesita para validar).
