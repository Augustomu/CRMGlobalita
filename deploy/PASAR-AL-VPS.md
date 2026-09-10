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

## Parte 1 · Mover los datos

La copia consistente ya está hecha en `.pb/copias/2026-09-10_091947-a-mano/`:
**240 leads, 487 perfiles, 288 reuniones, 3.590 eventos**, integridad `ok`.

Se sube esa y no el archivo vivo: copiar una base SQLite mientras PocketBase
escribe puede dar una copia rota, y el `--copia` usa `VACUUM INTO`, que no.

**1.1 · En el VPS** — parar y guardar lo que hay:

```bash
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64
systemctl stop crm-globalita
cp -a /opt/crm-globalita/pb_data/data.db /opt/crm-globalita/pb_data/data.db.antes-de-migrar
exit
```

**1.2 · Desde la PC**, parado en `Projects/CRMGlobalita`:

```bash
scp -i ~/.ssh/bitacora_vps ".pb/copias/2026-09-10_091947-a-mano/data.db" \
    root@45.90.108.64:/opt/crm-globalita/pb_data/data.db
```

**1.3 · En el VPS** — limpiar los restos del diario y arrancar:

```bash
ssh -i ~/.ssh/bitacora_vps root@45.90.108.64
mv /opt/crm-globalita/pb_data/data.db-wal /tmp/ 2>/dev/null
mv /opt/crm-globalita/pb_data/data.db-shm /tmp/ 2>/dev/null
chown crm:crm /opt/crm-globalita/pb_data/data.db
systemctl start crm-globalita
systemctl is-active crm-globalita
```

Los `-wal` y `-shm` son el diario de la base anterior. Dejarlos al lado de una
base distinta es cómo se corrompe una: SQLite los cree suyos.

**Dos cosas cambian y conviene saberlas antes:**

- **El panel de producción va a pedir las credenciales locales.** Los usuarios
  y los superusuarios viajan dentro de la base.
- **El SMTP de `finanzas@` ya va a estar cargado allá**, por lo mismo.

**1.4 · Corregir la URL de la aplicación.** La base local dice
`http://localhost:8090`, y de ahí salen los enlaces de las invitaciones. En
`https://crm.globalita.tech/_/` → **Settings → Application** → *Application URL*
→ `https://crm.globalita.tech`. Sin esto, el enlace del correo apunta a la
máquina de quien lo recibe.

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
