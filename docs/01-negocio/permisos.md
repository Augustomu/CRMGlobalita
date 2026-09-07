---
tipo: regla
seccion: "§6"
modulo: core/permisos.ts
etapa: 6
---

# Permisos y roles

El rol es un **preset**, no una jaula. Cualquier permiso se prende o apaga por usuario.

## Las 12 claves

| Clave | Qué habilita |
|---|---|
| `verTodosLeads` | Sin esto, solo ve los leads asignados |
| `enviarMensajes` | Redactar y enviar desde la ficha |
| `colaEnvios` | Ver la cola de envíos |
| `importarLeads` | Importar CSV y carga masiva de teléfonos |
| `automatizaciones` | Sección Automatizaciones + panel de reglas |
| `vencimientos` | Vencimientos de mensajes |
| `repositorio` | Repositorio y mensajes destacados |
| `baseCompartida` | Base compartida de perfiles invitados |
| `cuentasConectadas` | QR y vincular números |
| `usuarios` | Usuarios y permisos + reasignar leads |
| `tareas` | Lista de tareas |
| `agenda` | Agenda propia y la del admin como ocupado |

## Resolución

```
puede(usuario, clave):
  si usuario.permisos tiene la clave explícita  → ese valor
  si usuario.rol == Administrador               → true
  si clave ∈ {tareas, agenda}                   → true   # preset colaborador
  en otro caso                                  → false
```

En la ficha del usuario cada permiso se muestra como "por rol" o "editado", con un botón para volver al preset (que es simplemente borrar los overrides).

**Qué tabs e iconos ve cada usuario se calcula desde los permisos, no desde el rol** (§4).

## Colaborador con el preset por defecto

Ve Follow-up, WA Personal, tareas, agenda, y **solo sus leads** (en la lista, en vencimientos y en notificaciones). No ve automatizaciones, base compartida, vencimientos, repositorio, cuentas conectadas, cola de envíos, importar CSV ni enviar mensajes.

Su agenda muestra sus reuniones más las de **cada administrador** como bloques *Ocupado* sin nombre ni detalle. Un switch elige qué calendario mira. → [[D18-ocupado-vs-nombre-del-evento]]

## Huecos conocidos

- WA Personal no tiene clave de permiso: con el preset actual todos los colaboradores ven el WhatsApp personal del administrador. → [[D19-permiso-de-wa-personal]]
- Un colaborador con `usuarios` puede darse a sí mismo las otras 11. → [[D20-escalada-de-privilegios]]

## Ver el CRM como otro usuario

Un administrador puede entrar a la vista de un colaborador desde el chip de sesión. No persiste entre recargas; "Volver a mi usuario" regresa. Es soporte, no suplantación auditada, aunque conviene registrarla en el log de actividad.

