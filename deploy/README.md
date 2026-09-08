# Desplegar el CRM en el VPS

> **¿Primera vez?** Segui `PASO-A-PASO.md`, que tiene los datos reales de esta
> instalacion (VPS 45.90.108.64, dominio crm.globalita.tech). Este archivo es la
> referencia general.

Arquitectura: **PocketBase detrás de nginx**. PocketBase escucha solo en
(desde `pb_public/`), y saca el certificado HTTPS solo. No hace falta nginx,
ni Docker, ni un proceso aparte para el frontend.

```
                 ┌─────────────────────────────────┐
   navegador ──► │  PocketBase  (systemd, :80/:443)│
                 │   ├── /            la interfaz  │
                 │   ├── /api/...     la API       │
                 │   └── /_/          el panel     │
                 └─────────────────────────────────┘
                        /opt/crm-globalita
```

## Antes de empezar

Necesitás la **IP del VPS** y poder entrar por SSH. Si tenés dominio,
apuntá un registro `A` a esa IP **antes** de instalar: PocketBase pide el
certificado al arrancar, y sin DNS apuntando falla.

## 1. Instalación (una sola vez)

Desde tu máquina, en la carpeta del proyecto:

```bash
scp deploy/instalar.sh deploy/crm-globalita.service deploy/backup.sh deploy/nginx-crm.conf root@TU_IP:/tmp/
ssh root@TU_IP 'bash /tmp/instalar.sh'
```

Eso deja: PocketBase instalado, usuario `crm` sin login, servicio de systemd
activo y arrancando solo al bootear, firewall abierto en 22/80/443, y el backup
diario a las 03:15.

**Si tenés dominio**, editá `/etc/systemd/system/crm-globalita.service` y
reemplazá `0.0.0.0:80` / `0.0.0.0:443` por tu dominio; después
`systemctl daemon-reload && systemctl restart crm-globalita`.

**Si todavía no tenés dominio**, comentá las líneas de `--http`/`--https` y
descomentá la de `:8090`. Ojo: sin HTTPS la contraseña viaja sin cifrar, así que
es para probar, no para usarlo en serio.

## 2. Crear el superusuario

```bash
ssh root@TU_IP 'sudo -u crm /opt/crm-globalita/pocketbase superuser create --dir /opt/crm-globalita/pb_data'
```

Esta clave **no queda guardada en ningún archivo del proyecto**. Anotala donde
guardes tus contraseñas.

## 3. Publicar la app

```bash
bash deploy/publicar.sh TU_IP
```

Corre los tests (si fallan, no publica), compila la interfaz, la sube a
`pb_public/`, sube las migraciones y reinicia. Al arrancar, PocketBase aplica
las migraciones que falten.

**Nunca toca `pb_data`**: los datos del servidor no se pisan desde acá.

## 4. Cargar los usuarios reales

El seed de demo (`packages/db/pb_seed/`) **no se sube**: son datos de prueba.
En producción, creá los usuarios desde el panel: `https://TU_DOMINIO/_/`

## Actualizar

Cada vez que quieras publicar cambios:

```bash
bash deploy/publicar.sh TU_IP
```

## Backups

| Cuándo | Qué pasa | Dónde queda |
|---|---|---|
| todos los días 03:15 | `backup.sh` en el VPS | `/opt/crm-globalita/backups/` (14 días) |
| cuando lo corras | `bash deploy/traer-backup.sh TU_IP` | tu PC |
| a mano | subirlo a Drive | la tercera copia |

El backup usa `VACUUM INTO` de SQLite, que hace una copia consistente **sin
parar el servicio**. Copiar el `.db` con `cp` mientras PocketBase escribe puede
dar un archivo corrupto — por eso no se hace así.

**El backup en el VPS no alcanza.** Vive en el mismo disco que los datos: si se
pierde el servidor, se pierden los dos. La regla de las 3 copias se cumple recién
cuando lo bajás.

### Probar que el backup sirve

Un backup que nunca se restauró no es un backup. Antes de cargar los 27.000
perfiles reales, probá una restauración completa:

```bash
tar -xzf crm_FECHA.tar.gz
# levantá una PocketBase local apuntando a esa data.db y entrá al panel
```

## Restaurar

```bash
ssh root@TU_IP 'systemctl stop crm-globalita'
scp crm_FECHA.tar.gz root@TU_IP:/tmp/
ssh root@TU_IP '
  cd /tmp && tar -xzf crm_FECHA.tar.gz &&
  cp data_*.db /opt/crm-globalita/pb_data/data.db &&
  chown crm:crm /opt/crm-globalita/pb_data/data.db &&
  systemctl start crm-globalita
'
```

## Ver qué está pasando

```bash
ssh root@TU_IP 'systemctl status crm-globalita'
ssh root@TU_IP 'journalctl -u crm-globalita -n 50 --no-pager'
ssh root@TU_IP 'journalctl -u crm-globalita -f'          # en vivo
ssh root@TU_IP 'tail -20 /opt/crm-globalita/backups/backup.log'
```

## Lo que este despliegue todavía NO incluye

- **El worker de LinkedIn y WhatsApp.** Es la Etapa 5 y el mayor riesgo técnico
  del proyecto (→ `§8.1 del manual`). Cuando llegue, va a
  ser un segundo servicio de systemd, uno por cuenta.
- **Las sesiones de LinkedIn/WhatsApp**, que van a necesitar su propio backup:
  recuperarlas evita revincular 10 cuentas por QR.

Mientras tanto, lo que corre acá es el CRM manual: cargar leads, seguirlos,
armar los mensajes y registrar los envíos.
