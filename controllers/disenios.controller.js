import { getDb } from '../database/connection.js'
import { toSlug } from '../utils/textUtils.js'
import { deleteCloudinaryImage } from '../middlewares/upload.middleware.js' // Importar helper

// --- getAllDisenios (sin cambios significativos en su lógica principal, pero se incluye completo) ---
export const getAllDisenios = async (req, res) => {
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows: disenios } = await db.execute({
      sql: `
        SELECT
          d.id, d.nombre, d.descripcion, d.imagen_url, d.precio, d.oferta, d.duracion, d.activo, d.imagen_public_id
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

// --- getAllDiseniosAdmin (sin cambios significativos en su lógica principal, pero se incluye completo) ---
export const getAllDiseniosAdmin = async (req, res) => {
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    // Incluir imagen_public_id
    const { rows: disenios } = await db.execute({
      sql: 'SELECT id, nombre, descripcion, imagen_url, imagen_public_id, precio, oferta, duracion, activo, fecha_creacion FROM Disenios ORDER BY fecha_creacion DESC'
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

// --- createDisenio (Modificado) ---
export const createDisenio = async (req, res) => {
  const { nombre, descripcion, precio, oferta, duracion } = req.body
  let { subcategorias } = req.body

  // La imagen viene de req.cloudinaryUploadResult gracias al middleware handleUpload
  const imagen_info = req.cloudinaryUploadResult

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' })
  }
  if (!imagen_info || !imagen_info.secure_url) {
    return res.status(400).json({ message: 'La imagen es obligatoria.' })
  }

  // Asegurar que subcategorías sea un array y convertir IDs a números
  if (typeof subcategorias === 'string') {
    subcategorias = [subcategorias] // Si llega un solo ID como string
  }
  if (!Array.isArray(subcategorias)) {
    subcategorias = [] // Si no es un array o string, inicializar como vacío
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
        precio || null, // Usar || para convertir string vacío a null
        oferta || null,
        duracion || null
      ]
    })

    const disenioId = resultDisenio?.lastInsertRowid
      ? Number(resultDisenio.lastInsertRowid)
      : null
    if (!disenioId) {
      // Si la inserción falló, intentar eliminar la imagen subida a Cloudinary
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
    // Si hubo un error después de subir la imagen pero antes de guardar en BD (o durante), eliminarla.
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

// --- updateDisenio (Modificado) ---
export const updateDisenio = async (req, res) => {
  const { id } = req.params
  const { nombre, descripcion, precio, oferta, duracion } = req.body
  let { subcategorias } = req.body

  const nueva_imagen_info = req.cloudinaryUploadResult // Puede ser undefined si no se sube nueva imagen

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
      // Esto no debería pasar si disenioExistente fue encontrado, pero es una salvaguarda.
      // Si se subió una nueva imagen pero la actualización de BD falló, eliminar la nueva imagen.
      if (nueva_imagen_info?.public_id) {
        await deleteCloudinaryImage(nueva_imagen_info.public_id)
      }
      return res
        .status(404)
        .json({ message: 'Diseño no encontrado o no se pudo actualizar.' })
    }

    // Si la actualización fue exitosa y había una imagen antigua para borrar, bórrala.
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
    // Si se subió una nueva imagen pero algo falló después (ej. constraint error), eliminar la nueva imagen.
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

// --- toggleActivoDisenio (sin cambios) ---
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

// --- deleteDisenio (Modificado) ---
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
      return res.status(404).json({
        message: 'Diseño no encontrado para eliminar o ya había sido eliminado.'
      })
    }

    // Si el diseño fue eliminado de la BD y tenía un public_id, eliminar de Cloudinary
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
