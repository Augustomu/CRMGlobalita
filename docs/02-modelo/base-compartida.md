---
tipo: entidad
seccion: "§3.11, §7.8"
etapa: 5
---

# Base compartida (perfiles ya invitados)

Tabla de todos los perfiles que **alguna** cuenta ya invitó, para que las cuentas no se pisen entre sí.

`{ nombre, link_perfil, rol, empresa, web, industria, pais, ciudad, resumen, cuenta, etapa, ultimo_r, duplicado_en[] }`

`duplicado_en` lista las otras cuentas que tienen el mismo perfil.

## La decisión estructural más grande del proyecto

Esto repite casi todos los campos de [[lead]]. Con 27.000 perfiles y 1.500 leads activos, la relación entre las dos tablas define el esquema entero. → [[D01-base-compartida-vs-lead]] y [[D02-clave-de-dedupe]]

## Pantalla

Buscador, filtro por cuenta y etapa, marca de duplicados. Nombre y empresa son links directos (perfil de LinkedIn, web de la empresa). Columnas separadas de Lugar y Resumen. Doble clic en "último R" abre el historial R1→R4 debajo de la fila.

