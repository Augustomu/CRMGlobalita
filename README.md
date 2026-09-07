# CRM Globalita

CRM de prospección saliente en LinkedIn y WhatsApp para un equipo de 4 personas.
Servicios industriales en LATAM y Brasil.

## Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `docs/` | El vault de Obsidian. **Fuente de verdad de las reglas.** Abrir `docs/00-Mapa.md` |
| `docs/prototipo/` | El prototipo en Design Components. **Fuente de verdad visual.** Entrada: `Dashboard.dc.html` |
| `docs/design/tokens.css` | Los 25 tokens de color y los 3 temas, extraídos del prototipo |
| `docs/manual-original.pdf` | El manual original de 26 páginas, del que salió el vault |
| `docs/_bundle/` | El prototipo empaquetado, tal como se subió. Solo respaldo |

## Cómo leer esto

Abrí la carpeta `docs/` como vault en Obsidian y arrancá por **00-Mapa**. El manual completo
está troceado en notas atómicas enlazadas: no hace falta leerlo entero para responder una pregunta.

El tablero de **decisiones abiertas** del mapa dice qué falta definir antes de escribir código.

## Estado

En definición. Todavía no hay código: primero se cierran las decisiones bloqueantes
de `docs/04-decisiones/`.

Stack decidido: PocketBase + React/Vite + worker Node sobre VPS de Hostinger.
Ver [D34](docs/04-decisiones/D34-stack-tecnologico.md) y [D35](docs/04-decisiones/D35-donde-corren-los-workers.md).

