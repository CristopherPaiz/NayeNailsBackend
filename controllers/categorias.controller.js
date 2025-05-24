import { getDb } from '../database/connection.js'

export const getAllCategorias = async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({
        message: 'Base de datos no disponible temporalmente. Intente más tarde.'
      })
    }

    const { rows: categoriasPadre } = await db.execute({
      sql: 'SELECT * FROM CategoriasPadre ORDER BY nombre ASC'
    })

    const categoriasConSubcategorias = await Promise.all(
      categoriasPadre.map(async (padre) => {
        const { rows: subcategorias } = await db.execute({
          sql: 'SELECT * FROM Subcategorias WHERE id_categoria_padre = ? ORDER BY nombre ASC',
          args: [padre.id]
        })
        return { ...padre, subcategorias }
      })
    )

    return res.status(200).json(categoriasConSubcategorias)
  } catch (error) {
    console.error('Error al obtener categorías:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al obtener categorías' })
  }
}

export const createCategoriaPadre = async (req, res) => {
  const { nombre, icono } = req.body
  if (!nombre) {
    return res
      .status(400)
      .json({ message: 'El nombre de la categoría padre es obligatorio' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible' })
    }

    const result = await db.execute({
      sql: 'INSERT INTO CategoriasPadre (nombre, icono) VALUES (?, ?)',
      args: [nombre, icono ?? null]
    })

    const nuevaCategoriaId = result?.lastInsertRowid
      ? Number(result.lastInsertRowid)
      : null
    if (!nuevaCategoriaId) {
      return res
        .status(500)
        .json({
          message: 'Error al crear la categoría padre, no se obtuvo ID.'
        })
    }

    const {
      rows: [nuevaCategoria]
    } = await db.execute({
      sql: 'SELECT * FROM CategoriasPadre WHERE id = ?',
      args: [nuevaCategoriaId]
    })

    return res
      .status(201)
      .json({
        message: 'Categoría padre creada exitosamente',
        categoria: { ...nuevaCategoria, subcategorias: [] }
      })
  } catch (error) {
    console.error('Error al crear categoría padre:', error)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res
        .status(409)
        .json({ message: 'Ya existe una categoría padre con ese nombre.' })
    }
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al crear categoría padre' })
  }
}

export const updateCategoriaPadre = async (req, res) => {
  const { id } = req.params
  const { nombre, icono } = req.body

  if (!nombre) {
    return res
      .status(400)
      .json({ message: 'El nombre de la categoría padre es obligatorio' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible' })
    }

    const { rowsAffected } = await db.execute({
      sql: 'UPDATE CategoriasPadre SET nombre = ?, icono = ? WHERE id = ?',
      args: [nombre, icono ?? null, id]
    })

    if (rowsAffected === 0) {
      return res.status(404).json({ message: 'Categoría padre no encontrada' })
    }

    const {
      rows: [categoriaActualizada]
    } = await db.execute({
      sql: 'SELECT * FROM CategoriasPadre WHERE id = ?',
      args: [id]
    })

    return res
      .status(200)
      .json({
        message: 'Categoría padre actualizada exitosamente',
        categoria: categoriaActualizada
      })
  } catch (error) {
    console.error('Error al actualizar categoría padre:', error)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res
        .status(409)
        .json({ message: 'Ya existe otra categoría padre con ese nombre.' })
    }
    return res
      .status(500)
      .json({
        message: 'Error interno del servidor al actualizar categoría padre'
      })
  }
}

export const toggleActivoCategoriaPadre = async (req, res) => {
  const { id } = req.params
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible' })
    }

    const {
      rows: [categoria]
    } = await db.execute({
      sql: 'SELECT activo FROM CategoriasPadre WHERE id = ?',
      args: [id]
    })

    if (!categoria) {
      return res.status(404).json({ message: 'Categoría padre no encontrada' })
    }

    const nuevoEstado = categoria.activo ? 0 : 1
    await db.execute({
      sql: 'UPDATE CategoriasPadre SET activo = ? WHERE id = ?',
      args: [nuevoEstado, id]
    })

    return res
      .status(200)
      .json({
        message: `Categoría padre ${
          nuevoEstado ? 'activada' : 'inactivada'
        } exitosamente`,
        activo: nuevoEstado
      })
  } catch (error) {
    console.error('Error al cambiar estado de categoría padre:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al cambiar estado' })
  }
}

export const createSubcategoria = async (req, res) => {
  const { idPadre } = req.params
  const { nombre, icono } = req.body

  if (!nombre) {
    return res
      .status(400)
      .json({ message: 'El nombre de la subcategoría es obligatorio' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible' })
    }

    const {
      rows: [categoriaPadre]
    } = await db.execute({
      sql: 'SELECT id FROM CategoriasPadre WHERE id = ?',
      args: [idPadre]
    })

    if (!categoriaPadre) {
      return res
        .status(404)
        .json({ message: 'La categoría padre especificada no existe.' })
    }

    const result = await db.execute({
      sql: 'INSERT INTO Subcategorias (id_categoria_padre, nombre, icono) VALUES (?, ?, ?)',
      args: [idPadre, nombre, icono ?? null]
    })

    const nuevaSubcategoriaId = result?.lastInsertRowid
      ? Number(result.lastInsertRowid)
      : null
    if (!nuevaSubcategoriaId) {
      return res
        .status(500)
        .json({ message: 'Error al crear la subcategoría, no se obtuvo ID.' })
    }

    const {
      rows: [nuevaSubcategoria]
    } = await db.execute({
      sql: 'SELECT * FROM Subcategorias WHERE id = ?',
      args: [nuevaSubcategoriaId]
    })

    return res
      .status(201)
      .json({
        message: 'Subcategoría creada exitosamente',
        subcategoria: nuevaSubcategoria
      })
  } catch (error) {
    console.error('Error al crear subcategoría:', error)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res
        .status(409)
        .json({
          message:
            'Ya existe una subcategoría con ese nombre para esta categoría padre.'
        })
    }
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al crear subcategoría' })
  }
}

export const updateSubcategoria = async (req, res) => {
  const { id } = req.params
  const { nombre, icono, id_categoria_padre } = req.body // id_categoria_padre es opcional, pero si se envía, se valida

  if (!nombre) {
    return res
      .status(400)
      .json({ message: 'El nombre de la subcategoría es obligatorio' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible' })
    }

    // Validar que la subcategoría existe
    const {
      rows: [subcategoriaExistente]
    } = await db.execute({
      sql: 'SELECT id, id_categoria_padre FROM Subcategorias WHERE id = ?',
      args: [id]
    })

    if (!subcategoriaExistente) {
      return res.status(404).json({ message: 'Subcategoría no encontrada.' })
    }

    // Si se proporciona id_categoria_padre, validar que existe
    let finalIdCategoriaPadre = subcategoriaExistente.id_categoria_padre
    if (
      id_categoria_padre &&
      id_categoria_padre !== subcategoriaExistente.id_categoria_padre
    ) {
      const {
        rows: [categoriaPadre]
      } = await db.execute({
        sql: 'SELECT id FROM CategoriasPadre WHERE id = ?',
        args: [id_categoria_padre]
      })
      if (!categoriaPadre) {
        return res
          .status(400)
          .json({ message: 'La nueva categoría padre especificada no existe.' })
      }
      finalIdCategoriaPadre = id_categoria_padre
    }

    const { rowsAffected } = await db.execute({
      sql: 'UPDATE Subcategorias SET nombre = ?, icono = ?, id_categoria_padre = ? WHERE id = ?',
      args: [nombre, icono ?? null, finalIdCategoriaPadre, id]
    })

    if (rowsAffected === 0) {
      // Esto no debería ocurrir si la subcategoría existe, pero es una salvaguarda
      return res
        .status(404)
        .json({ message: 'Subcategoría no encontrada o no se pudo actualizar' })
    }

    const {
      rows: [subcategoriaActualizada]
    } = await db.execute({
      sql: 'SELECT * FROM Subcategorias WHERE id = ?',
      args: [id]
    })

    return res
      .status(200)
      .json({
        message: 'Subcategoría actualizada exitosamente',
        subcategoria: subcategoriaActualizada
      })
  } catch (error) {
    console.error('Error al actualizar subcategoría:', error)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res
        .status(409)
        .json({
          message:
            'Ya existe una subcategoría con ese nombre para la categoría padre seleccionada.'
        })
    }
    return res
      .status(500)
      .json({
        message: 'Error interno del servidor al actualizar subcategoría'
      })
  }
}

export const toggleActivoSubcategoria = async (req, res) => {
  const { id } = req.params
  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible' })
    }

    const {
      rows: [subcategoria]
    } = await db.execute({
      sql: 'SELECT activo FROM Subcategorias WHERE id = ?',
      args: [id]
    })

    if (!subcategoria) {
      return res.status(404).json({ message: 'Subcategoría no encontrada' })
    }

    const nuevoEstado = subcategoria.activo ? 0 : 1
    await db.execute({
      sql: 'UPDATE Subcategorias SET activo = ? WHERE id = ?',
      args: [nuevoEstado, id]
    })

    return res
      .status(200)
      .json({
        message: `Subcategoría ${
          nuevoEstado ? 'activada' : 'inactivada'
        } exitosamente`,
        activo: nuevoEstado
      })
  } catch (error) {
    console.error('Error al cambiar estado de subcategoría:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al cambiar estado' })
  }
}
