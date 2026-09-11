import { useEffect, useState } from 'react';
import { toString as aSvg } from 'qrcode';

/**
 * El QR de WhatsApp, dibujado en la pantalla del CRM (§8.2).
 *
 * POR QUÉ ACÁ Y NO SÓLO EN LA TERMINAL. `whatsapp.ts vincular` ya lo dibuja con
 * caracteres, y sirve — pero obliga a tener la terminal a mano para algo que se
 * hace con el teléfono. Augusto lo pidió así: *«quiero que sumes el QR dentro
 * del CRM para que funcione como WhatsApp Web»*. Vincular es exactamente eso:
 * una pantalla con un código y un teléfono que lo mira.
 *
 * EL QR NO LO GENERA ESTA PANTALLA. Lo emite la sesión de Baileys, que vive en
 * el worker, y llega por la base: el worker escribe `cuenta.qr_wa`. Acá sólo se
 * dibuja. Es la misma separación de siempre —el worker hace, la pantalla
 * muestra— y es lo que permite que el QR aparezca sin que el navegador sepa nada
 * de WhatsApp.
 *
 * SE DIBUJA COMO SVG Y NO COMO CANVAS. Un SVG escala sin verse borroso, se ve
 * igual en los tres temas, y —lo que importa para esto— **se puede escanear de
 * una pantalla con zoom**, que es lo que hace uno cuando el código le queda
 * chico.
 */
/**
 * Los dos colores del código, leídos de los tokens.
 *
 * Son los mismos en los tres temas y están declarados en
 * `design-tokens.css` como `--qr-oscuro` y `--qr-claro`, con el motivo escrito
 * al lado. Se leen de ahí en vez de escribirlos acá para que haya UN solo lugar
 * donde están, que es la regla 5 de CLAUDE.md; el respaldo es para el caso en
 * que este componente se dibuje antes de que el CSS haya cargado.
 */
function tokenDeColor(nombre: string, respaldo: string): string {
  if (typeof getComputedStyle !== 'function') return respaldo;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v || respaldo;
}

export function CodigoQr({
  texto,
  lado = 220,
}: {
  /** El código crudo que emitió Baileys. */
  texto: string;
  lado?: number;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setError(null);
    if (!texto) {
      setSvg(null);
      return;
    }

    aSvg(texto, {
      type: 'svg',
      // Sin margen propio: el margen lo pone la caja de alrededor, y dos
      // márgenes sumados dejan el código más chico de lo necesario.
      margin: 1,
      width: lado,
      // OSCURO SOBRE CLARO SIEMPRE, aunque el CRM esté en tema oscuro o en
      // noche. Un QR con los colores invertidos no lo lee la mitad de los
      // teléfonos, y el que no lo lee no dice por qué: se queda mirando. Estos
      // dos colores son del CÓDIGO y no de la pantalla, y por eso son los
      // únicos tokens que no se redefinen por tema.
      color: {
        dark: tokenDeColor('--qr-oscuro', '#000000'),
        light: tokenDeColor('--qr-claro', '#ffffff'),
      },
    })
      .then((d) => {
        if (vivo) setSvg(d);
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      vivo = false;
    };
  }, [texto, lado]);

  if (error) {
    return (
      <span className="campo-ayuda">
        No se pudo dibujar el código: {error}. Está igual en la terminal, con{' '}
        <code>node apps/worker/src/whatsapp.ts vincular</code>.
      </span>
    );
  }

  if (!svg) return <span className="campo-ayuda">dibujando el código…</span>;

  // El SVG viene de `qrcode`, no de la base: es una forma geométrica armada a
  // partir del texto, sin nada de lo que entró. El texto del QR ya se validó
  // como tal al generarlo — si no fuera un QR válido, `aSvg` habría fallado.
  return (
    <span
      className="cc-qr-svg"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="Código QR para vincular WhatsApp"
      role="img"
    />
  );
}
