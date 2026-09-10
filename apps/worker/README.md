# @crm/worker

El proceso que **hace** lo que el CRM planifica. Hoy hace una sola cosa: mandar
las invitaciones de LinkedIn (§5.3, §8.1 del manual).

Hasta que esto existió, el CRM registraba lo que se hacía a mano y nada más —
era el bloqueante 8.2 de `docs/PENDIENTES.md`.

## Qué hace, exactamente

Una corrida de invitaciones para **una cuenta**:

1. Le pregunta a la base qué cuentas hay, qué listas, cuánto salió hoy y cómo
   está configurado el ritmo.
2. Le pregunta a `@crm/core/invitar` **a quién le toca** y **si puede operar**.
   Si hay un impedimento —pausa general, freno de LinkedIn, fuera de horario,
   sesión caída, sin perfil de Chrome, cupo cumplido, sin material— lo dice y
   se va **sin abrir el navegador**.
3. Abre Chrome con el perfil de esa cuenta, espera unos segundos sin hacer nada,
   y recién ahí abre la búsqueda guardada.
4. Por cada perfil: lo mira, invita, y anota la invitación **en la base**.
5. Entre uno y otro espera lo que diga core: la espera irregular, la pausa media,
   la pausa larga, el reinicio del navegador y el tope de la corrida.
6. Cada vez que LinkedIn contesta, escribe `cuenta.ultima_senal_li`. Eso es lo
   que hace que la pantalla de Cuentas conectadas diga la verdad: hasta ahora
   todas figuraban «sin vincular» porque nadie escribía esa señal.
7. Si LinkedIn avisa algo —captcha, actividad inusual, automatización, cuenta
   restringida— **corta**, escribe el freno en la cuenta y, si es grave, deja la
   automatización en pausa. No insiste.

**No cancela invitaciones.** Es a propósito: por ahora sólo la lógica de
invitaciones. La cancelación de §5.4 es otra corrida y otro riesgo.

## Cómo se corre

```
node apps/worker/src/invitar.ts <ABREV>          # una cuenta: AL, FR, ED…
node apps/worker/src/invitar.ts <ABREV> --simular  # no toca LinkedIn ni la base
```

`--simular` es la forma de probar que la decisión está bien sin abrir nada:
imprime a quién le toca, cuántas van a salir y con qué ritmo, y termina.

**Una cuenta por vez, y una sola corrida a la vez.** No hay `--todas` a
propósito: seis procesos de navegador en paralelo sobre dos cuentas es la causa
confirmada del aviso que LinkedIn le mandó a Francisco el 12/05/2026. El propio
proceso se niega a arrancar si detecta otro corriendo.

## Qué necesita

| | |
|---|---|
| **Node** | 24 o superior. Ejecuta los `.ts` sin compilar, igual que `packages/core`. |
| **Dependencias** | `npm install` en la raíz (instala `playwright` y `pocketbase` en el workspace). Hasta que se corra, `npm run revisar --workspace @crm/worker` no puede verificar los tipos: le faltan `playwright` y `@types/node`. |
| **Navegador** | Chrome de verdad, el instalado, no el Chromium de Playwright. |
| `PB_URL` | Dónde contesta PocketBase. Default `http://127.0.0.1:8090`. |
| `PB_USER` / `PB_PASS` | Con qué usuario entra a la base. Contra la base local hay valores de demo; contra producción no hay ninguna clave guardada en el repo, se pide por teclado. |
| `CHROME_USER_DATA` | La carpeta `User Data` de Chrome. Si no se pasa, se busca en la ruta habitual de Windows. |

Y en la base, cargado desde la pantalla de Automatizaciones:

- `cuenta.chrome_perfil` — con qué perfil de Chrome se abre esa cuenta
  («Default», «Profile 1»…). Sin esto el proceso **no arranca**: abriría un
  navegador sin sesión, o el de otra cuenta, y en LinkedIn eso deja rastro.
- `lista_invitacion.origen_id` — de dónde salen los perfiles de esa lista: el
  `savedSearchId` de la búsqueda guardada. **Vive en la base y nunca en un
  archivo del repositorio**, porque este repositorio es público (§13.4). Se
  guarda el id y no la dirección: las URL copiadas del navegador traen `lipi` y
  `snfl` de la sesión que las generó y envejecen mal. La dirección la arma
  `urlDeLista()` de `@crm/core/invitacion`; el worker sólo le agrega la página.
- `lista_invitacion.paginas` — cuántas páginas tiene. Mientras esté en 0 la
  lista figura agotada y no sale nada, que es lo correcto: una lista cuyo tamaño
  nadie midió no puede prometer invitaciones.

### Chrome tiene que estar cerrado

Playwright abre el perfil con `--profile-directory`, y Chrome bloquea la carpeta
del perfil mientras está abierto. Si Chrome está corriendo con ese perfil, la
corrida falla con un error de perfil en uso. Cerrarlo antes.

## Cómo está partido, y por qué

| Archivo | Qué hace |
|---|---|
| `src/invitar.ts` | El orquestador. **No decide nada**: le pregunta a core y ejecuta. |
| `src/seguridad.ts` | El chequeo previo. Junta los hechos —procesos corriendo, hora, estado de la cuenta— y le pregunta a core si se puede. |
| `src/base.ts` | Lo único que habla con PocketBase: leer el estado, anotar la invitación, tocar la señal, escribir el freno. |
| `src/navegador.ts` | Lo único que abre Chrome. Los gestos que hacen que la sesión no parezca un robot. |
| `src/salesnav.ts` | Lo único que sabe del DOM de Sales Navigator: los botones, los carteles de bloqueo, la paginación. |

**Ninguna regla de negocio vive acá.** El cupo, el ritmo, las pausas, el tope, la
franja horaria y la gravedad de cada aviso están en `packages/core/src/invitar.ts`
con sus tests, que corren sin navegador y sin base. Si mañana hay que cambiar
cada cuánto se reinicia el navegador, se cambia en la configuración; si hay que
cambiar la regla, se cambia en core y el test lo dice.

Los selectores del DOM sí viven acá, y van a romperse: LinkedIn cambia su HTML
cuando quiere. Por eso están en un solo archivo y no repartidos.

## Lo que todavía no hace

- **No escribe nota en la invitación.** El texto de R0 sale del repositorio de
  mensajes (§5.2) y hay que decidir si va con nota o sin nota. Hoy invita sin nota.
- **No maneja el «pedime el correo»**, el caso en que LinkedIn exige el email
  para poder invitar. En el repositorio viejo eso era el paso F6 y tenía su
  propia cola. Acá el perfil se salta y queda anotado en la corrida.
- **No cancela** (§5.4), no manda mensajes (§5.1 R1–R8) ni toca WhatsApp.
- **No corre solo.** No hay tarea programada todavía: se dispara a mano.
