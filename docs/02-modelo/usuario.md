---
tipo: entidad
seccion: "§3.1, §3.6, §6.5"
etapa: 6
---

# Usuario y asignación

`{ nombre, email (único, es el login), rol, estado, permisos, metodo_invitacion, invitado_en, ultimo_acceso }`

- **pendiente** = invitado por link y todavía no entró. No puede iniciar sesión hasta aceptar.
- **suspendido** = no puede iniciar sesión, pero sus leads y su actividad se conservan → [[D14-leads-al-suspender]].
- **Puede haber más de un Administrador.** Nada en el sistema debe asumir uno solo → [[D07-lead-sin-asignar]].

## Asignación

`asignacion: { lead_id → usuario_id }`. Reglas cerradas:

- Los leads son **compartidos**: el administrador siempre ve todos. No existe "devolver un lead al administrador".
- Un lead **sin asignación explícita** pertenece al administrador → ambiguo con varios admins, ver [[D07-lead-sin-asignar]].
- Un lead **creado por un usuario** (entrante de WhatsApp, importación de CSV) queda asignado a quien lo creó.

## Asignación masiva

Panel "Asignar en lote" en Usuarios: filtros combinables por cuenta (chips con conteo), país, ciudad e industria (los tres últimos son **checklists multi-selección**, no selects de un valor), buscador por nombre/empresa/cargo, y **"Seleccionar los N que coinciden"** que alcanza a todos los que pasan el filtro, no solo a los visibles. Check por fila para el uno por uno.

## Login

Usuario/email + contraseña. "Mantener la sesión abierta" la persiste localmente; si no, muere al cerrar.

