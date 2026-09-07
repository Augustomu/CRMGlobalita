---
tipo: decision
seccion: "§5.3, §8.1"
estado: abierta
impacto: 1-bloqueante
recomendada: "Un planificador por cuenta con prioridades"
---

# D31 · Un solo planificador por cuenta

**Problema.** Invitaciones (40/día), cancelaciones (30/día) y mensajes de cadencia comparten **la misma sesión de LinkedIn**. Si son tres procesos independientes, se pisan y disparan justamente los límites que los cupos quieren evitar. Además nada dice qué hace el worker con un envío cuya sesión está caída.

**Recomendación.** Un único planificador por cuenta, que cada día arma el plan y lo ejecuta con intervalos irregulares en franja laboral, con este orden de prioridad:

1. Mensajes de cadencia vencidos (es trabajo comprometido con un lead que ya aceptó).
2. Avisos de reunión.
3. Cancelaciones.
4. Invitaciones nuevas, con lo que quede del cupo.

Con la sesión caída: nada sale, todo se acumula, se avisa y se crea la tarea. Al revincular, se reanuda respetando el cupo del día, sin ráfaga de recuperación.

