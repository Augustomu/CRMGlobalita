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

## Paso 4.5 · El correo (para dar de alta gente)

El CRM manda un correo cuando das de alta a alguien: le llega su usuario y un
enlace para elegir su contraseña (§6.7 del manual). **Sin esto configurado, dar
de alta falla y te lo dice** — no crea a nadie a medias.

Hostinger da casillas con el dominio. Entrá al panel de Hostinger → **Emails** →
creá `crm@globalita.tech` y anotá su contraseña.

Después, en el panel de PocketBase (`https://crm.globalita.tech/_/`) →
**Settings → Mail settings**:

| Campo | Valor |
|---|---|
| Use SMTP mail server | tildado |
| SMTP server host | `smtp.hostinger.com` |
| Port | `465` |
| Username | `crm@globalita.tech` |
| Password | la de esa casilla |
| TLS encryption | tildado (465 es SSL directo) |
| Sender name | `CRM Globalita` |
| Sender address | `crm@globalita.tech` |

Si el 465 no conecta, probá **587 sin TLS tildado** (STARTTLS). Son las dos
formas que ofrece Hostinger y depende de cómo tengan el servidor ese mes.

**Probalo antes de invitar a nadie**: en esa misma pantalla hay un botón *Send
test email*. Si llega, el alta funciona.

> **Por qué el correo NO lleva la contraseña.** Una clave escrita en un mail
> queda en esa bandeja para siempre, y quien entre a esa casilla dentro de dos
> años tiene una llave del CRM. El enlace deja de servir apenas se usa, o a los
> siete días — lo que pase antes.

También conviene apagar, en **Settings → Mail settings**, el aviso automático
de *«Login from a new location»*: le llega a la persona cada vez que entra
desde otro navegador y no aporta nada en un equipo de cuatro.

---

## Paso 4.6 · Google Calendar

Esto es lo único de toda la integración que no puede hacer el CRM por vos: hay
que crear una **aplicación de Google** con tu cuenta. Son diez minutos y se hace
una sola vez. Después, cada persona del equipo conecta su propio calendario
apretando un botón.

**Se puede hacer HOY, sin deploy.** Google acepta `localhost` como destino, así
que sirve para probarlo contra la base local antes de publicar nada.

### 1. Crear el proyecto

1. Entrá a <https://console.cloud.google.com/> con la cuenta de Google cuyo
   calendario querés usar.
2. Arriba a la izquierda, el selector de proyectos → **Proyecto nuevo**.
   Nombre: `CRM Globalita`. Crear.
3. Asegurate de que quede seleccionado ese proyecto (se ve arriba).

### 2. Prender la API

**APIs y servicios → Biblioteca** → buscá **Google Calendar API** → **Habilitar**.

Si esto queda sin hacer, todo lo demás funciona y el primer evento falla con
un mensaje de API deshabilitada. Es el olvido más común.

### 3. La pantalla de consentimiento

**APIs y servicios → Pantalla de consentimiento de OAuth**:

| Campo | Valor |
|---|---|
| Tipo de usuario | **Externo** |
| Nombre de la aplicación | `CRM Globalita` |
| Correo de asistencia | el tuyo |
| Datos de contacto del desarrollador | el tuyo |

En **Público** dejala en **Modo de prueba** y agregate a vos —y a cada persona
del equipo que vaya a conectar su calendario— en **Usuarios de prueba**.

> **Por qué modo de prueba y no publicada.** Publicada, Google exige un proceso
> de verificación con video y revisión que tarda semanas, y es para apps que usa
> gente de afuera. Ésta la usan cuatro personas conocidas. El único límite del
> modo de prueba es 100 usuarios, y el permiso caduca a los 7 días — pero eso
> aplica a los alcances *sensibles*, y el que pedimos (`calendar.events`) no lo
> es: alcanza con reconectar si algún día deja de andar.

### 4. Las credenciales

**APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:

- Tipo de aplicación: **Aplicación web**
- Nombre: `CRM Globalita`
- En **URI de redireccionamiento autorizados**, agregá **las dos**:

  ```
  http://127.0.0.1:8090/api/google/callback
  https://crm.globalita.tech/api/google/callback
  ```

Se cargan las dos desde el principio: una credencial acepta varias, y así la
misma sirve para probar en tu máquina y para producción sin tocar nada después.

> **Tienen que coincidir letra por letra**, sin barra al final. Si no, Google
> contesta `redirect_uri_mismatch` y no dice cuál de las dos partes está mal.

Guardá y copiá el **ID de cliente** y el **Secreto de cliente**.

### 5. Ponerlas donde van

**En tu máquina**, creá el archivo `.env` en la raíz del proyecto:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

`.env` está en `.gitignore` desde siempre. **El secreto no se commitea nunca**:
el repo es público, y un secreto que estuvo en un commit hay que rotarlo aunque
después se borre, porque queda en el historial.

Reiniciá `npm run db:dev` para que lo tome.

**En el VPS**, van en un archivo aparte del servicio, por lo mismo:

```bash
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64
cat > /etc/crm-globalita.env <<'FIN'
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
FIN
chmod 600 /etc/crm-globalita.env
```

Y en `/etc/systemd/system/crm-globalita.service`, dentro de `[Service]`:

```
EnvironmentFile=/etc/crm-globalita.env
```

Después: `systemctl daemon-reload && systemctl restart crm-globalita`.

`PB_URL` no hace falta en el VPS: ahí PocketBase sirve la app, así que la app y
el servidor están en la misma URL y se cae a `APP_URL` solo.

### 6. Conectar

En el CRM, el icono de **Cuentas conectadas** → sección **Google Calendar** →
**Conectar**. Te lleva a Google, das el permiso, y volvés a la misma pantalla con
tu correo al lado. Si algo faltó, ahí mismo dice qué.

### Qué hace una vez conectado

- Las reuniones que agendes desde el CRM **se escriben en tu calendario**, con
  el título `Nombre Completo / Cuenta / Vos` y el invitado agregado.
- Mover o estirar una reunión en la agenda **actualiza el mismo evento**, no
  crea otro (D10).
- Las 288 reuniones históricas **no se vuelven a crear**: ya están en tu
  calendario, de ahí salieron. El código las saltea por fecha.

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

Para entrar al CRM hay que crear además el **primer** usuario de `users` desde
el panel (**Colecciones → users → Nuevo registro**), con `rol: administrador`,
`estado: activo` y `verified` tildado. Sin eso, la pantalla de login rechaza
todo: la colección está vacía.

Ese es el único que se crea a mano. **Al resto los das de alta desde el CRM**,
en Usuarios → **+** → Invitar: se les manda el correo con su enlace y no hay
que tocar el panel nunca más. Mientras no hayan entrado figuran como
`pendiente` y no pueden iniciar sesión.

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
