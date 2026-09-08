# Recuperación de datos

Se perdió la base vieja. Estas son las vías para reconstruirla, ordenadas por
lo que rinden contra lo que cuestan.

## 1. Google Calendar — hecho, y es la mejor

El sistema viejo escribía en cada evento:

```
Título:       Marcelo / Francisco / Augusto      (lead / cuenta origen / vos)
Descripción:  LinkedIn: https://www.linkedin.com/in/marcelomcarneiro
              PB_ID: r8w2vd3ithxi7qb             (el id del lead en la base vieja)
Invitado:     contactcenter40@gmail.com
```

De cada evento salen **nombre, cuenta de origen, perfil de LinkedIn, email y
fecha de reunión**. Son los leads que más valen: llegaron hasta la reunión.

```bash
node packages/db/recuperacion/importar-calendar.mjs            # simulacro
node packages/db/recuperacion/importar-calendar.mjs --aplicar  # escribe
```

Contra producción:

```bash
PB_URL=https://crm.globalita.tech PB_USER=... PB_PASS=... \
  node packages/db/recuperacion/importar-calendar.mjs --aplicar
```

Es **idempotente**: busca el perfil por `slug`/`urn` antes de crear, así que se
puede correr de nuevo sin duplicar.

### Lo que se recuperó de 31 eventos

| | |
|---|---|
| Personas distintas | 28 |
| Con perfil de LinkedIn usable | 24 |
| Con email | 21 |
| Cuentas de origen identificadas | Francisco, Edith, Bruno, Alejandro, David |

### Calidad de los links (por qué D02 hacía falta)

| Formato | Cantidad | Sirve |
|---|---|---|
| `/in/slug-limpio` | 18 | sí |
| `/in/acwaa…` (URN pegado como slug) | 5 | sí, es URN |
| `/sales/lead/…` | 1 | sí, es URN |
| `/in/manual-1784…` | 7 | **no**, es un placeholder sin perfil real |

## 2. El CSV de WhatsApp — pendiente

Trae nombre, cargo y país (BR / MX / MZ). No tiene link de LinkedIn, así que no
se puede unir por identificador: la unión es por **nombre + país**, que es una
coincidencia probable, no segura.

Por eso conviene importarlo **marcado como sugerencia**, igual que la `huella`
de D02: entra el dato, se marca "posible duplicado", y lo confirma una persona.

## 3. Las conversaciones de LinkedIn — lo último

Es lo más caro (hay que entrar cuenta por cuenta) y lo más riesgoso (es
automatización de sesión, → `§8.1 del manual`). Conviene
dejarlo para cuando el worker de la Etapa 5 esté andando y probado.

De las 13.000 invitaciones, ~10% aceptó. Ese 10% es lo que hay que identificar,
y la única fuente son los hilos de conversación de cada cuenta.

---

## 2. La base de contactos de WhatsApp — hecho

Export de Google Contacts, dos archivos: `gerentes.csv` (228) y
`consultores.csv` (20). **248 contactos.**

```bash
node packages/db/recuperacion/importar-contactos.mjs            # simulacro
node packages/db/recuperacion/importar-contactos.mjs --aplicar  # escribe
```

Entran como **perfiles, no como leads**: un lead es la relación entre una cuenta
y una persona (D01), y el CSV no dice de qué cuenta salió cada uno. Los leads se
crean al cruzar con el histórico del Calendar, que sí trae la cuenta de origen.

### Cómo se interpretan los nombres

El nombre trae el cargo y el lugar adentro, repartidos de cualquier forma entre
las columnas First / Middle / Last:

```
"Alexandre Jordão Gerente RJ BR"
 └── nombre ──┘ └cargo┘ └ciudad┘ └país
```

Se pegan las tres columnas y se corta en el cargo (`Gerente` o `Consultor`).

### El país sale del teléfono, no del nombre

La etiqueta del nombre miente en 7 de 248 casos:

| Contacto | Dice | El teléfono es de |
|---|---|---|
| Hugo Honwana | Brasil | Mozambique |
| Magno Silva | Mozambique | Australia |
| Junior Brito | Brasil | Portugal |
| Rudinei De Souza | México | Brasil |

El prefijo telefónico es un hecho verificable; la etiqueta es lo que alguien
escribió a mano. Gana el prefijo, y la discrepancia se reporta.

### Reparto real

| País | Contactos |
|---|---|
| Brasil | 165 |
| México | 52 |
| Argentina | 19 |
| Mozambique | 8 |
| Otros (NL, PT, AU) | 4 |

245 teléfonos válidos, 3 a revisar.

### Duplicados: 9 grupos, todos a verificación manual

Nunca se fusionan solos (D02). Dos clases distintas:

**La misma persona escrita de dos formas** — se pueden fusionar:
```
Thiago Gomes            +55 21 97007-xxxx
Tiago  Gomes            +55 21 97007-xxxx
Rafael Sampaio de Sá    +55 85 92006-xxxx
Rafael Sá               +55 85 92006-xxxx
```

**Dos personas distintas con el mismo teléfono** — NO se fusionan:
```
Mauricio Mantovani      +31 6 3179xxxx
Paul Goris              +31 6 3179xxxx
```

Ese último caso es exactamente por qué la fusión no puede ser automática: por
teléfono son idénticos y son dos personas. El importador los marca en
`posible_duplicado_de` y no toca nada más.

### Tolerancia a errores

Un contacto que falla no corta la importación: se anota cuál y por qué, y se
sigue. Al final se listan los que quedaron afuera.

---

## Correr esto contra producción

Los tres scripts entran por `entrar.mjs`. Contra la base local usan las
credenciales de demo; contra producción **piden la clave por teclado**, sin eco
y sin dejarla en el historial del shell.

```bash
PB_URL=https://crm.globalita.tech PB_USER=augusto.unzaga@outlook.com.ar \
  node packages/db/recuperacion/importar-contactos.mjs            # simulacro
```

Sacando `PB_URL` vuelven a apuntar a la base local. **Todos son simulacro por
defecto**: sin `--aplicar` no escriben nada, solo muestran lo que harían.

El orden importa:

1. `importar-calendar.mjs` — crea cuentas, perfiles y **leads**. Es la única
   fuente que dice de qué cuenta salió cada persona.
2. `importar-contactos.mjs` — agrega los perfiles del CSV de WhatsApp. Sin
   leads: el CSV no sabe de qué cuenta vino cada uno.
3. `detectar-duplicados.mjs --aplicar` — marca los que se pisan.
4. La bandeja de duplicados del CRM, a mano. La fusión la decide una persona.

Antes de escribir en producción, backup:

```bash
ssh root@45.90.108.64 'bash /opt/crm-globalita/backup.sh'
bash deploy/traer-backup.sh 45.90.108.64
```

### Los CSV no están en el repo

`gerentes.csv` y `consultores.csv` están en `.gitignore`: son 248 nombres y
teléfonos de personas reales y el repositorio es público. Viven solo en la
máquina de Augusto. Los ejemplos de este documento tienen los últimos dígitos
tapados por la misma razón.
