---
tipo: decision
seccion: "§5.3"
estado: abierta
impacto: 3-medio
recomendada: "America/Argentina/Buenos_Aires para todo el sistema"
---

# D25 · Corte del día y de la semana

**Problema.** El cupo diario de 40 y el reset de los lunes 00:01 necesitan un huso, y las cuentas pueden operarse desde países distintos. Sin definirlo, el corte queda en la zona del servidor, que va a estar en Brasil o Estados Unidos.

**Recomendación.** Una zona horaria de operación para todo el sistema, configurable, con default `America/Argentina/Buenos_Aires`. Los cupos, el reset semanal y los "sale hoy" se calculan contra esa zona, no contra la del servidor ni la del navegador.

