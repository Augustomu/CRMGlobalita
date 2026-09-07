---
tipo: regla
seccion: "anexo Control §2, §3, §6"
modulo: core/proyecto.ts
etapa: 4
---

# Proyectos y sus estados

La capa de arriba del lead: **el trabajo que se abre cuando la prospección ya
avanzó**. Una reunión puede terminar en una venta de Fabript/PIV, en una parcería
o en un prototipo, y eso no cabe en la etapa del lead (`R0`–`R8`).

Un lead puede tener **varios** proyectos. Un proyecto puede existir **sin** lead:
contactos anteriores a la prospección, referidos, ferias.

## Los siete estados

| Estado | Cuándo |
|---|---|
| Sin hablar | El proyecto existe pero todavía no hubo una conversación sobre él |
| En conversación | Hay ida y vuelta activo, sin propuesta formal enviada |
| Propuesta enviada | La pelota está del otro lado |
| Nuestra pelota | Nos falta hacer algo a nosotros |
| Congelado | Más de 30 días sin movimiento |
| Cerrado ganado | Se cerró y arrancó el trabajo |
| Cerrado perdido | Se cerró sin avanzar |

Los cuatro primeros son los **activos**, y son los que cuenta la tarjeta del
mismo nombre. Los dos cerrados son terminales: solo los cambia una persona.

## Congelado se calcula, no se guarda

El manual dice que cargar una actualización saca al proyecto de Congelado *y lo
devuelve al estado anterior*. Guardarlo obligaría a recordar cuál era ese estado,
y bastaría con que nadie corriera el proceso un día para que la pantalla mintiera.

`estadoEfectivo()` lo **deriva** del último movimiento. El estado real nunca se
pierde, y descongelar es automático: la actualización mueve la fecha y listo.

**Las acciones pendientes no cuentan como movimiento.** Son algo que todavía no
pasó, y un proyecto lleno de intenciones sin ejecutar es exactamente el que hay
que congelar.

## Nunca "sin reuniones" al lado de un número

`ultimaReunion()` distingue tres casos, y el tercero es el que se olvida: si hay
reuniones pero ninguna ocurrió todavía, la columna dice `programada DD/MM`, no
"sin reuniones". Es el criterio de aceptación 3 del anexo.

Ojo con la zona (ver [[reunion-y-avisos]] y D23): la base guarda en UTC, así que
una reunión de las 18:00 en México vuelve como las 00:00 del día siguiente. Si se
lee el texto crudo, la columna miente por un día y una reunión que ya pasó figura
como futura. Todo pasa por `enSuZona()`.

## De lead a proyecto

Es **manual y explícito**, desde la ficha (§6): *Abrir proyecto Fabript/PIV* o
*Abrir proyecto de parcería*. Copia empresa, contacto, lugar, industria, rol,
cuenta, responsable y la nota de la ficha; arranca **En conversación** con su
primer registro de actualización.

Por qué manual: un lead que acepta y responde todavía no es un proyecto, y
muchos quedan en la nada. Si se creara solo al agendar una reunión, Control se
llenaría de proyectos vacíos y el conteo de Activos dejaría de significar algo.

Abrir dos veces el mismo tipo sobre el mismo lead no duplica: reemplaza.

Relacionadas: [[permisos]] · [[metricas]] · [[control]]
