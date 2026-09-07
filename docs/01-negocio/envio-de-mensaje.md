---
tipo: regla
seccion: "§5.10"
modulo: core/envio.ts
etapa: 2
---

# Al enviar un mensaje desde la ficha

El envío es **una operación compuesta**. Todo esto pasa en un solo paso:

1. Se registra la entrada en `historial_envios` (paso, timestamp, canal, plantilla, idioma, texto).
2. Se agrega la etiqueta **Recordatorio** (regla de fábrica → [[reglas-de-fabrica]]).
3. Si el paso empuja a Fase 2, se agrega la etiqueta **Fase 2**.
4. Se **propone** la próxima fecha de contacto según la cadencia — el usuario la acepta o la carga a mano. **No se fija sola.**
5. Todo lo anterior entra a la pila de deshacer como **una sola edición**.

## Hueco conocido

El mensaje ya salió por LinkedIn o WhatsApp: "deshacer" no puede revertirlo. → [[D21-deshacer-un-envio]]

