---
tipo: decision
seccion: "§5.8"
estado: abierta
impacto: 2-alto
recomendada: "Índice por últimos 8 dígitos, desempate manual"
---

# D08 · Teléfono como clave de ruteo

**Problema.** [[ruteo-whatsapp]] enruta por los últimos 8 dígitos. Si dos leads coinciden, el ruteo es ambiguo; y nada dice si el teléfono puede repetirse entre leads, ni qué pasa si además coincide con un chat personal.

**Recomendación.** Índice sobre los últimos 8 dígitos, con estas reglas de desempate: si coincide **un** lead, va al follow-up; si coinciden **varios**, queda como entrante con la lista de candidatos para elegir; un chat personal existente gana sobre un lead (ya fue clasificado por una persona).

