# CRM Globalita

CRM de prospección saliente en LinkedIn y WhatsApp para un equipo de 4 personas.
Servicios industriales en LATAM y Brasil.

## Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `docs/MANUAL.md` | **La especificación entera.** Un solo archivo, numerado, con índice |
| `docs/PENDIENTES.md` | Lo decidido y todavía no hecho |
| `docs/prototipo/` | El prototipo en Design Components. **Fuente de verdad visual.** Entrada: `Dashboard.dc.html` |
| `apps/web/public/design-tokens.css` | Los 25 tokens de color y los 3 temas, extraídos del prototipo |
| `docs/manual-original.pdf` | El manual original de 26 páginas. Referencia histórica |
| `docs/_bundle/` | El prototipo empaquetado, tal como se subió. Solo respaldo |

## Cómo leer esto

Todo está en **`docs/MANUAL.md`**: un solo archivo, numerado, con su índice arriba.
No hace falta leerlo entero — se abre la sección que corresponde:

    grep -n "^## " docs/MANUAL.md     # el índice real
    sed -n '/^## 5\./,/^## 6\./p' docs/MANUAL.md

Su **§14** lista las 38 decisiones. Las cerradas no se rediscuten; las abiertas
son lo que falta definir antes de escribir código que dependa de ellas.

Hasta el 08/09/2026 esto estaba troceado en un vault de treinta notas más un anexo.
Se unificó porque se desincronizaron: el modelo de datos del manual describía una
tabla que ya no existía.

## Estado

**Etapa 1 andando.** Login, lista de leads y ficha editable, contra datos reales.
Las reglas de negocio viven en `packages/core` y la interfaz solo las consume.

| Ruta | Que es |
|---|---|
| `packages/core/` | Reglas de negocio como funciones puras, con 340 tests. `npm test` |
| `packages/db/` | Esquema de PocketBase. `npm run db:dev -- --seed` levanta una base local con los datos de demo |
| `apps/web/` | La interfaz. `npm run web:dev` la levanta en :5173. Ver su README |
| `deploy/` | Despliegue al VPS. Ver `deploy/README.md` |

Stack decidido: PocketBase + React/Vite + worker Node sobre VPS de Hostinger.
Ver D34 y D35 en §14 del manual.

22 decisiones cerradas, 16 abiertas, ninguna bloqueante.
