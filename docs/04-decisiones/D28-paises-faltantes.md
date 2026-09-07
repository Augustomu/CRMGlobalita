---
tipo: decision
seccion: "§5.6"
estado: cerrada
impacto: 3-medio
resuelta: "es y pt ampliados; en queda como default fuera de la región, no como lista propia"
---

# D28 · Países que faltan en el mapa de idioma

**Problema.** La lista `es` de [[idioma-sugerido]] dejaba afuera a Ecuador, Venezuela, Costa Rica, Panamá, Guatemala y el resto de Centroamérica: todos caían en inglés. Portugal tenía código telefónico en [[normalizacion-telefono]] pero no estaba en el mapa de idioma, así que también caía en inglés.

**Decidido (2026-09-07).**

- **`pt`**: Brasil, Mozambique, Portugal, Angola.
- **`es`**: toda América Latina hispanohablante (sumando Ecuador, Venezuela, Costa Rica, Panamá, Guatemala, Honduras, El Salvador, Nicaragua, República Dominicana, Cuba, Puerto Rico) más España.
- **`en`**: default para cualquier otro país. No es una lista que haya que mantener: es lo que queda cuando no matchea `pt` ni `es`, así que ningún país nuevo cae en inglés por un olvido de carga.

→ `idiomaSugerido()` en `packages/core/src/idioma.ts`
