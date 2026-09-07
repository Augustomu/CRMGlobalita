---
tipo: decision
seccion: "§5.1"
estado: cerrada
impacto: 1-bloqueante
resuelta: "90 días desde el envío de R4; los 90 reemplazan la espera de 28"
---

# D15 · Fase 2: ¿+28 o +90?

**Problema.** La tabla de [[cadencia-r0-r8]] le da a R4 una espera de 28 días; el párrafo siguiente dice que después de R4 el próximo contacto se corre 90. ¿Se suman (118 días) o uno reemplaza al otro?

**Decidido (2026-09-06).** **90 días contados desde el envío de R4.** Los 90 reemplazan la espera de 28, que solo se usa si Fase 2 está apagada. Coincide con los "3 meses" del glosario.

## Cómo pasa en la práctica

Hoy **la mayoría de los R se mandan a mano**. Entonces, al enviar R4 desde la ficha (→ [[envio-de-mensaje]]):

1. Se registra el envío en `historial_envios`.
2. Se agrega la etiqueta **Fase 2** (y **Recordatorio**, por la regla de fábrica).
3. Se **propone** `proximo_contacto = fecha de envío + 90 días`. El usuario acepta o carga otra fecha.

Lo importante para el equipo es exactamente eso: **que la fecha se mueva y que quede la etiqueta**. Todo lo demás es consecuencia.

Cuando la automatización esté andando, hace lo mismo sin intervención: mismo cálculo, misma etiqueta, misma entrada en el historial. La diferencia es solo quién aprieta el botón.

## Consecuencia de diseño

La cadencia es, antes que nada, un **motor de recordatorios**: calcula a quién le toca hoy y con qué texto. La automatización de envío es una capa encima, no el corazón del sistema. Por eso [[vencimientos]] es una pantalla de primera línea y no un accesorio, y por eso [[D31-un-solo-planificador-por-cuenta]] importa menos de lo que parecía: si el volumen automático es bajo, la competencia por la sesión de LinkedIn es baja.
