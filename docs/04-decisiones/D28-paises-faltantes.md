---
tipo: decision
seccion: "§5.6"
estado: abierta
impacto: 3-medio
recomendada: "es como default regional"
---

# D28 · Países que faltan en el mapa de idioma

**Problema.** La lista `es` de [[idioma-sugerido]] deja afuera a Ecuador, Venezuela, Costa Rica, Panamá, Guatemala y el resto de Centroamérica: todos caen en inglés. Portugal tiene código telefónico en [[normalizacion-telefono]] pero no está en el mapa de idioma, así que también cae en inglés.

**Recomendación.** `pt` para BR, MZ, PT y AO. `es` para toda América Latina hispanohablante más España. `en` solo fuera de la región. Se implementa como lista de excepciones sobre un default `es`, no al revés.

