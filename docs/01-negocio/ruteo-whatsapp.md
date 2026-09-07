---
tipo: regla
seccion: "§5.8"
modulo: core/ruteo.ts
etapa: 2
---

# Ruteo de WhatsApp entrante

Cuando llega un mensaje de un número desconocido, se normaliza (→ [[normalizacion-telefono]]) y se busca contra `perfil.telefono` — una sola búsqueda, no una por lead. → [[D08-telefono-como-clave]]

## Los cuatro resultados

| Resultado | Qué pasa |
|---|---|
| **`desconocido`** | ningún perfil coincide. Queda como *entrante* en WA Personal, con tres salidas: **Mover a FU** (crea el lead y salta a Follow-up → Sin leer), **Es personal** (se queda como chat personal), **Agendar** (pide nombre y lo guarda en la agenda). |
| **`conocido_en_esta_cuenta`** | coincide un perfil que ya tiene lead en la cuenta que recibió el mensaje. El mensaje entra **solo al follow-up**: el lead pasa a `sin_leer_wa`. En WA Personal solo se muestra el aviso "Ya estaban en la base" con acceso a la ficha. **No se crea nada nuevo.** |
| **`conocido_otra_cuenta`** | coincide un perfil, pero sus leads son de otra cuenta (o no tiene ninguno). **No se auto-asigna**: queda como entrante, pero pre-identificado — la interfaz muestra quién es y con qué otra cuenta ya habla. "Mover a FU" acá crea un lead nuevo bajo esta cuenta, enlazado al mismo perfil. |
| **`ambiguo`** | el teléfono coincide con más de un perfil (dato sucio). Queda para elegir a mano, con los candidatos a la vista. Nunca se le cuelga el mensaje al lead equivocado. |

Un chat personal que después resulta de trabajo se pasa con **Mover a FU** desde el encabezado del chat y también desde la fila de la lista.

## Decisión cerrada

Las conversaciones de leads **no viven en WA Personal**. Están en la ficha y en la columna 1 del follow-up.

## Por qué cambió del diseño original

El manual proponía emparejar por los últimos 8 dígitos, con reglas de desempate cuando coincidía más de un lead. Al mudar el teléfono a `perfil` ([[D08-telefono-como-clave]]), el emparejamiento pasó a ser por el E.164 completo contra una identidad única: la ambigüedad por dígitos parecidos casi desaparece, y solo puede pasar si **dos perfiles distintos** de verdad comparten el mismo teléfono.

→ `packages/core/src/ruteo.ts`, 6 tests en `packages/core/test/ruteo.test.ts`
