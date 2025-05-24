import { getDb } from '../database/connection.js'
import { toSlug } from '../utils/textUtils.js' // Necesitarás este util en el backend

export const getAllDisenios = async (req, res) => {
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    // Obtener todos los diseños activos
    const { rows: disenios } = await db.execute({
      sql: `
        SELECT
          d.id, d.nombre, d.descripcion, d.imagen_url, d.precio, d.oferta, d.duracion, d.activo
        FROM Disenios d
        WHERE d.activo = 1
        ORDER BY d.nombre ASC
      `
    })

    // Para cada diseño, obtener sus subcategorías y agruparlas por categoría padre
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

        // Agrupar subcategorías por el slug de la categoría padre para el frontend
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

    // Opcional: Enriquecer con subcategorías si es necesario para la vista de admin
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
  // Validar que todos los elementos en subcategorias sean números (IDs)
  if (!subcategorias.every((id) => Number.isInteger(id) && id > 0)) {
    return res
      .status(400)
      .json({ message: 'Formato de subcategorías inválido.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    await db.execute('BEGIN TRANSACTION')

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
      await db.execute('ROLLBACK')
      return res
        .status(500)
        .json({ message: 'Error al crear el diseño, no se obtuvo ID.' })
    }

    for (const subcategoriaId of subcategorias) {
      // Opcional: Verificar si la subcategoría existe y está activa antes de insertar
      await db.execute({
        sql: 'INSERT INTO DisenioSubcategorias (id_disenio, id_subcategoria) VALUES (?, ?)',
        args: [disenioId, subcategoriaId]
      })
    }

    await db.execute('COMMIT')

    // Devolver el diseño creado con sus subcategorías (opcional, pero útil)
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
    await getDb()
      .then((db) => db?.execute('ROLLBACK'))
      .catch((e) => console.error('Error en rollback', e))
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

    await db.execute('BEGIN TRANSACTION')

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
      await db.execute('ROLLBACK')
      return res.status(404).json({ message: 'Diseño no encontrado.' })
    }

    // Actualizar asociaciones de subcategorías: borrar existentes y añadir las nuevas
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

    await db.execute('COMMIT')

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
    await getDb()
      .then((db) => db?.execute('ROLLBACK'))
      .catch((e) => console.error('Error en rollback', e))
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
