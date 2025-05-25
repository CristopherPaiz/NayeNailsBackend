import { getDb } from '../database/connection.js'
import { toSlug } from '../utils/textUtils.js'

export const getAllDisenios = async (req, res) => {
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows: disenios } = await db.execute({
      sql: `
        SELECT
          d.id, d.nombre, d.descripcion, d.imagen_url, d.precio, d.oferta, d.duracion, d.activo
        FROM Disenios d
        WHERE d.activo = 1
        ORDER BY d.nombre ASC
      `
    })

    const diseniosConCategorias = await Promise.all(
      disenios.map(async (disenio) => {
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
          `,
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

        return { ...disenio, ...categoriasParaFrontend }
      })
    )
    return res.status(200).json(diseniosConCategorias)
  } catch (error) {
    console.error('Error al obtener diseños:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const getAllDiseniosAdmin = async (req, res) => {
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows: disenios } = await db.execute({
      sql: 'SELECT * FROM Disenios ORDER BY fecha_creacion DESC'
    })

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

    return res.status(200).json(diseniosEnriquecidos)
  } catch (error) {
    console.error('Error al obtener diseños para admin:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const createDisenio = async (req, res) => {
  const {
    nombre,
    descripcion,
    imagen_url,
    precio,
    oferta,
    duracion,
    subcategorias
  } = req.body.data

  if (!nombre || !imagen_url) {
    return res
      .status(400)
      .json({ message: 'Nombre y URL de imagen son obligatorios.' })
  }
  if (!Array.isArray(subcategorias) || subcategorias.length === 0) {
    return res
      .status(400)
      .json({ message: 'Debe seleccionar al menos una subcategoría.' })
  }
  if (!subcategorias.every((id) => Number.isInteger(id) && id > 0)) {
    return res
      .status(400)
      .json({ message: 'Formato de subcategorías inválido.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const resultDisenio = await db.execute({
      sql: 'INSERT INTO Disenios (nombre, descripcion, imagen_url, precio, oferta, duracion) VALUES (?, ?, ?, ?, ?, ?)',
      args: [
        nombre,
        descripcion ?? null,
        imagen_url,
        precio ?? null,
        oferta ?? null,
        duracion ?? null
      ]
    })

    const disenioId = resultDisenio?.lastInsertRowid
      ? Number(resultDisenio.lastInsertRowid)
      : null
    if (!disenioId) {
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
  const {
    nombre,
    descripcion,
    imagen_url,
    precio,
    oferta,
    duracion,
    subcategorias
  } = req.body

  if (!nombre || !imagen_url) {
    return res
      .status(400)
      .json({ message: 'Nombre y URL de imagen son obligatorios.' })
  }
  if (!Array.isArray(subcategorias) || subcategorias.length === 0) {
    return res
      .status(400)
      .json({ message: 'Debe seleccionar al menos una subcategoría.' })
  }
  if (!subcategorias.every((id) => Number.isInteger(id) && id > 0)) {
    return res
      .status(400)
      .json({ message: 'Formato de subcategorías inválido.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    // Inicio de lógica sin transacción explícita para Turso
    const { rowsAffected } = await db.execute({
      sql: 'UPDATE Disenios SET nombre = ?, descripcion = ?, imagen_url = ?, precio = ?, oferta = ?, duracion = ? WHERE id = ?',
      args: [
        nombre,
        descripcion ?? null,
        imagen_url,
        precio ?? null,
        oferta ?? null,
        duracion ?? null,
        id
      ]
    })

    if (rowsAffected === 0) {
      return res.status(404).json({ message: 'Diseño no encontrado.' })
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
    // Fin de lógica sin transacción explícita

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
    // No hay ROLLBACK explícito ya que no usamos BEGIN TRANSACTION
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

    // Eliminar asociaciones de subcategorías primero
    await db.execute({
      sql: 'DELETE FROM DisenioSubcategorias WHERE id_disenio = ?',
      args: [id]
    })

    // Luego eliminar el diseño principal
    const { rowsAffected } = await db.execute({
      sql: 'DELETE FROM Disenios WHERE id = ?',
      args: [id]
    })

    if (rowsAffected === 0) {
      // Esto podría suceder si el diseño ya fue eliminado o el ID es incorrecto,
      // pero las subcategorías asociadas (si existían) ya se habrían intentado borrar.
      return res.status(404).json({
        message: 'Diseño no encontrado para eliminar o ya había sido eliminado.'
      })
    }

    return res.status(200).json({ message: 'Diseño eliminado exitosamente.' })
  } catch (error) {
    console.error('Error al eliminar diseño:', error)
    // No hay ROLLBACK explícito necesario aquí sin BEGIN TRANSACTION
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al eliminar el diseño.' })
  }
}
