---
tipo: operacion
seccion: "§5.3, §8.1, §8.2"
---

# Sesiones caídas

Cada cuenta tiene dos sesiones independientes: **LinkedIn** (`estado_sesion`) y **WhatsApp** (`sesion_wa`, vinculada por QR).

Cuando una cae:

- La cuenta **queda en cero** y sus envíos **se acumulan**, no se pierden.
- La interfaz muestra el chip **"sesión caída"** y sugiere una **tarea automática** para revincular.
- El panel *Cuentas conectadas* ofrece el QR para volver a vincular.

En los datos de demo, **AMU** tiene la sesión de WhatsApp caída y 3 envíos frenados: es el caso que prueba estos avisos.

## Qué falta definir

Qué hace el worker con un envío programado cuya sesión está caída al momento de salir: ¿posponer, saltar, alertar? → [[D31-un-solo-planificador-por-cuenta]]

