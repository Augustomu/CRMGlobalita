---
tipo: operacion
---

# Backups

No es una feature: es lo que evita repetir la pérdida de datos de septiembre de 2026.

**Regla: tres copias de todo.** Local + GitHub + Drive. Un commit sin push no cuenta.

## Qué respaldar

| Qué | Dónde vive | Frecuencia |
|---|---|---|
| Base de datos | VPS | diaria, automática |
| Sesiones de LinkedIn/WhatsApp (perfiles de navegador) | VPS | semanal — recuperarlas evita revincular 10 cuentas por QR |
| Fotos y adjuntos | VPS | diaria |
| Código y vault | GitHub | en cada push |
| Variables de entorno y secretos | fuera del repo | manual, documentado |

## Qué verificar

Un backup que nunca se restauró no es un backup. Probar una restauración completa **antes** de cargar los 27.000 perfiles reales, y después una vez por trimestre.

