---
tipo: operacion
---

# Despliegue

**Decidido:** VPS de Hostinger. Todo corre ahí: base, API, web y los workers.

## Piezas

| Proceso | Qué hace |
|---|---|
| `api` | backend + auth + sirve la web construida |
| `worker-cola` | consume la cola de envíos: mensajes de cadencia, recordatorios, agradecimientos |
| `worker-cuenta-{abrev}` | una instancia por cuenta de LinkedIn/WhatsApp, aislada |
| `backup` | dump diario y subida fuera del VPS → [[backups]] |

## Pendiente de confirmar

- **Región del VPS** — São Paulo si está disponible, por [[riesgo-linkedin]].
- **Dominio y HTTPS** — sin dominio propio, las sesiones y el QR quedan sobre IP pelada.
- **Recursos** — los navegadores headless son lo que consume RAM: con 10 cuentas conviene medir con una antes de dimensionar.
