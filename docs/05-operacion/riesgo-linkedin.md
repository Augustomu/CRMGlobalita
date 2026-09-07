---
tipo: operacion
seccion: "§8.1"
---

# LinkedIn: la integración crítica

**No hay API pública** para invitar y mandar mensajes. La implementación real es automatización de sesión: Playwright con contexto persistente, un proceso por cuenta.

## Lo que el diseño ya asume

- Las sesiones **se caen** y hay que mostrarlo (`estado_sesion`), acumular los envíos y avisar → [[sesiones-caidas]].
- Los **cupos diarios** existen para no gatillar límites de la plataforma. Son configurables porque el límite real cambia.
- La **cancelación a los 90 días** existe para liberar el tope de invitaciones pendientes.
- **Requisito:** los envíos corren del lado del servidor/worker, no en la pestaña del usuario. La cola tiene que sobrevivir a que el navegador esté cerrado. Si depende de la pestaña abierta, el producto no funciona.

## El riesgo de IP (decidido: VPS Hostinger)

Una sesión que siempre entró desde Argentina y de golpe opera desde un datacenter dispara verificación o bloqueo. Mitigaciones a aplicar desde el día uno:

1. **Región del VPS lo más cerca posible del uso real.** Hostinger tiene São Paulo: para cuentas que prospectan Brasil es lo más creíble.
2. **Una sesión por cuenta, aislada**, con su propio directorio de perfil y sus cookies persistidas. Nunca compartir contexto entre cuentas.
3. **Rampa de calentamiento:** arrancar en 10–15 invitaciones por día por cuenta y subir de a poco hasta 40. El `cupo_diario` ya es configurable justamente para esto.
4. **Horario humano:** los envíos se distribuyen en la franja laboral con intervalos irregulares, nunca en ráfaga.
5. **Vincular las cuentas por QR/login desde el VPS una sola vez** y no rotar IP después: lo que dispara alarmas es el cambio, más que la IP en sí.
6. **Proxy residencial por cuenta** queda como plan B si aparecen verificaciones, no como gasto inicial (~USD 5–15 por cuenta y mes).

Empezar por **una sola cuenta** durante dos semanas antes de mover las diez.

