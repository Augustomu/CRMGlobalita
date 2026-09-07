---
tipo: decision
estado: cerrada
impacto: 1-bloqueante
resuelta: "PocketBase + React/Vite + worker Node"
---

# D34 · Stack tecnológico

**Decidido.** PocketBase como base, auth, realtime y archivos. Frontend React + Vite + TypeScript sobre `design/tokens.css`. Worker propio en Node/TypeScript para la cola de envíos, Playwright (LinkedIn) y la sesión de WhatsApp.

**Por qué PocketBase alcanza.** 27.000 perfiles y 1.500 leads activos son nada para SQLite; auth, permisos por colección, realtime y subida de archivos ya vienen hechos; y el backup es copiar un archivo, que dada la historia del proyecto es una ventaja real.

**Los tres puntos donde no alcanza solo, y cómo se cubren.**

1. **La cola de envíos** no puede vivir en PocketBase: es una colección `cola_envios` que un worker Node consume por la API. PocketBase guarda el estado; el worker hace el trabajo.
2. **La analítica de [[metricas]]** no se expresa bien con los filtros de su API: se calculan en el worker y se guardan en colecciones `metricas_*` que la interfaz solo lee. Se recalculan de noche y a pedido.
3. **Los permisos de [[permisos]]** son más finos que las reglas de colección: la resolución vive en el backend propio, y las reglas de PocketBase quedan como segunda barrera.

