---
tipo: regla
seccion: "§5.6"
modulo: core/idioma.ts
etapa: 2
---

# Idioma sugerido

Se deduce del país del lead:

- **pt** — Brasil (BR), Mozambique (MZ)
- **es** — Argentina, México (MX), Uruguay, Chile, Colombia, Perú, Paraguay, Bolivia, España
- **en** — cualquier otro

Se aceptan **códigos ISO-2 y nombres completos**, porque los CSV llegan de las dos formas.

El idioma es una **sugerencia**: el usuario puede cambiarlo al escribir.

## Hueco conocido

La lista `es` deja afuera a Ecuador, Venezuela, Centroamérica y a Portugal (que sí figura en [[normalizacion-telefono]]): todos caen en inglés. → [[D28-paises-faltantes]]

El lead tampoco tiene campo `idioma` propio, así que un brasileño radicado en México se sugiere mal y no queda registrado el override. → [[D09-idioma-en-el-lead]]

