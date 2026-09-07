---
tipo: entidad
seccion: "§3.2, §3.12"
etapa: 2
---

# Conversaciones, chat personal y entrantes

## En el lead

`mensajes_li[]` y `mensajes_wa[]`, cada mensaje `{ quien: 'in'|'out', texto, enviado_en, ack? }` con `ack` ∈ enviado / entregado / leído (solo WhatsApp).

## Chat personal

`{ nombre, telefono, mensajes[], no_leido }`. Amigos y familia. **No es un lead.**

## Entrante

`{ telefono, texto, recibido_en }` — mensaje de un número sin clasificar. Su ruteo está en [[ruteo-whatsapp]].

## Decisión cerrada

Las conversaciones de leads **no viven en WA Personal**. Están en la ficha y en la columna 1 del follow-up. WA Personal es solo amigos y familia, y por eso no lleva botón "Ignorar" ni etiqueta "Personal": la pestaña ya lo implica.

