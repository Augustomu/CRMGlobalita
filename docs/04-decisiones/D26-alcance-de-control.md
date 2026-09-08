---
tipo: decision
estado: cerrada
seccion: "6.3.1"
impacto: alto
fecha: 2026-09-08
---

# D26 · El alcance de Control tiene tres formas, no dos

## La pregunta

Control muestra proyectos, reuniones y los leads que confirmaron interés. Hasta
ahora se recortaba de dos maneras: todo (administrador) o por **casa** (el
partner de Globalita o el de Seng).

Faltaba un caso que existe en la operación: **el dueño de una cuenta de
invitación** quiere ver Control como lo ve el partner, pero sólo de lo que salió
de su cuenta.

## La decisión

Tres alcances:

| Alcance | Quién | Qué ve |
|---|---|---|
| Todo | Administrador | Las dos casas, todas las cuentas |
| Por casa | Partner de una empresa propia | Sólo Globalita o sólo Seng, **sin** datos de contacto |
| Por cuenta | Dueño de una cuenta | Sólo lo suyo, **con** todos los datos |

## Por qué la visibilidad no es la misma

El partner por casa mira un negocio del que participa, pero **los leads no son
suyos**: §10.24 dice que no ve teléfono, email ni links. El dueño de cuenta
mira **sus propios leads**, los que él invitó — esconderle el teléfono de
alguien a quien le escribe todos los días no protege a nadie.

## Por qué es un alcance y no un permiso

Los permisos son sí/no. Esto es un recorte con un valor adentro —qué casa, qué
cuenta— y meterlo como permiso obligaría a una clave por cuenta.

Hoy existe `users.linea_control` para la casa. Falta el equivalente por cuenta.

## Lo que resuelve de paso

La pregunta que había quedado abierta sobre *«la parte de reuniones que aplica
sólo para el perfil de Alberto Córdoba»*. Es este mismo mecanismo: Alberto
acotado a la cuenta AL. No hacía falta una regla aparte para reuniones.

## Consecuencia

El alcance se aplica **en el servidor**, como el de la casa: reglas para las
filas, vistas para las columnas. Que la pantalla no dibuje un dato no sirve si
el dato llegó al navegador.
