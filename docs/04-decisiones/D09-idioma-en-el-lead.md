---
tipo: decision
seccion: "§5.6"
estado: cerrada
impacto: 3-medio
resuelta: "Campo idioma en el lead, con override; sin él manda la deducción por país"
---

# D09 · Idioma propio del lead

**Problema.** El idioma se deducía del país en cada escritura, y el override que hacía el usuario no quedaba guardado. Un brasileño radicado en México se sugería mal para siempre.

**Decidido (2026-09-07).** Campo `idioma` en el lead: vacío = usar [[idioma-sugerido|la deducción por país]]; cargado = manda, sin importar lo que diga el país. Se completa la primera vez que el usuario cambia el idioma al escribir. → `idiomaEfectivo()` en `packages/core/src/idioma.ts`
