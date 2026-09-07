---
tipo: decision
seccion: "§6.2"
estado: abierta
impacto: 2-alto
recomendada: "No editar los permisos propios; solo admin otorga `usuarios`"
---

# D20 · Escalada de privilegios

**Problema.** El permiso `usuarios` habilita "usuarios y permisos". Un colaborador con esa clave puede darse a sí mismo las otras 11.

**Recomendación.** Dos guardas: nadie edita sus propios permisos (ni siquiera un administrador: lo hace otro), y solo un usuario con rol Administrador puede otorgar la clave `usuarios`. Ambos cambios quedan registrados en el log de actividad con tipo `permiso`.

