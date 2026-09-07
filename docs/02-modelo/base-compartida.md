---
tipo: entidad
seccion: "§3.11, §7.8"
etapa: 5
---

# Base compartida (perfiles ya invitados)

Tabla de todos los perfiles que **alguna** cuenta ya invitó, para que las cuentas no se pisen entre sí.

`{ nombre, link_perfil, rol, empresa, web, industria, pais, ciudad, resumen, cuenta, etapa, ultimo_r, duplicado_en[] }`

`duplicado_en` lista las otras cuentas que tienen el mismo perfil.

## La decisión estructural más grande del proyecto — ya resuelta

Esto repetía casi todos los campos de [[lead]]. Quedó resuelto: la base compartida es la tabla **`perfil`**, y ya no es una tabla aparte que haya que sincronizar — es la identidad de la persona, compartida por las 10 cuentas. `duplicado_en[]` desapareció como campo: son los `lead` de ese mismo perfil, una consulta. → [[D01-base-compartida-vs-lead]], [[D02-clave-de-dedupe]]

El teléfono también vive acá, no en el lead: es dato de la persona, no de la relación con una cuenta puntual. → [[D08-telefono-como-clave]]

## Pantalla

Buscador, filtro por cuenta y etapa, marca de duplicados. Nombre y empresa son links directos (perfil de LinkedIn, web de la empresa). Columnas separadas de Lugar y Resumen. Doble clic en "último R" abre el historial R1→R4 debajo de la fila.

