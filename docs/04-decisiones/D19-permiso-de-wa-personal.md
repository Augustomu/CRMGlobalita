---
tipo: decision
seccion: "§6.1"
estado: abierta
impacto: 1-bloqueante
recomendada: "WA Personal es por usuario"
---

# D19 · WA Personal no tiene permiso

**Problema.** Las 12 claves no incluyen ninguna para WA Personal, y §4 dice que los tabs se calculan desde permisos. Con el preset actual, los 3 colaboradores ven el WhatsApp personal del administrador: amigos y familia. El modelo tampoco dice de quién es cada chat personal.

**Opciones.**
- **A. WA Personal es por usuario:** cada chat personal y cada entrante pertenece a la sesión de WhatsApp de quien lo recibió, y cada uno ve lo suyo.
- **B. Clave 13 `waPersonal`**, apagada por defecto.

**Recomendación: A**, que es lo que la gente espera de un WhatsApp. B como complemento si además se quiere restringir la pestaña entera.

