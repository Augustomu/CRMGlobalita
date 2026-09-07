---
tipo: decision
seccion: "§3.11"
estado: cerrada
impacto: 1-bloqueante
resuelta: "slug y urn como claves únicas nullable, huella como sugerencia"
---

# D02 · Clave de dedupe

**Problema.** LinkedIn no da un solo identificador. La misma persona llega como URN de Sales Navigator, como slug público, o como URL con parámetros de campaña. Y los CSV pobres traen filas sin ningún link.

**Decidido (2026-09-06).** El [[D01-base-compartida-vs-lead|perfil]] guarda **tres** identificadores:

| Campo | Qué es | Índice |
|---|---|---|
| `slug` | el tramo de `/in/…` normalizado: minúsculas, sin querystring, sin barra final | único, nullable |
| `urn` | el id de Sales Navigator (`ACwAAA…`) | único, nullable |
| `huella` | `normalizar(nombre) + "|" + normalizar(empresa)` sin acentos ni puntuación | índice, **no** único |

## Algoritmo al dar de alta un perfil

1. **¿Coincide `slug` o `urn`?** Es el mismo perfil. Se completa el identificador que faltaba y se actualizan los campos vacíos. Este paso es el que une el perfil scrapeado de Sales Navigator con el mismo perfil importado por CSV.
2. **¿Coincide `huella`?** Entra igual, como perfil nuevo, marcado **posible duplicado** con link al candidato.
3. **Si no coincide nada.** Perfil nuevo.

**La fusión nunca es automática.** Un humano aprueba, y al aprobar se queda el perfil más viejo y se le cuelgan los leads del otro.

## Por qué no las otras dos

- **Exigir link** dejaría afuera a los referidos y a los entrantes de WhatsApp, que nunca traen LinkedIn. En los datos de demo, Gonzalo (AU, R4) llegó así y ya tuvo la reunión.
- **Nombre + empresa como clave única** fusiona homónimos de la misma empresa, y convierte a cualquiera que cambia de trabajo en un perfil nuevo al que se reinvita como desconocido.

## Consecuencia para la importación de CSV

La previsualización tiene que mostrar tres grupos antes de confirmar: **nuevos**, **ya conocidos** (coincide slug o urn: se actualizan, no se duplican) y **posibles duplicados** (coincide huella: entran, pero quedan marcados).
