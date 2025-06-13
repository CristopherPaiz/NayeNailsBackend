export const filtrarDiseniosConFiltros = async (filters) => {
  const { search = '', ...categoryFilters } = filters

  const db = await getDb()
  if (!db) return null

  let diseniosBaseSql = `
      SELECT
        d.id, d.nombre, d.descripcion, d.imagen_url, d.precio, d.oferta, d.duracion, d.activo, d.imagen_public_id
      FROM Disenios d
      WHERE d.activo = 1
    `
  const sqlArgsBase = []

  const searchTerm = search ? `%${search.toLowerCase()}%` : null
  if (searchTerm) {
    diseniosBaseSql +=
      ' AND (LOWER(d.nombre) LIKE ? OR LOWER(d.descripcion) LIKE ?)'
    sqlArgsBase.push(searchTerm, searchTerm)
  }

  diseniosBaseSql += ' ORDER BY d.id DESC'

  const { rows: allPotentialDisenios } = await db.execute({
    sql: diseniosBaseSql,
    args: sqlArgsBase
  })

  const allDiseniosConCategorias = await Promise.all(
    allPotentialDisenios.map(async (disenio) => {
      const { rows: categorias } = await db.execute({
        sql: `
            SELECT
              s.id as subcategoria_id,
              s.nombre as subcategoria_nombre,
              cp.nombre as categoriapadre_nombre
            FROM DisenioSubcategorias ds
            JOIN Subcategorias s ON ds.id_subcategoria = s.id
            JOIN CategoriasPadre cp ON s.id_categoria_padre = cp.id
            WHERE ds.id_disenio = ? AND s.activo = 1 AND cp.activo = 1
          `,
        args: [disenio.id]
      })

      const categoriasParaFrontend = {}
      categorias.forEach((sub) => {
        const slugPadre = toSlug(sub.categoriapadre_nombre)
        if (!categoriasParaFrontend[slugPadre])
          categoriasParaFrontend[slugPadre] = []
        categoriasParaFrontend[slugPadre].push(toSlug(sub.subcategoria_nombre))
      })

      return { ...disenio, ...categoriasParaFrontend }
    })
  )

  const filtrosActivos = Object.keys(categoryFilters).filter((key) => {
    return (
      categoryFilters[key] &&
      categoryFilters[key].length > 0 &&
      !['page', 'limit', 'search'].includes(key)
    )
  })

  const diseniosFiltrados = allDiseniosConCategorias.filter((d) => {
    return filtrosActivos.every((filterKey) => {
      let filtro = categoryFilters[filterKey]
      if (typeof filtro === 'string') {
        filtro = filtro.split(',').map((f) => f.trim())
      }
      const valoresDisenio = d[filterKey]
      if (!Array.isArray(valoresDisenio)) return false
      return filtro.every((v) => valoresDisenio.includes(v))
    })
  })

  return diseniosFiltrados[0] || null
}
