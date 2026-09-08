# Poner el CRM online — paso a paso

Datos concretos de esta instalación:

| | |
|---|---|
| VPS | `srv1961198.hstgr.cloud` → **45.90.108.64** |
| Dominio del CRM | **`crm.globalita.tech`** (hay que crearlo, paso 2) |
| Ruta en el servidor | `/opt/crm-globalita` |
| Ya vive ahí | **`bitacorapersonal.online`**, detrás de nginx 1.24.0 |

---

## Paso 0 · Renovar `globalita.tech` — HOY

**Vence en 25 días.** Si se vence: se cae el CRM, se cae tu sitio web, y el
dominio queda liberado para que lo agarre cualquiera. Los `.tech` no tienen un
período de gracia largo.

1. En el panel de Hostinger, arriba, el aviso amarillo → botón **Renovar**.
2. Después, entrá a **Dominios → globalita.tech** y activá la
   **renovación automática**. Esto no debería depender de que alguien se acuerde
   el año que viene.

No sigas con lo demás hasta resolver esto.

---

## Paso 1 · Cómo conviven la bitácora y el CRM

Esto ya está verificado, no hace falta que revises nada: en el VPS corre
**nginx 1.24.0** sirviendo `bitacorapersonal.online` por HTTPS (y redirigiendo
HTTP a HTTPS). O sea que **los puertos 80 y 443 ya están ocupados**.

Por eso el CRM no los toma. La solución es la estándar, y termina siendo más
segura que la idea original:

```
                       ┌── bitacorapersonal.online ──► la bitácora (igual que hoy)
 internet ──► nginx ───┤
              :80/:443 └── crm.globalita.tech ───────► 127.0.0.1:8090  (PocketBase)
```

PocketBase escucha **solo en localhost**. Desde internet no se le puede entrar
directo: todo pasa por nginx, que es quien tiene los certificados.

**Qué hace el instalador para no romper la bitácora:**

- Agrega un archivo de configuración **nuevo**, no edita los que ya existen.
- Guarda un respaldo completo de `/etc/nginx` en `/root/` antes de tocar nada.
- Valida con `nginx -t` **antes** de recargar. Si no valida, deshace el enlace y
  no recarga: la bitácora sigue exactamente igual.
- Al final verifica que la bitácora siga respondiendo 200.

---

## Paso 2 · Crear el subdominio `crm.globalita.tech`

Esto **no toca tu sitio web**. Verificado: `globalita.tech` apunta al hosting
(147.79.120.196) y `crm.globalita.tech` no existe todavía. Son registros
independientes.

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

En el campo *Nombre* va solo `crm`, **no** `crm.globalita.tech` — el panel le
agrega el dominio solo. Si ponés el nombre completo te queda
`crm.globalita.tech.globalita.tech`, que es el error más común acá.

---

## Paso 3 · Esperar y verificar

El DNS tarda entre 5 minutos y un par de horas. Desde tu PC:

```bash
nslookup crm.globalita.tech
```

Tiene que responder **45.90.108.64**. Hasta que no diga eso, no sigas: el
certificado se pide contra ese nombre y Let's Encrypt lo va a rechazar.

---

## Paso 4 · Instalar (una sola vez)

Desde tu PC, en la carpeta del proyecto:

```bash
cd ~/Projects/CRMGlobalita

scp -i ~/.ssh/bitacora_vps \
  deploy/instalar.sh deploy/crm-globalita.service \
  deploy/backup.sh deploy/nginx-crm.conf \
  root@45.90.108.64:/tmp/

ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'bash /tmp/instalar.sh'
```

Deja: PocketBase corriendo en 127.0.0.1:8090, usuario `crm` sin acceso, servicio
que arranca solo al bootear, el server block de nginx, el certificado HTTPS y el
backup diario a las 03:15.

Al terminar imprime dos chequeos: que la bitácora sigue en 200 y que el CRM
responde. **Si la bitácora no da 200, avisame antes de seguir.**

---

## Paso 5 · Crear los usuarios

```bash
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 \
  'sudo -u crm /opt/crm-globalita/pocketbase superuser create --dir /opt/crm-globalita/pb_data'
```

Te pide mail y contraseña. **Esa clave no queda guardada en ningún archivo del
proyecto** — anotala donde guardes tus contraseñas.

**OJO: eso crea el superusuario del PANEL (`/_/`), no un usuario de la app.**
Son dos cosas distintas:

| Para | Colección | Dónde se entra |
|---|---|---|
| Administrar la base | `_superusers` | `/_/` |
| Usar el CRM | `users` | la app |

Para entrar al CRM hay que crear además un registro en `users` desde el panel
(**Colecciones → users → Nuevo registro**), con `rol`, `estado: activo` y
`verified` tildado. Sin eso, la pantalla de login rechaza todo: la colección
está vacía.

---

## Paso 6 · Publicar la app

```bash
bash deploy/publicar.sh 45.90.108.64 ~/.ssh/bitacora_vps
```

Corre los tests (si fallan, no publica), compila la interfaz, la sube a
`pb_public/`, sube las migraciones y reinicia. Al arrancar, PocketBase aplica
las migraciones que falten.

**Nunca toca `pb_data`**: los datos del servidor no se pisan desde acá.

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
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 \
  'sudo -u crm /opt/crm-globalita/backup.sh'

# bajarlo a tu PC
bash deploy/traer-backup.sh 45.90.108.64 ~/.ssh/bitacora_vps
```

Queda en `~/globalita-backups/crm/`. **Subí ese archivo a Drive**: recién ahí
tenés las tres copias (VPS + tu PC + Drive).

---

## Actualizar, más adelante

Cada vez que quieras publicar cambios, un solo comando:

```bash
bash deploy/publicar.sh 45.90.108.64 ~/.ssh/bitacora_vps
```

---

## Si algo sale mal

```bash
# el CRM
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'systemctl status crm-globalita'
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'journalctl -u crm-globalita -n 40 --no-pager'

# nginx
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 'nginx -t && systemctl status nginx'
```

**Los errores más probables:**

1. **Certbot falla.** `crm.globalita.tech` todavía no resuelve al VPS. Esperá a
   que propague y corré:
   `certbot --nginx -d crm.globalita.tech`
2. **502 Bad Gateway.** nginx está bien, PocketBase no. Mirá
   `journalctl -u crm-globalita`.
3. **Se rompió la bitácora.** No debería, pero el respaldo está en
   `/root/nginx-backup-FECHA.tar.gz`:
   ```bash
   rm /etc/nginx/sites-enabled/crm.globalita.tech
   nginx -t && systemctl reload nginx
   ```
   Eso la deja como estaba, sin tocar nada más.

---

## Lo que este despliegue todavía NO incluye

- **El worker de LinkedIn y WhatsApp** (Etapa 5, el mayor riesgo técnico del
  proyecto → `§8.1 del manual`). Va a ser otro servicio de
  systemd, uno por cuenta.
- **Backup de las sesiones** de LinkedIn/WhatsApp: recuperarlas evita tener que
  revincular 10 cuentas por QR.

Lo que sí corre es el CRM manual: cargar leads, seguirlos, armar los mensajes
con las plantillas y registrar los envíos.
