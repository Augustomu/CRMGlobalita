import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * El selector de emojis del cuadro de escribir (§7.4).
 *
 * POR QUE ESTA ESCRITO ACA Y NO ES UNA LIBRERIA. Las librerías de emojis pesan
 * entre 200 KB y 2 MB, traen sus propios estilos —que hay que pelear para que
 * se parezcan al resto— y varias se bajan las imágenes de un CDN. Esto es una
 * grilla de caracteres: los emojis son texto, los dibuja el sistema operativo,
 * y así se ven exactamente como en WhatsApp porque **son la misma fuente del
 * sistema**.
 *
 * LAS CATEGORIAS SON LAS DE WHATSAPP y en el mismo orden, que es lo que pidió
 * Augusto el 11/09 mostrando la pantalla real: *«las opciones de emojis que te
 * muestra WhatsApp, y que el diseño de los mismos se mantenga»*. Un selector
 * con otras categorías o en otro orden obliga a volver a aprender dónde está
 * cada cosa.
 *
 * LOS RECIENTES SE GUARDAN POR NAVEGADOR. Es una preferencia de cómo trabaja
 * cada uno, igual que los anchos de las columnas: no tiene por qué viajar a la
 * base ni seguir a la persona entre máquinas.
 */

/**
 * Los emojis, por categoría.
 *
 * Es una selección, no el set completo: Unicode tiene más de 3.700 y la mayoría
 * no se usa nunca en una conversación de trabajo. Están los que aparecen en una
 * charla real, que es para lo que sirve esto.
 */
const CATEGORIAS: { icono: string; nombre: string; emojis: string[] }[] = [
  {
    icono: '🙂',
    nombre: 'Caras y personas',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨',
      '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕',
      '😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩',
      '😫','🥱','😤','😡','😠','🤬','👍','👎','👌','🤌','✌️','🤞','🤝','🙏','👏','🙌','💪','🫡','👋','🤙',
    ],
  },
  {
    icono: '🐶',
    nombre: 'Animales y naturaleza',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅',
      '🦉','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐢','🐍','🐙','🦑','🦐','🐡','🐠','🐟','🐬','🐳','🐋','🦈',
      '🌵','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🍁','🍂','🌾','🌷','🌹','🌺','🌸','🌼','🌻','🌞','🌝','🌚',
    ],
  },
  {
    icono: '🍔',
    nombre: 'Comida y bebida',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🥦',
      '🌽','🥕','🥔','🍞','🥐','🥖','🧀','🥚','🍳','🥞','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🍝',
      '🍜','🍣','🍤','🍦','🍰','🎂','🍫','🍬','🍿','☕','🍵','🧉','🍺','🍻','🥂','🍷','🥃','🍸','🧊','🥤',
    ],
  },
  {
    icono: '⚽',
    nombre: 'Actividades',
    emojis: [
      '⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥅','⛳','🏹','🎣','🥊','🥋','⛸️','🎿','⛷️','🏂',
      '🏋️','🤸','🤺','🤾','🏌️','🏄','🏊','🚴','🚵','🏆','🥇','🥈','🥉','🎖️','🎯','🎮','🎲','🎰','🎨','🎭',
      '🎤','🎧','🎼','🎹','🥁','🎸','🎺','🎻','🎬','🎉','🎊','🎈','🎁','🎀','✨','🎆','🎇','🧨','🪅','🎪',
    ],
  },
  {
    icono: '🚗',
    nombre: 'Viajes y lugares',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍️','🚲','✈️','🛩️','🚀',
      '🚁','⛵','🚤','🛳️','⛴️','🚢','🚂','🚆','🚇','🚉','🗺️','🧭','🏔️','🌋','🏖️','🏝️','🏜️','🏕️','🏠','🏢',
      '🏬','🏦','🏨','🏫','🏥','⛪','🕌','🗽','🗼','🏰','⛲','🌁','🌃','🌆','🌇','🌉','🌍','🌎','🌏','🧳',
    ],
  },
  {
    icono: '💡',
    nombre: 'Objetos',
    emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💾','💿','📷','📹','🎥','📞','☎️','📟','📠','📺','📻','🧭','⏰',
      '⏳','📡','🔋','🔌','💡','🔦','🕯️','🧯','🛢️','💸','💵','💴','💶','💷','💰','💳','🧾','💎','⚖️','🧰',
      '🔧','🔨','⚙️','🧲','🔫','💣','🔪','🚬','⚰️','🏺','🔑','🗝️','🚪','🛋️','🛏️','🚿','🛁','🧴','🧷','🧹',
      '📔','📕','📗','📘','📙','📚','📖','🔖','🧷','📎','📐','📏','✂️','🗃️','🗄️','🗑️','🔒','🔓','📝','✏️',
    ],
  },
  {
    icono: '❤️',
    nombre: 'Símbolos',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
      '✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐',
      '🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵',
      '✅','❌','❎','➕','➖','➗','✖️','♾️','‼️','⁉️','❓','❔','❕','❗','〰️','⚠️','🚸','🔱','⚜️','🔰',
    ],
  },
  {
    icono: '🏳️',
    nombre: 'Banderas',
    emojis: [
      '🏳️','🏴','🏁','🚩','🇦🇷','🇧🇷','🇲🇽','🇨🇱','🇨🇴','🇵🇪','🇺🇾','🇵🇾','🇧🇴','🇪🇨','🇻🇪','🇺🇸','🇨🇦','🇪🇸','🇵🇹','🇫🇷',
      '🇮🇹','🇩🇪','🇬🇧','🇨🇭','🇳🇱','🇧🇪','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇦🇹','🇬🇷','🇹🇷','🇷🇺','🇨🇳','🇯🇵','🇰🇷','🇮🇳','🇦🇺',
    ],
  },
];

const CLAVE_RECIENTES = 'crm.emojis.recientes';
const TOPE_RECIENTES = 24;

function leerRecientes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, TOPE_RECIENTES) : [];
  } catch {
    // Sin localStorage —ventana privada, permisos— el selector anda igual, sólo
    // que sin recientes. No es motivo para que no se abra.
    return [];
  }
}

export function Emojis({ onElegir, onCerrar }: { onElegir: (e: string) => void; onCerrar: () => void }) {
  const [cat, setCat] = useState(0);
  const [busca, setBusca] = useState('');
  const [recientes, setRecientes] = useState<string[]>(leerRecientes);
  const caja = useRef<HTMLDivElement | null>(null);

  /**
   * Se cierra al hacer clic afuera y con Escape.
   *
   * Las dos cosas, porque son dos costumbres distintas: quien usa el teclado
   * aprieta Escape y quien usa el mouse hace clic en cualquier lado. Un panel
   * que sólo se cierra con su × obliga a ir a buscarla.
   */
  useEffect(() => {
    const afuera = (e: MouseEvent) => {
      const donde = e.target as HTMLElement | null;
      // EL BOTON QUE LO ABRE NO CUENTA COMO «AFUERA». Sin esta línea el
      // mousedown lo cierra y el click que viene después lo vuelve a abrir: el
      // mismo botón que lo abre no lo puede cerrar nunca.
      if (donde && donde.closest('[data-emojis="boton"]')) return;
      if (caja.current && !caja.current.contains(donde)) onCerrar();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    // En el siguiente tic: si se escucha ya mismo, el mismo clic que lo abrió
    // lo cierra.
    const t = setTimeout(() => document.addEventListener('mousedown', afuera), 0);
    document.addEventListener('keydown', esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', esc);
    };
  }, [onCerrar]);

  /** Buscar mira el nombre de la categoría: los emojis no traen texto propio. */
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return CATEGORIAS[cat]!.emojis;
    return CATEGORIAS.filter((c) => c.nombre.toLowerCase().includes(q)).flatMap((c) => c.emojis);
  }, [busca, cat]);

  function elegir(e: string) {
    onElegir(e);
    const nuevos = [e, ...recientes.filter((x) => x !== e)].slice(0, TOPE_RECIENTES);
    setRecientes(nuevos);
    try {
      localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(nuevos));
    } catch {
      // Ídem: no poder guardar los recientes no rompe nada.
    }
  }

  return (
    <div className="emo" ref={caja}>
      {/* Las categorías arriba, como en WhatsApp. El reloj de los recientes va
          primero: es donde uno mira sin pensar. */}
      <div className="emo-tabs">
        <button
          type="button"
          className={`emo-tab ${cat === -1 ? 'emo-tab-on' : ''}`}
          title="Recientes"
          onClick={() => {
            setCat(-1);
            setBusca('');
          }}
        >
          🕘
        </button>
        {CATEGORIAS.map((c, i) => (
          <button
            key={c.nombre}
            type="button"
            className={`emo-tab ${cat === i && !busca ? 'emo-tab-on' : ''}`}
            title={c.nombre}
            onClick={() => {
              setCat(i);
              setBusca('');
            }}
          >
            {c.icono}
          </button>
        ))}
      </div>

      <input
        className="emo-busca"
        type="search"
        value={busca}
        placeholder="Buscar emoji"
        onChange={(ev) => setBusca(ev.target.value)}
      />

      <div className="emo-grilla">
        {(cat === -1 && !busca ? recientes : visibles).map((e, i) => (
          <button key={e + i} type="button" className="emo-uno" onClick={() => elegir(e)}>
            {e}
          </button>
        ))}
        {cat === -1 && !busca && !recientes.length && (
          <span className="campo-ayuda">Los que uses van a aparecer acá.</span>
        )}
      </div>
    </div>
  );
}
