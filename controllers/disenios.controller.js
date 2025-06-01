import { getDb } from '../database/connection.js'
import { toSlug } from '../utils/textUtils.js'
import { deleteCloudinaryImage } from '../middlewares/upload.middleware.js'

export const getAllDisenios = async (req, res) => {
  const { page = 1, limit = 10, search = '', ...categoryFilters } = req.query

  let pageNumber = parseInt(page, 10)
  const limitNumber = parseInt(limit, 10)
  const searchTerm = search ? `%${search.toLowerCase()}%` : null

  if (isNaN(pageNumber) || pageNumber < 1) {
    pageNumber = 1
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    // Paso 1: Obtener TODOS los diseños activos que coincidan con el término de búsqueda (si existe)
    // No aplicamos paginación aquí todavía, porque necesitamos todos los resultados potenciales para filtrar por categoría.
    let diseniosBaseSql = `
      SELECT
        d.id, d.nombre, d.descripcion, d.imagen_url, d.precio, d.oferta, d.duracion, d.activo, d.imagen_public_id
      FROM Disenios d
      WHERE d.activo = 1
    `
    const sqlArgsBase = []

    if (searchTerm) {
      diseniosBaseSql +=
        ' AND (LOWER(d.nombre) LIKE ? OR LOWER(d.descripcion) LIKE ?)'
      sqlArgsBase.push(searchTerm, searchTerm)
    }
    // El orden se aplicará después del filtrado por categorías si es necesario, o se puede mantener aquí.
    // Por ahora, lo dejamos para que la lista base esté ordenada.
    diseniosBaseSql += ' ORDER BY d.nombre ASC'

    const { rows: allPotentialDisenios } = await db.execute({
      sql: diseniosBaseSql,
      args: sqlArgsBase
    })

    // Paso 2: Enriquecer cada diseño con sus categorías (solo activas)
    const allDiseniosConCategoriasActivas = await Promise.all(
      allPotentialDisenios.map(async (disenio) => {
        const { rows: subcategoriasAsociadas } = await db.execute({
          sql: `
            SELECT
              s.id as subcategoria_id,
              s.nombre as subcategoria_nombre,
              s.icono as subcategoria_icono,
              cp.id as categoriapadre_id,
              cp.nombre as categoriapadre_nombre,
              cp.icono as categoriapadre_icono
            FROM DisenioSubcategorias ds
            JOIN Subcategorias s ON ds.id_subcategoria = s.id
            JOIN CategoriasPadre cp ON s.id_categoria_padre = cp.id
            WHERE ds.id_disenio = ? AND s.activo = 1 AND cp.activo = 1
          `, // Asegura que solo se traigan subcategorías y categorías padre ACTIVAS
          args: [disenio.id]
        })

        const categoriasParaFrontend = {}
        subcategoriasAsociadas.forEach((sub) => {
          const categoriaPadreSlug = toSlug(sub.categoriapadre_nombre)
          if (!categoriasParaFrontend[categoriaPadreSlug]) {
            categoriasParaFrontend[categoriaPadreSlug] = []
          }
          categoriasParaFrontend[categoriaPadreSlug].push(
            toSlug(sub.subcategoria_nombre)
          )
        })
        // Si un diseño no tiene NINGUNA categoría activa asociada después de este proceso,
        // sus propiedades de categoría estarán vacías (ej: disenio.servicios = undefined o [])
        return { ...disenio, ...categoriasParaFrontend }
      })
    )

    // Paso 3: Aplicar filtros de categoría en JavaScript sobre la lista enriquecida
    let diseniosFiltradosCompletos = allDiseniosConCategoriasActivas
    const activeCategoryFilterKeys = Object.keys(categoryFilters).filter(
      (key) =>
        categoryFilters[key] &&
        (typeof categoryFilters[key] === 'string' ||
          Array.isArray(categoryFilters[key])) &&
        categoryFilters[key].length > 0 &&
        !['page', 'limit', 'search'].includes(key)
    )

    if (activeCategoryFilterKeys.length > 0) {
      diseniosFiltradosCompletos = allDiseniosConCategoriasActivas.filter(
        (disenio) => {
          return activeCategoryFilterKeys.every((filterKey) => {
            let filterValues = categoryFilters[filterKey]
            if (typeof filterValues === 'string') {
              filterValues = filterValues
                .split(',')
                .map((val) => val.trim())
                .filter(Boolean)
            }

            const disenioValuesForCategory = disenio[filterKey] // Esta propiedad ya contiene solo slugs de categorías activas
            if (
              !Array.isArray(disenioValuesForCategory) ||
              disenioValuesForCategory.length === 0
            ) {
              // Si el diseño no tiene esta categoría (o no tiene ninguna activa de este tipo), no cumple el filtro
              return false
            }
            // El diseño debe tener TODOS los valores de filtro para esta clave de categoría
            return filterValues.every((filterValue) =>
              disenioValuesForCategory.includes(filterValue)
            )
          })
        }
      )
    }
    // Adicionalmente, si un diseño quedó sin NINGUNA categoría después del enriquecimiento
    // (porque todas sus categorías asociadas estaban inactivas), y hay filtros de categoría activos,
    // podría ser necesario filtrarlos aquí si la lógica anterior no los cubre.
    // Sin embargo, si un diseño no tiene la `filterKey` (ej. `disenio.servicios` es undefined),
    // la condición `!Array.isArray(disenioValuesForCategory)` ya lo excluiría.

    // Paso 4: Calcular paginación sobre el resultado FINALMENTE filtrado
    const totalDisenios = diseniosFiltradosCompletos.length
    let totalPages = Math.ceil(totalDisenios / limitNumber)
    if (totalPages === 0 && totalDisenios === 0) {
      totalPages = 1 // Para que el frontend muestre "página 1 de 1" aunque no haya resultados
    }

    let finalPageNumber = pageNumber
    if (finalPageNumber > totalPages) {
      finalPageNumber = totalPages > 0 ? totalPages : 1
    }

    const finalOffset = (finalPageNumber - 1) * limitNumber
    const diseniosParaPaginaActual = diseniosFiltradosCompletos.slice(
      finalOffset,
      finalOffset + limitNumber
    )

    return res.status(200).json({
      disenios: diseniosParaPaginaActual,
      currentPage: finalPageNumber,
      totalPages,
      totalDisenios // Este es el total DESPUÉS de todos los filtros (búsqueda y categoría)
    })
  } catch (error) {
    console.error('Error al obtener diseños:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const getAllDiseniosAdmin = async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query
  const pageNumber = parseInt(page, 10)
  const limitNumber = parseInt(limit, 10)
  const offset = (pageNumber - 1) * limitNumber
  const searchTerm = search ? `%${search.toLowerCase()}%` : null

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    let diseniosSql =
      'SELECT id, nombre, descripcion, imagen_url, imagen_public_id, precio, oferta, duracion, activo, fecha_creacion FROM Disenios'
    let countSql = 'SELECT COUNT(id) as total FROM Disenios'
    const whereClauses = []
    const sqlArgs = []
    const countArgs = []

    if (searchTerm) {
      whereClauses.push('(LOWER(nombre) LIKE ? OR LOWER(descripcion) LIKE ?)')
      sqlArgs.push(searchTerm, searchTerm)
      countArgs.push(searchTerm, searchTerm)
    }

    if (whereClauses.length > 0) {
      const whereString = ` WHERE ${whereClauses.join(' AND ')}`
      diseniosSql += whereString
      countSql += whereString
    }

    diseniosSql += ' ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?'
    sqlArgs.push(limitNumber, offset)

    const { rows: disenios } = await db.execute({
      sql: diseniosSql,
      args: sqlArgs
    })
    const { rows: countResult } = await db.execute({
      sql: countSql,
      args: countArgs
    })
    const totalDisenios = countResult[0]?.total ?? 0
    const totalPages = Math.ceil(totalDisenios / limitNumber)

    const diseniosEnriquecidos = await Promise.all(
      disenios.map(async (disenio) => {
        const { rows: subcategorias } = await db.execute({
          sql: 'SELECT id_subcategoria FROM DisenioSubcategorias WHERE id_disenio = ?',
          args: [disenio.id]
        })
        return {
          ...disenio,
          subcategorias_ids: subcategorias.map((s) => s.id_subcategoria)
        }
      })
    )

    return res.status(200).json({
      disenios: diseniosEnriquecidos,
      currentPage: pageNumber,
      totalPages,
      totalDisenios
    })
  } catch (error) {
    console.error('Error al obtener diseños para admin:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const createDisenio = async (req, res) => {
  const { nombre, descripcion, precio, oferta, duracion } = req.body
  let { subcategorias } = req.body

  const imagen_info = req.cloudinaryUploadResult

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' })
  }
  if (!imagen_info || !imagen_info.secure_url) {
    return res.status(400).json({ message: 'La imagen es obligatoria.' })
  }

  if (typeof subcategorias === 'string') {
    subcategorias = [subcategorias]
  }
  if (!Array.isArray(subcategorias)) {
    subcategorias = []
  }
  subcategorias = subcategorias
    .map((id) => Number(id))
    .filter((id) => !isNaN(id) && id > 0)

  if (subcategorias.length === 0) {
    return res
      .status(400)
      .json({ message: 'Debe seleccionar al menos una subcategoría.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const resultDisenio = await db.execute({
      sql: 'INSERT INTO Disenios (nombre, descripcion, imagen_url, imagen_public_id, precio, oferta, duracion) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        nombre,
        descripcion ?? null,
        imagen_info.secure_url,
        imagen_info.public_id,
        precio || null,
        oferta || null,
        duracion || null
      ]
    })

    const disenioId = resultDisenio?.lastInsertRowid
      ? Number(resultDisenio.lastInsertRowid)
      : null
    if (!disenioId) {
      if (imagen_info.public_id) {
        await deleteCloudinaryImage(imagen_info.public_id)
      }
      return res
        .status(500)
        .json({ message: 'Error al crear el diseño, no se obtuvo ID.' })
    }

    for (const subcategoriaId of subcategorias) {
      await db.execute({
        sql: 'INSERT INTO DisenioSubcategorias (id_disenio, id_subcategoria) VALUES (?, ?)',
        args: [disenioId, subcategoriaId]
      })
    }

    const {
      rows: [nuevoDisenio]
    } = await db.execute({
      sql: 'SELECT * FROM Disenios WHERE id = ?',
      args: [disenioId]
    })
    const { rows: subs } = await db.execute({
      sql: 'SELECT id_subcategoria FROM DisenioSubcategorias WHERE id_disenio = ?',
      args: [disenioId]
    })

    return res.status(201).json({
      message: 'Diseño creado exitosamente.',
      disenio: {
        ...nuevoDisenio,
        subcategorias_ids: subs.map((s) => s.id_subcategoria)
      }
    })
  } catch (error) {
    console.error('Error al crear diseño:', error)
    if (imagen_info && imagen_info.public_id) {
      await deleteCloudinaryImage(imagen_info.public_id)
    }
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res
        .status(409)
        .json({ message: 'Ya existe un diseño con ese nombre.' })
    }
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const updateDisenio = async (req, res) => {
  const { id } = req.params
  const { nombre, descripcion, precio, oferta, duracion } = req.body
  let { subcategorias } = req.body

  const nueva_imagen_info = req.cloudinaryUploadResult

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' })
  }

  if (typeof subcategorias === 'string') {
    subcategorias = [subcategorias]
  }
  if (!Array.isArray(subcategorias)) {
    subcategorias = []
  }
  subcategorias = subcategorias
    .map((id) => Number(id))
    .filter((id) => !isNaN(id) && id > 0)

  if (subcategorias.length === 0) {
    return res
      .status(400)
      .json({ message: 'Debe seleccionar al menos una subcategoría.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const {
      rows: [disenioExistente]
    } = await db.execute({
      sql: 'SELECT imagen_url, imagen_public_id FROM Disenios WHERE id = ?',
      args: [id]
    })

    if (!disenioExistente) {
      if (nueva_imagen_info?.public_id) {
        await deleteCloudinaryImage(nueva_imagen_info.public_id)
      }
      return res.status(404).json({ message: 'Diseño no encontrado.' })
    }

    let imagen_url_final = disenioExistente.imagen_url
    let imagen_public_id_final = disenioExistente.imagen_public_id
    let public_id_antiguo_para_borrar = null

    if (nueva_imagen_info && nueva_imagen_info.secure_url) {
      imagen_url_final = nueva_imagen_info.secure_url
      imagen_public_id_final = nueva_imagen_info.public_id
      if (
        disenioExistente.imagen_public_id &&
        disenioExistente.imagen_public_id !== nueva_imagen_info.public_id
      ) {
        public_id_antiguo_para_borrar = disenioExistente.imagen_public_id
      }
    }

    const { rowsAffected } = await db.execute({
      sql: 'UPDATE Disenios SET nombre = ?, descripcion = ?, imagen_url = ?, imagen_public_id = ?, precio = ?, oferta = ?, duracion = ? WHERE id = ?',
      args: [
        nombre,
        descripcion ?? null,
        imagen_url_final,
        imagen_public_id_final,
        precio || null,
        oferta || null,
        duracion || null,
        id
      ]
    })

    if (rowsAffected === 0) {
      if (nueva_imagen_info?.public_id) {
        await deleteCloudinaryImage(nueva_imagen_info.public_id)
      }
      return res
        .status(404)
        .json({ message: 'Diseño no encontrado o no se pudo actualizar.' })
    }

    if (public_id_antiguo_para_borrar) {
      await deleteCloudinaryImage(public_id_antiguo_para_borrar)
    }

    await db.execute({
      sql: 'DELETE FROM DisenioSubcategorias WHERE id_disenio = ?',
      args: [id]
    })

    for (const subcategoriaId of subcategorias) {
      await db.execute({
        sql: 'INSERT INTO DisenioSubcategorias (id_disenio, id_subcategoria) VALUES (?, ?)',
        args: [id, subcategoriaId]
      })
    }

    const {
      rows: [disenioActualizado]
    } = await db.execute({
      sql: 'SELECT * FROM Disenios WHERE id = ?',
      args: [id]
    })
    const { rows: subs } = await db.execute({
      sql: 'SELECT id_subcategoria FROM DisenioSubcategorias WHERE id_disenio = ?',
      args: [id]
    })

    return res.status(200).json({
      message: 'Diseño actualizado exitosamente.',
      disenio: {
        ...disenioActualizado,
        subcategorias_ids: subs.map((s) => s.id_subcategoria)
      }
    })
  } catch (error) {
    console.error('Error al actualizar diseño:', error)
    if (nueva_imagen_info?.public_id) {
      await deleteCloudinaryImage(nueva_imagen_info.public_id)
    }
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res
        .status(409)
        .json({ message: 'Ya existe otro diseño con ese nombre.' })
    }
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const toggleActivoDisenio = async (req, res) => {
  const { id } = req.params
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const {
      rows: [disenio]
    } = await db.execute({
      sql: 'SELECT activo FROM Disenios WHERE id = ?',
      args: [id]
    })

    if (!disenio) {
      return res.status(404).json({ message: 'Diseño no encontrado.' })
    }

    const nuevoEstado = disenio.activo ? 0 : 1
    await db.execute({
      sql: 'UPDATE Disenios SET activo = ? WHERE id = ?',
      args: [nuevoEstado, id]
    })

    return res.status(200).json({
      message: `Diseño ${
        nuevoEstado ? 'activado' : 'inactivado'
      } exitosamente.`,
      activo: nuevoEstado
    })
  } catch (error) {
    console.error('Error al cambiar estado del diseño:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const deleteDisenio = async (req, res) => {
  const { id } = req.params
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible.' })
    }

    const {
      rows: [disenioParaEliminar]
    } = await db.execute({
      sql: 'SELECT imagen_public_id FROM Disenios WHERE id = ?',
      args: [id]
    })

    await db.execute({
      sql: 'DELETE FROM DisenioSubcategorias WHERE id_disenio = ?',
      args: [id]
    })

    const { rowsAffected } = await db.execute({
      sql: 'DELETE FROM Disenios WHERE id = ?',
      args: [id]
    })

    if (rowsAffected === 0) {
      return res.status(404).json({
        message: 'Diseño no encontrado para eliminar o ya había sido eliminado.'
      })
    }

    if (disenioParaEliminar && disenioParaEliminar.imagen_public_id) {
      await deleteCloudinaryImage(disenioParaEliminar.imagen_public_id)
    }

    return res.status(200).json({ message: 'Diseño eliminado exitosamente.' })
  } catch (error) {
    console.error('Error al eliminar diseño:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al eliminar el diseño.' })
  }
}
