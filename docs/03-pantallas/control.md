---
tipo: pantalla
seccion: "anexo Control §4, §5"
prototipo: prototipo/Control.dc.html
modulo: apps/web/src/features/control/
etapa: 4
---

# Control de proyectos

Dos pestañas — **Proyectos** y **Reuniones** — y una regla que atraviesa todo:
**la sección entera es de solo lectura para cualquier rol**. Se edita en la ficha
del lead; acá se mira. El header lo declara con la pastilla.

Es lo único que ve el rol Observador (Alejandro, el socio de IT): le interesa qué
proyectos hay y cuántas reuniones salieron, no la prospección.

## Proyectos

Cinco tarjetas, dos filas de filtros rotuladas (Tipo y Estado, cada chip con su
conteo) y una tabla de **dos líneas por fila**:

- **Línea 1** — proyecto, tipo, estado, lugar, industria y rol, reuniones, última
  reunión, próxima acción.
- **Línea 2 — tira de avance**: carrusel horizontal. Primero las próximas
  acciones en ámbar, después las actualizaciones de la más nueva a la más vieja,
  después las notas. Lo primero que se ve es lo que falta hacer.

Al pie, la leyenda de los estados con la regla de cada uno. No es documentación
aparte: es parte de la pantalla, porque el estado Congelado lo pone el sistema y
hay que poder entender por qué.

Cliquear la fila abre el **panel del proyecto** a la derecha (720 px): la grilla
de datos, tres columnas (Notas · Actualización · Próximas acciones), las
reuniones numeradas y la nota de la ficha del lead textual.

## Reuniones

Período de 1, 3 o 6 meses; **todo** lo de abajo se recalcula al cambiarlo.

Ocho tarjetas, el gráfico por mes con la banda oscura de las que derivaron en
proyecto, diez agrupadores (incluidos día de la semana y franja horaria) y la
tabla del período.

Las reuniones futuras no cuentan: todavía no pasaron, y contarlas inflaría la
conversión con algo que no ocurrió.

## El Observador

Preset: `control` y `verTodosLeads`. Nada más. Cae en Control al entrar, porque
la sección inicial es la primera permitida y no `Follow-up` fijo.

Su header queda con dos controles. **Y los datos de prospección ni siquiera se
piden**: `useLeads`, las plantillas y las etiquetas se le pasan `null`. Tiene
`verTodosLeads` pero no `followup`, y §7 dice que no ve teléfonos, emails ni
links — si igual se bajaran, estarían en su navegador aunque ninguna pantalla los
dibuje.

## Lo que quedó afuera

El anexo describe la sección como solo lectura y no define cómo se cargan las
notas, actualizaciones y acciones de un proyecto. Hoy se crean al abrirlo desde
la ficha y después no hay dónde agregarles nada. **Falta esa pantalla**, y sin
ella los estados se quedan quietos y todo termina Congelado a los 30 días.

Relacionadas: [[proyectos-y-estados]] · [[permisos]] · [[metricas]]

## Un Control por negocio

Control **no es un permiso normal**: no se lo dás a un colaborador cualquiera,
se lo dás a alguien de **afuera** del equipo de prospección. Y hay dos afueras,
porque hay dos negocios:

| Línea | Nombre real | Cuentas |
|---|---|---|
| `ia` | **Globalita** | David, Alejandro, Edith, Francisco, Bruno |
| `inversiones` | **SENG** | Alberto Córdoba |

El socio de IT de Globalita no tiene por qué ver los proyectos de SENG, ni al
revés. Por eso al permiso se le suma un **alcance**: `users.linea_control`.

- Con `control` y **sin** línea → ve las dos, y elige cuál mirar con el switch
  del header.
- Con `control` y una línea → ve solo esa, y una pastilla dice cuál. No hay nada
  que elegir: el filtro se aplicó **al leer**, no al dibujar, así que los datos
  del otro negocio no llegan a su navegador.

**No se resolvió con dos claves de permiso** (`controlIa`, `controlInversiones`):
los permisos son sí/no y esto es un alcance. Con una tercera línea habría que
tocar el código en vez de cargar un dato.

La línea vive en la **cuenta**, y el proyecto y la reunión la heredan de ahí. Un
proyecto sin cuenta —o una cuenta sin línea— solo lo ve quien ve las dos: dárselo
a un limitado sería filtrarle trabajo del otro negocio, y ese es el único lado
del error que importa.
