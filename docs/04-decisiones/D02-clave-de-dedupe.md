---
tipo: decision
seccion: "§3.11"
estado: abierta
impacto: 1-bloqueante
recomendada: "URL normalizada del perfil, con fallback nombre+empresa"
---

# D02 · Clave de dedupe

**Problema.** `link_perfil` es lo único estable entre cuentas, pero LinkedIn devuelve slug público, URN y URLs con parámetros de campaña. Sin normalizar, el mismo perfil entra dos veces.

**Opciones.**
- **A. Normalizar la URL** (bajar a minúsculas, sacar querystring y barra final, quedarse con el slug de `/in/`) y usar eso como clave única.
- **B. Clave compuesta nombre + empresa** para los que llegan sin link (CSV pobres, referidos).

**Recomendación: A como clave, B como detector de sospechosos** que se marcan para revisión manual, nunca como merge automático.

