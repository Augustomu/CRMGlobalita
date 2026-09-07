---
tipo: decision
seccion: "§5.2 vs §5.5"
estado: abierta
impacto: 1-bloqueante
recomendada: "Campo paso + variantes con una activa"
---

# D16 · Una plantilla por paso, o varias

**Problema.** §5.2 busca *la* plantilla cuyo nombre empieza con `R{n} · `, pero §5.5 quiere medir "qué variante convierte", lo que exige más de una por paso. Además, atar la cadencia al **nombre** —editable por el usuario— rompe los envíos en silencio cuando alguien renombra.

**Recomendación.** Campo `paso` en la plantilla (el nombre pasa a ser cosmético) y varias plantillas por paso, con una marcada **activa**. La automatización usa la activa; el resto queda como historial comparable. Si se quiere A/B real, se agrega después un reparto por porcentaje sin tocar el modelo.

