interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
  /** Oculta esta columna en pantallas angostas (`< sm`, 640px) — para
   * columnas secundarias (ej. teléfono) que no son críticas para
   * identificar la fila, en vez de forzar scroll horizontal para verlas.
   * El scroll horizontal (ver el wrapper de abajo) sigue como respaldo
   * genérico para cualquier tabla que tenga más columnas de las que caben,
   * hayan marcado `hideOnMobile` o no. */
  hideOnMobile?: boolean;
  /** Fija esta columna al borde derecho de la tabla mientras el resto hace
   * scroll horizontal por debajo — pensado para "Acciones", para que en
   * pantallas angostas con varias columnas siga alcanzable sin tener que
   * desplazarse hasta el final para encontrarla. */
  stickyRight?: boolean;
  /** Centra el texto del encabezado (`<th>`) — pensado para columnas cuyo
   * `render` ya centra su contenido con `justify-center` (ej. "Acciones"
   * con varios botones), para que el título quede alineado con lo que
   * renderiza en vez de quedar pegado a la izquierda por el `text-left`
   * default de la tabla. No afecta la celda (`<td>`) — el centrado del
   * contenido de la celda sigue siendo responsabilidad del `render` de
   * cada columna, no de `DataTable.tsx`. */
  centerHeader?: boolean;
}

interface DataTableProps {
  columns: Column[];
  rows: any[];
  loading: boolean;
  emptyMessage: string;
}

export default function DataTable({ columns, rows, loading, emptyMessage }: DataTableProps) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-left">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`p-3 whitespace-nowrap ${c.hideOnMobile ? "hidden sm:table-cell" : ""} ${
                    c.stickyRight ? "sticky right-0 z-10 bg-neutral-50 border-l border-neutral-200" : ""
                  } ${c.centerHeader ? "text-center" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-neutral-400">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-neutral-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row._id || i} className="border-t border-neutral-50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`p-3 ${c.hideOnMobile ? "hidden sm:table-cell" : ""} ${
                      c.stickyRight ? "sticky right-0 z-10 bg-white border-l border-neutral-200" : ""
                    }`}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
