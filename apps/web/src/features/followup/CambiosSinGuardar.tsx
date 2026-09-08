/**
 * El aviso al salir con cambios pendientes (§9.3). Portado de
 * `docs/prototipo/CambiosSinGuardar.dc.html`.
 *
 * El manual lo marca transversal desde el día uno, y es el único agujero del
 * sistema que puede hacer PERDER trabajo: hasta ahora cambiar de lead con la
 * ficha editada tiraba lo escrito sin preguntar.
 *
 * Son TRES salidas, no dos. «Descartar» y «Guardar y salir» hacen lo mismo
 * —irse— pero con destinos opuestos para lo escrito, así que ninguna de las dos
 * puede ser el botón por defecto: la tercera, quedarse, es la que no rompe
 * nada.
 */
interface Props {
  /** De quién es la ficha que se estaba editando. */
  nombre: string;
  onCancelar: () => void;
  onDescartar: () => void;
  onGuardar: () => void;
}

export function CambiosSinGuardar({ nombre, onCancelar, onDescartar, onGuardar }: Props) {
  return (
    <div className="overlay-fondo overlay-alto">
      <div className="csg-caja">
        <span className="csg-titulo">Tenés cambios sin guardar</span>
        <span className="csg-texto">
          Estabas editando <b>{nombre || 'este perfil'}</b>. Si salís sin guardar, esos cambios
          se pierden.
        </span>
        <div className="csg-botones">
          <button type="button" className="boton-secundario" onClick={onCancelar}>
            Seguir editando
          </button>
          <button type="button" className="csg-descartar" onClick={onDescartar}>
            Descartar
          </button>
          <button type="button" className="boton-principal" onClick={onGuardar}>
            Guardar y salir
          </button>
        </div>
      </div>
    </div>
  );
}
