# @crm/web

La interfaz. React + Vite + TypeScript, contra la PocketBase de `packages/db`.

## Levantarlo

Hacen falta dos procesos:

```
npm run db:dev -- --seed     # PocketBase en :8090, con los datos de demo
npm run web:dev              # la interfaz en :5173
```

Entrar con `alberto@globalita.test` (administrador, ve los 8 leads) o
`sofia@globalita.test` (colaboradora, ve solo los 2 asignados). Clave `demo12345`.

## Qué hay construido

**Follow-up de la Etapa 1**, funcionando contra datos reales:

- **Login real.** No es decorativo: las colecciones exigen sesión, sin login no se
  lee ni un lead. Un cliente anónimo recibe lista vacía y 404 en el resto.
- **Columna 1 — lista.** Buscador por nombre/empresa/teléfono/ciudad, chips por
  cuenta, filtro "solo vencidos", borde ámbar en los que tienen mensajes sin leer.
- **Columna 2 — ficha.** Bloques colapsables, edición en vivo que persiste en
  PocketBase, botón de guardar que se habilita solo si hay cambios.
- **Permisos de verdad.** `verTodosLeads` se resuelve con `@crm/core/permisos` y
  se aplica **en la consulta**, no en el render: los leads ajenos ni siquiera
  viajan por la red.
- **Las reglas de core, en pantalla.** El badge "le toca hoy" sale de `tocaHoy()`,
  el chip de idioma de `idiomaEfectivo()`, el botón de WhatsApp de `linkWhatsApp()`.
  Si no hay teléfono válido, se muestra **tachado con el motivo**, no oculto (§9.7).
- **Los tres temas** (claro / oscuro / noche) desde `docs/design/tokens.css`.
- **Enviar mensaje (Etapa 2).** Arma el texto desde el repositorio, con el idioma
  sugerido y las variables ya resueltas; te lleva al chat real; y registra el envío
  aplicando todo §5.10 de una. La próxima fecha **se propone**: hay un botón para
  aceptarla y otro para registrar sin mover la fecha.
- **Historial de envíos** del lead, con paso, canal, idioma y plantilla usada.

## Qué NO hay todavía, y por qué

Esto es la primera pasada: funciona de verdad, pero no es el prototipo completo.

| Falta | Por qué |
|---|---|
| Columnas arrastrables | detalle de §7.2, no cambia lo que se puede hacer |
| Foto del lead (pegar del portapapeles) | el avatar muestra iniciales por ahora |
| Filtros de WhatsApp, reunión, rol, país, etiquetas | el popover existe; faltan esos grupos |
| Renderizar de a 80 con scroll infinito | con 8 leads de demo no se nota; hace falta antes de los 1.500 |
| Aviso de cambios sin guardar al cambiar de lead | §9.3 |
| Log de ediciones persistido | la pila de deshacer vive en memoria; falta la colección y D21 |
| Conversaciones (LinkedIn/WhatsApp) | falta D06 |
| Reunión y agenda | colección `reunion`, Etapa 3 |

No hay ningún botón que simule funcionar: lo que no está construido, no está puesto.

## Tamaño del texto

El prototipo está dibujado muy denso (9 a 13 px), que en pantallas reales queda
chico. Los tamaños originales se conservan pero multiplicados por una variable.
Para agrandar o achicar TODA la interfaz, cambiá un solo número en
:



Los altos fijos que acompañan al texto (header, avatares) usan la misma escala,
así nada se desborda.

## Fidelidad al prototipo

La maqueta sigue las medidas reales de `docs/prototipo/`: grid de filas en la
columna 1, hairlines de `.5px`, nombre del lead a 13px en la lista y 14px en la
ficha, chips pastilla de 10px, avatares circulares de 14px (lista) y 30px (ficha),
y `tabular-nums` en todo lo que sea número o fecha.

Si vas a tocar una pantalla, abrí primero su `.dc.html` — es la regla 6 del
`CLAUDE.md` de la raíz.

## Cómo se conecta con el resto

`vite.config.ts` apunta `@crm/core` directo a `packages/core/src`, sin paso de
build. Las reglas viven ahí y la interfaz solo las consume — nunca reimplementa
una regla de negocio (regla 1 del `CLAUDE.md` de la raíz).

`public/design-tokens.css` es una copia de `docs/design/tokens.css`. Si cambian
los tokens, hay que volver a copiarlo.
