---
tipo: decision
seccion: "§3.2 vs §3.11"
estado: abierta
impacto: 1-bloqueante
recomendada: "Una tabla perfil + lead que la referencia"
---

# D01 · Base compartida vs Lead

**Problema.** `base_compartida` repite casi todos los campos de [[lead]]. Con 27.000 perfiles y 1.500 leads activos, la relación entre las dos define el esquema entero. Nada dice si es tabla propia o proyección.

**Opciones.**
- **A. Una tabla `perfil` (las 27k, clave de dedupe) y `lead` como registro de trabajo que la referencia.** `duplicado_en[]` deja de ser un array a mantener y pasa a ser una consulta.
- **B. Dos tablas gemelas sincronizadas.** Hay que definir quién sincroniza a quién y cuándo.

**Recomendación: A.** Es la única que no puede quedar desincronizada. Condiciona [[D02-clave-de-dedupe]] y [[D27-mismo-perfil-dos-cuentas]].

