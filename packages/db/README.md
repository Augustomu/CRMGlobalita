# @crm/db

Esquema de PocketBase. Una migración por cambio, en `pb_migrations/`.

## Colecciones de la etapa 1

| Colección | Qué guarda | Decisión |
|---|---|---|
| `perfil` | la persona: identidad, teléfono y `no_contactar`. Una fila por ser humano | D01, D02, D08, D33 |
| `lead` | la relación de trabajo entre una cuenta y un perfil | D01, D17 |
| `cuenta` | los 10 slots de LinkedIn/WhatsApp | — |
| `etiqueta` | catálogo libre | D04 |
| `envio` | historial de envíos: la base de la analítica | §3.2 |
| `plantilla` | el repositorio de mensajes, atado al paso por campo | D16 |
| `configuracion` | esperas, cupos, zona horaria. Nunca constantes | CLAUDE.md regla 2 |
| `users` | se le agregan rol, estado, permisos | §3.1 |

| `edicion` | el log de ediciones del perfil: campo, valor anterior, quién y cuándo | cambio 14 |

`edicion` **no se puede editar ni borrar por la API** (`updateRule` y
`deleteRule` en `null`): un historial que se puede reescribir no es un
historial. Revertir un cambio no borra la entrada, agrega otra en sentido
inverso.

Faltan las de etapas siguientes: `lista`, `tarea`, `chat_personal`,
`entrante`, `regla`, `actividad`.

## Índices que importan

- `perfil.slug` y `perfil.urn` son **únicos pero pueden estar vacíos** (índice parcial):
  un perfil puede llegar sin URL pública o sin URN, pero nunca dos con el mismo. → D02
- `perfil.huella` es índice común, **no único**: sugiere duplicados, no los impide. → D02
- `perfil.telefono` también es índice común, **no único**, por la misma razón: dos
  perfiles pueden compartir un teléfono por error de carga y eso no debe bloquear
  la escritura. → D08
- `lead (perfil, cuenta)` es único: un solo lead por par. → D27
- `lead (situacion, proximo_contacto)` es el índice de "¿a quién le toca hoy?". → D17

## Levantar una base local

```
npm run db:dev
```

Crea `.pb/` (fuera de git), aplica las migraciones y arranca PocketBase en
http://127.0.0.1:8090/_/ . Con `--seed` carga además los datos de demo.

## Los datos de demo

```
node packages/db/dev.mjs --reset --seed
```

Son inventados y sirven para mirar el diseño con la pantalla llena: 20 personas,
21 leads, 13 proyectos y 32 reuniones, en `pb_seed/`.

- `1788600100_demo.js` — los siete casos del manual (§12): uno por cada
  combinación de los dos ejes de D17, más el nombre larguísimo que prueba el
  truncado y la ficha a medio cargar.
- `1788601000_control_demo.js` — los proyectos y reuniones de
  `docs/prototipo/Control.dc.html`. **Las fechas se corren solas** al día en que
  se corre el seed, así que la foto es siempre la misma: los congelados siguen
  congelados y la reunión "de hoy" es hoy.

Todos entran con la clave `demo12345`:

| Usuario | Rol | Qué se mira con él |
|---|---|---|
| `alberto@globalita.test` | administrador | todo, las dos líneas de negocio |
| `sofia@globalita.test` | colaborador | Follow-up con leads asignados |
| `ignacio@globalita.test` | observador · Globalita | Control filtrado: 9 proyectos |
| `renata@globalita.test` | observador · SENG | Control filtrado: 4 proyectos |

Los dos observadores son el par que hace falta para comprobar que el alcance por
línea de negocio se nota: cada uno ve su negocio y **los datos del otro ni
siquiera llegan al navegador**.

La primera vez pide crear un superusuario desde la consola web.

**No usa la instalación de PocketBase que ya tenés en `~/pocketbase`**: copia el
ejecutable a `.pb/` y trabaja con su propia base, para no tocar los datos que ya viven ahí.


## Probar el correo de alta en desarrollo

El alta de usuario manda un correo (§6.7 del manual). En desarrollo hay dos
opciones:

**a) Sin SMTP.** Dar de alta falla y lo dice. Es el estado por defecto y está
bien para todo lo que no toque usuarios.

**b) Con un SMTP de mentira**, para ver el correo que sale. Cualquier servidor
que acepte la conversación SMTP en un puerto local sirve (MailHog, Mailpit, o
uno de veinte líneas en Node). Después, en `http://127.0.0.1:8090/_/` →
**Settings → Mail settings**: host `127.0.0.1`, el puerto que uses, sin TLS.

Lo que NO hay que hacer es apuntar el desarrollo al SMTP de Hostinger: los
correos saldrían de verdad, a direcciones de prueba que en general no existen,
y eso ensucia la reputación del dominio.
