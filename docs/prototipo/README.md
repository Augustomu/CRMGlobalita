# El prototipo

Estos son los 27 componentes del prototipo, extraídos del bundle que está en `../_bundle/`.
Se versionan uno por uno para que git pueda mostrar los cambios: el bundle es un solo
archivo de 1,8 MB con todo comprimido en base64 y no sirve para revisar diferencias.

**Entrada: `Dashboard.dc.html`.** De ahí cuelgan los demás por `<dc-import name="...">`.

## Qué son

Design Components: HTML con `x-dc`, `sc-if`, `sc-for` y bindings `{{ }}`.
Es una **maqueta visual**, no código portable: no tiene estado, ni datos, ni lógica.

Sirve para dos cosas y solo dos:

1. **Referencia visual exacta** de cada pantalla mientras se construye la de verdad.
2. **Origen de los tokens** de `../design/tokens.css`, que sí son código y sí se usan.

Las reglas de comportamiento **no** se leen de acá: están en el vault, empezando por `../00-Mapa.md`.

## Inventario

| Componente | Pantalla |
|---|---|
| `Dashboard` | Header, tabs, overlays. La raíz. |
| `ListaContactos`, `FollowupDetalle`, `Conversaciones`, `EnviarMensaje` | Follow-up |
| `Colapsable`, `EditarLinks`, `PanelEtiquetas`, `LogEdiciones`, `AnalisisPerfil` | Bloques de la ficha |
| `Agenda`, `EventoAgenda`, `FechaReunion`, `ConfirmarReunion` | Agenda y reuniones |
| `Automatizaciones`, `ColaEnvios`, `Vencimientos` | Automatizaciones |
| `AdminUsuarios`, `Login` | Usuarios y sesión |
| `WhatsappPersonal`, `SesionesWa` | WhatsApp |
| `BaseCompartida`, `RepositorioMensajes`, `ReglasAcciones`, `Tareas` | Overlays |
| `ImportarCsv`, `CambiosSinGuardar` | Modales |

`support.js` es el runtime de Design Components. No se toca.

