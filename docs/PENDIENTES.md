# Pendientes

Lo que está decidido y todavía no está hecho, en orden de lo que más pesa.
`docs/DIVERGENCIAS.md` tiene el detalle de lo ya cerrado; acá va lo que falta.

Última revisión: 08/09/2026.

---

## 1 · El worker: lo único que hace que el CRM *actúe*

**`apps/worker/` está vacío.** Hoy el CRM registra lo que hacés a mano; no manda
un mensaje ni invita a nadie. Es la Etapa 5 del manual y la que el propio manual
marca como *«la de más riesgo técnico»* (§8.1).

| | Estado |
|---|---|
| **Cola del lado del servidor** (§10.16) | La colección está, la pantalla la muestra, la cuenta regresiva corre — **y nadie la procesa**. El único cron que existe es el barrido de retención |
| **LinkedIn** (§8.1) | No existe. Todos los envíos llevan `a_mano: true` |
| **WhatsApp** (§8.2) | No hay sesión ni QR real. No llegan entrantes ni acks |
| **Google Calendar** (§8.3) | Los hooks están escritos, la cuenta no está conectada: las 32 reuniones tienen `sync: "omitida"` |

Empezado: el cálculo del turno se extrajo a `core/cola.ts` (`turnosDeLote`,
`queSale`) para que el worker y la pantalla den **el mismo** turno. Sin eso la
cuenta regresiva muestra una hora y el mensaje sale a otra.

Lo que sigue: el bucle del worker, la interfaz de mensajero (CLAUDE.md: *«el
resto del sistema no sabe cómo se envía»*), un adaptador simulado que permita
verificar todo el circuito sin credenciales, y recién después los adaptadores
reales de LinkedIn y WhatsApp.

---

## 2 · Asignar un lead a más de una persona

**Pedido por Augusto el 08/09.** Hoy `lead.asignado` es una relación de uno.

No es sólo el campo: toca la ficha (el chip «Asignado a»), la lista (el filtro
por colaborador), Usuarios (asignación en lote y el reparto por cuenta), y el
alcance — `verTodosLeads` decide qué ve un colaborador, y la regla *«sin esto
sólo ve los leads asignados»* pasa a ser *«los leads donde figura»*.

Hay que decidir antes de tocarlo:

- ¿Los dos asignados son iguales, o hay un responsable y acompañantes? El
  modelo tiene `nivel_asignacion` (`seguimiento` / otro), que quizá ya sirva.
- §3.6 dice *«un lead sin asignación explícita pertenece al administrador»*.
  Con varios, ¿quién aparece en la columna 1, que tiene lugar para un chip?

---

## 3 · Las dos decisiones que están esperando a Augusto

- **«Estamos viendo el prototipo»** (§F.2 de DIVERGENCIAS). Propuse un octavo
  estado de proyecto en vez de una etiqueta. Dos preguntas abiertas: ¿cuenta
  como activo en la tarjeta? ¿se congela a los 30 días? Y una salvedad: si un
  proyecto puede estar *viendo el prototipo* **y** *esperando presupuesto* a la
  vez, entonces hace falta una etiqueta de proyecto, que hoy no existe.
- **«La parte de reuniones que aplica sólo para el perfil de Alberto Córdoba»**
  (§F.3). Sigo sin entender si es el partner de Seng viendo sólo lo de la
  cuenta AL, o el dashboard de reuniones filtrado por cuenta.

---

## 4 · La auditoría, ciclo 4

Los ciclos 1 a 3 están cerrados. Queda revisar contra el prototipo:
`FollowupDetalle` (la que más frases sin resolver tiene), `Login`, `ColaEnvios`,
`ImportarCsv` y `BaseCompartida`.

El método está montado como script y se vuelve a correr solo: extrae las frases
que el prototipo le muestra al usuario y busca cuáles no existen en el código.
No es prueba —una frase puede estar redactada distinto a propósito— pero es la
lista de dónde mirar.

---

## 5 · Producción

- **El deploy no se hizo.** `deploy/publicar.sh` necesita la IP del VPS y el
  visto bueno de Augusto.
- **Backups del VPS.** El backup actual depende de que la PC de Augusto esté
  prendida, y `globalita-data` no está en GitHub. Un snapshot diario del
  proveedor cubre el caso que el esquema de tres copias no cubre: que se rompa
  el servidor, no la PC. No reemplaza al backup a GitHub — el snapshot devuelve
  la máquina, no el historial.

---

## 6 · Lo que el manual deja para cuando exista el worker

No son omisiones: son cosas que necesitan una integración que todavía no está,
y que en pantalla ya se dicen.

- El **QR de WhatsApp** por cuenta (§7.10). El panel está y explica por qué no
  hay código todavía.
- Los **bloqueos de Google Calendar con su nombre** (§7.6). Los de otro
  calendario nunca van a llevar nombre: §6.3 dice que de un calendario ajeno se
  ve cuándo está tomado y nada más.
- El **hilo completo de la conversación** (§3.2). Hoy tiene lo sembrado y lo
  registrado; el resto llega cuando el worker lea los chats.
- «**Sin disponibilidad ese día**» en el panel de horarios: marca los días
  bloqueados enteros en Google Calendar. La función lo contempla y el argumento
  va en `false` hasta que la cuenta esté conectada.
