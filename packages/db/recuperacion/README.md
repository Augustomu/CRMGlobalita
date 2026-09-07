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
automatización de sesión, → `docs/05-operacion/riesgo-linkedin.md`). Conviene
dejarlo para cuando el worker de la Etapa 5 esté andando y probado.

De las 13.000 invitaciones, ~10% aceptó. Ese 10% es lo que hay que identificar,
y la única fuente son los hilos de conversación de cada cuenta.
