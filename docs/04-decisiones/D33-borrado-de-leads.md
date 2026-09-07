---
tipo: decision
seccion: "§10"
estado: cerrada
impacto: 3-medio
resuelta: "Descartar, no borrar. Y no_contactar a nivel perfil"
---

# D33 · Borrado de leads

**Problema.** No había borrado en ninguna pantalla, ni papelera, ni salida real para *No target* (que era solo una etiqueta). Con el reciclado cada 150 días, la base solo crece y un no-target vuelve a la cola una y otra vez.

**Decidido (2026-09-06), como consecuencia de [[D17-estado-de-cadencia]].** **Descartar, no borrar.** Dos niveles:

| Marca | Dónde vive | Alcance |
|---|---|---|
| `situacion = descartado` | el lead | esta cuenta no lo trabaja más |
| `no_contactar` | el perfil | ninguna de las 10 cuentas lo contacta, nunca |

- **Descartado** lleva motivo: no target, empresa equivocada, se fue de la empresa, pidió no ser contactado. Sale de todas las listas por defecto y **no se recicla nunca más**.
- **`no_contactar`** en el perfil descarta de una todos sus leads, en todas las cuentas. Es lo único que cumple de verdad un pedido de no contacto. → [[D01-base-compartida-vs-lead]]
- El perfil **sigue en la base compartida**: justamente para que ninguna otra cuenta lo vuelva a invitar. Borrarlo lo haría reaparecer en la próxima importación de CSV.

El borrado duro queda solo para pedidos explícitos de la persona, y borra el perfil y sus leads completos.
