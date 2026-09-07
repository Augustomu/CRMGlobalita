---
tipo: decision
seccion: "§5.6"
estado: abierta
impacto: 3-medio
recomendada: "Campo idioma con override"
---

# D09 · Idioma propio del lead

**Problema.** El idioma se deduce del país en cada escritura, y el override que hace el usuario no queda guardado. Un brasileño radicado en México se sugiere mal para siempre.

**Recomendación.** Campo `idioma` en el lead: vacío = usar la deducción de [[idioma-sugerido]]; cargado = manda. Se completa solo la primera vez que el usuario cambia el idioma al escribir.

