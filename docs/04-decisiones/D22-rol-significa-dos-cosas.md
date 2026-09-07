---
tipo: decision
seccion: "§3.1 vs §3.11"
estado: abierta
impacto: 4-bajo
recomendada: "Renombrar el del perfil a cargo"
---

# D22 · `rol` significa dos cosas

**Problema.** En [[base-compartida]] `rol` es el cargo del perfil, y el filtro de la columna 1 lo llama "rol"; en [[usuario]] `rol` es Administrador/Colaborador.

**Recomendación.** Renombrar el del perfil a `cargo`, que es como ya se llama en [[lead]]. En la interfaz puede seguir diciendo "rol" si así lo lee el equipo. Cambiarlo ahora cuesta cero; después es un refactor.

