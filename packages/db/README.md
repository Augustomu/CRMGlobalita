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
| `configuracion` | esperas, cupos, zona horaria. Nunca constantes | CLAUDE.md regla 2 |
| `users` | se le agregan rol, estado, permisos | §3.1 |

Faltan las de etapas siguientes: `plantilla`, `reunion`, `lista`, `tarea`,
`chat_personal`, `entrante`, `regla`, `actividad`.

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
http://127.0.0.1:8090/_/ . Con `--seed` carga además los datos de demo del manual.

La primera vez pide crear un superusuario desde la consola web.

**No usa la instalación de PocketBase que ya tenés en `~/pocketbase`**: copia el
ejecutable a `.pb/` y trabaja con su propia base, para no tocar los datos que ya viven ahí.

