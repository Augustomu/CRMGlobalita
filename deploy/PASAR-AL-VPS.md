# Pasar el CRM al VPS, y que las copias cierren

Hasta hoy la base de verdad vivía en la PC de Augusto y el VPS estaba vacío.
Esto lo da vuelta: **el VPS pasa a ser la fuente de verdad** y la PC queda para
desarrollar.

> **Esto NO es una sincronización entre dos bases vivas, y es a propósito.**
> Sincronizar dos PocketBase que se editan de los dos lados obliga a decidir
> cuál gana cada vez que la misma reunión cambia en ambos. SQLite no trae nada
> para resolver eso: habría que escribirlo, y sería el código con más chances
> de perder datos de todo el proyecto — justo lo que ya pasó una vez.
>
> Lo que sí resuelve el problema es tener **una sola base**, la del VPS, y una
> cadena de copias que la respalde. Se trabaja siempre contra
> `https://crm.globalita.tech`, con la PC prendida o apagada.

---

## Antes de empezar: dónde se escribe todo esto

**Todo se hace desde tu PC. En ningún momento hace falta «entrar» al servidor.**

Abrí **PowerShell**: tecla Windows, escribí `powershell`, Enter. Se abre una
ventana negra o azul con un cursor. Ahí se pegan los comandos, de a uno, y se
aprieta Enter después de cada uno.

Cada comando de abajo empieza con `ssh` o `scp`. Eso significa «hacé esto en el
servidor» o «mandá este archivo al servidor», pero **la ventana sigue siendo la
de tu máquina**: el comando va, se ejecuta allá, vuelve la respuesta, y el
cursor queda de nuevo en tu PC. No hay que salir de ningún lado.

Se pega **un bloque, se lee lo que contesta, y recién ahí el siguiente.**

---

## Parte 1 · Mover los datos

Lo que se sube es la copia consistente que ya está hecha:
**240 leads, 487 perfiles, 288 reuniones, 3.590 eventos**, integridad `ok`.

Se sube esa y no la base viva: copiar SQLite mientras PocketBase escribe puede
dar una copia rota. La copia se hizo con `VACUUM INTO`, que no.

### Paso 1 de 3 — apagar el CRM del servidor y guardar lo que hay

```powershell
ssh -i "$HOME\.ssh\bitacora_vps" root@45.90.108.64 "systemctl stop crm-globalita; cp -a /opt/crm-globalita/pb_data/data.db /opt/crm-globalita/pb_data/data.db.antes-de-migrar; echo PASO-1-OK"
```

**Tiene que contestar:** `PASO-1-OK`

Durante los próximos minutos `crm.globalita.tech` no va a responder. Es normal:
está apagado a propósito. Si contesta otra cosa, **parar acá** y mandarme lo
que dijo.

### Paso 2 de 3 — subir tu base

```powershell
scp -i "$HOME\.ssh\bitacora_vps" "$HOME\Projects\CRMGlobalita\.pb\copias\2026-09-10_091947-a-mano\data.db" root@45.90.108.64:/opt/crm-globalita/pb_data/data.db
```

**Tiene que mostrar** una barra de progreso que llega a `100%` y vuelve el
cursor. Son 2,2 MB: tarda unos segundos. Si no dice nada y vuelve el cursor,
también está bien — cuando el archivo es chico a veces no dibuja la barra.

### Paso 3 de 3 — limpiar y prender

```powershell
ssh -i "$HOME\.ssh\bitacora_vps" root@45.90.108.64 "mv /opt/crm-globalita/pb_data/data.db-wal /tmp/ 2>/dev/null; mv /opt/crm-globalita/pb_data/data.db-shm /tmp/ 2>/dev/null; chown crm:crm /opt/crm-globalita/pb_data/data.db; systemctl start crm-globalita; sleep 3; systemctl is-active crm-globalita"
```

**Tiene que contestar:** `active`

Los `-wal` y `-shm` son el diario de la base anterior. Dejarlos al lado de una
base distinta es la forma clásica de corromper una: SQLite los cree suyos.

### Y listo

Entrá a **https://crm.globalita.tech** y tienen que estar tus leads.

**Dos cosas cambian, y sorprenden si no se sabe:**

- **El panel de producción va a pedir las credenciales de tu base local**, no
  las que usabas allá. Los usuarios viajan adentro del archivo.
- **El SMTP de `finanzas@` ya va a estar cargado**, por lo mismo.

### Una cosa más, en la pantalla y no en la terminal

En **https://crm.globalita.tech/_/** → **Settings → Application** →
*Application URL* → escribir `https://crm.globalita.tech` y guardar.

Tu base local dice `http://localhost:8090`, y de ahí sale el enlace que lleva
el correo de invitación. Sin cambiarlo, ese enlace apunta a la máquina de quien
lo recibe.

### Si algo sale mal

La base anterior quedó guardada. Para volver atrás:

```powershell
ssh -i "$HOME\.ssh\bitacora_vps" root@45.90.108.64 "systemctl stop crm-globalita; cp -a /opt/crm-globalita/pb_data/data.db.antes-de-migrar /opt/crm-globalita/pb_data/data.db; systemctl start crm-globalita; systemctl is-active crm-globalita"
```

---

## Parte 2 · Trabajar contra el VPS

A partir de acá **el CRM es `https://crm.globalita.tech`**. La base local queda
para desarrollar y ya no es la de verdad — anotarlo en algún lado visible,
porque dos pantallas idénticas con datos distintos es la forma más fácil de
cargar algo donde no va.

---

## Parte 3 · Que las copias cierren

Hoy el VPS hace **una sola copia, en el mismo disco que los datos**. El propio
`backup.sh` lo avisa en cada corrida. Con la base de verdad allá, eso no
alcanza.

`deploy/backup-a-github.sh` sube la copia del VPS al repositorio **privado**
`Augustomu/globalita-data`, en la carpeta `vps/`, separada de las de la PC.

### 3.1 · Una llave de despliegue, no un token

Un token personal en el servidor abre **todos** los repositorios de la cuenta,
y ya pasó tener uno en texto plano. Una llave de despliegue sirve para **un**
repositorio: si alguien entra al VPS, se lleva acceso a las copias y no a la
cuenta.

**En el VPS:**

```bash
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64
sudo -u crm ssh-keygen -t ed25519 -N "" -f /home/crm/.ssh/globalita_data -C "crm-vps"
sudo -u crm cat /home/crm/.ssh/globalita_data.pub
```

Copiar lo que imprime y pegarlo en
**GitHub → repositorio `globalita-data` → Settings → Deploy keys → Add deploy
key**, con **«Allow write access» tildado**.

Después, para que `git` la use:

```bash
sudo -u crm bash -c 'cat >> /home/crm/.ssh/config <<EOF
Host github.com
  IdentityFile /home/crm/.ssh/globalita_data
  IdentitiesOnly yes
EOF'
sudo -u crm chmod 600 /home/crm/.ssh/config
sudo -u crm ssh -o StrictHostKeyChecking=accept-new -T git@github.com
```

Ese último tiene que contestar «Hi Augustomu/globalita-data! You've successfully
authenticated». Que diga *«does not provide shell access»* es normal.

### 3.2 · Subir el script y probarlo a mano

**Desde la PC:**

```bash
scp -i ~/.ssh/bitacora_vps deploy/backup-a-github.sh \
    root@45.90.108.64:/opt/crm-globalita/backup-a-github.sh
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64 \
    'chown crm:crm /opt/crm-globalita/backup-a-github.sh && chmod +x /opt/crm-globalita/backup-a-github.sh'
```

**En el VPS, una vez a mano** — antes de programarlo, para ver si anda:

```bash
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64
sudo -u crm bash /opt/crm-globalita/backup-a-github.sh
```

Tiene que terminar en «subido». Si falla, falla acá y no a las 3 de la mañana.

### 3.3 · Programarlo

```bash
cat > /etc/cron.d/crm-globalita-github <<'EOF'
30 3 * * * crm /opt/crm-globalita/backup-a-github.sh >> /opt/crm-globalita/backups/github.log 2>&1
EOF
chmod 644 /etc/cron.d/crm-globalita-github
```

**03:30**, quince minutos después del backup local de las 03:15. No a la misma
hora: si se pisan, el script sube una copia a medio escribir.

### 3.4 · Bajarla a la PC

Con eso la cadena queda: **VPS → GitHub privado → PC**. Para traerlas:

```bash
git clone git@github.com:Augustomu/globalita-data.git   # la primera vez
git -C globalita-data pull                              # después
```

Las del servidor están en `vps/`. Tres copias, en tres lugares distintos, y
ninguna depende de que la PC esté prendida.

---

## Lo que queda pendiente después de esto

- **Borrar el usuario de demo de producción** (`demo@globalita.test`): lo recrea
  una migración del seed en toda base nueva. Los borrados los hace Augusto.
- **Las cuentas**: producción tenía sólo `AC` y `DP`; la base que se sube trae
  las nueve. Después de migrar hay que confirmar que quedaron las nueve.
- **DKIM en Hostinger**, antes de invitar a alguien de afuera del equipo.
