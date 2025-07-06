import { getDb } from '../database/connection.js'

// Crear una nueva cita
export const crearCita = async (req, res) => {
  const {
    nombre_cliente,
    telefono_cliente,
    fecha_cita,
    hora_cita,
    id_subcategoria_servicio,
    notas
  } = req.body

  if (
    !nombre_cliente ||
    !telefono_cliente ||
    !fecha_cita ||
    !hora_cita ||
    !id_subcategoria_servicio
  ) {
    return res
      .status(400)
      .json({ message: 'Todos los campos marcados con * son obligatorios.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows: subcategorias } = await db.execute({
      sql: 'SELECT id FROM Subcategorias WHERE id = ? AND activo = 1',
      args: [id_subcategoria_servicio]
    })

    if (subcategorias.length === 0) {
      return res.status(400).json({
        message: 'El servicio seleccionado no es válido o no está disponible.'
      })
    }

    const result = await db.execute({
      sql: 'INSERT INTO Citas (nombre_cliente, telefono_cliente, fecha_cita, hora_cita, id_subcategoria_servicio, notas, estado, aceptada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        nombre_cliente,
        telefono_cliente,
        fecha_cita,
        hora_cita,
        id_subcategoria_servicio,
        notas ?? null,
        'pendiente',
        0
      ]
    })

    const citaId = result?.lastInsertRowid
      ? Number(result.lastInsertRowid)
      : null

    if (!citaId) {
      return res
        .status(500)
        .json({ message: 'Error al crear la cita, no se obtuvo ID.' })
    }

    return res
      .status(201)
      .json({ message: 'Cita creada exitosamente.', citaId })
  } catch (error) {
    console.error('Error al crear cita:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al crear la cita.' })
  }
}

// Obtener citas para el admin
export const obtenerCitasAdmin = async (req, res) => {
  const { mes, anio, fecha } = req.query

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    let sql = `
      SELECT
        c.id, c.nombre_cliente, c.telefono_cliente,
        STRFTIME('%Y-%m-%d', c.fecha_cita) as fecha_cita,
        c.hora_cita,
        c.id_subcategoria_servicio, s.nombre as nombre_subcategoria, cp.nombre as nombre_categoria_padre,
        c.notas, c.estado, c.aceptada,
        c.fecha_creacion, c.fecha_actualizacion
      FROM Citas c
      LEFT JOIN Subcategorias s ON c.id_subcategoria_servicio = s.id
      LEFT JOIN CategoriasPadre cp ON s.id_categoria_padre = cp.id
    `
    const args = []
    const conditions = []

    if (fecha) {
      conditions.push("STRFTIME('%Y-%m-%d', c.fecha_cita) = ?")
      args.push(fecha)
    } else if (mes && anio) {
      conditions.push("STRFTIME('%Y-%m', c.fecha_cita) = ?")
      args.push(`${anio}-${mes.padStart(2, '0')}`)
    } else {
      conditions.push(
        "STRFTIME('%Y-%m', c.fecha_cita) = STRFTIME('%Y-%m', 'now')"
      )
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY c.fecha_cita ASC, c.hora_cita ASC'

    const { rows: citas } = await db.execute({ sql, args })

    return res.status(200).json(citas)
  } catch (error) {
    console.error('Error al obtener citas para admin:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al obtener citas.' })
  }
}

// Actualizar cualquier campo de una cita
export const updateCita = async (req, res) => {
  const { id } = req.params
  const {
    nombre_cliente,
    telefono_cliente,
    fecha_cita,
    hora_cita,
    id_subcategoria_servicio,
    notas,
    aceptada, // Este valor vendrá del frontend
    estado: nuevoEstadoPropuesto // Para flexibilidad
  } = req.body

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const {
      rows: [citaExistente]
    } = await db.execute({
      sql: 'SELECT * FROM Citas WHERE id = ?',
      args: [id]
    })

    if (!citaExistente) {
      return res.status(404).json({ message: 'Cita no encontrada.' })
    }

    const updates = []
    const args = []

    // Actualizar campos estándar si se proporcionan
    if (nombre_cliente) {
      updates.push('nombre_cliente = ?')
      args.push(nombre_cliente)
    }
    if (telefono_cliente) {
      updates.push('telefono_cliente = ?')
      args.push(telefono_cliente)
    }
    if (fecha_cita) {
      updates.push('fecha_cita = ?')
      args.push(fecha_cita)
    }
    if (hora_cita) {
      updates.push('hora_cita = ?')
      args.push(hora_cita)
    }
    if (id_subcategoria_servicio) {
      updates.push('id_subcategoria_servicio = ?')
      args.push(id_subcategoria_servicio)
    }
    if (typeof notas !== 'undefined') {
      updates.push('notas = ?')
      args.push(notas)
    }

    // Lógica mejorada para 'aceptada' y 'estado'
    if (typeof aceptada !== 'undefined') {
      const isAccepted = aceptada ? 1 : 0
      updates.push('aceptada = ?')
      args.push(isAccepted)

      // Determinar estado basado en 'aceptada', a menos que se proporcione un estado específico
      let estadoFinal = isAccepted ? 'confirmada' : 'pendiente'
      const estadosValidos = [
        'pendiente',
        'confirmada',
        'cancelada',
        'completada',
        'atendida'
      ]
      if (
        nuevoEstadoPropuesto &&
        estadosValidos.includes(nuevoEstadoPropuesto)
      ) {
        estadoFinal = nuevoEstadoPropuesto
      }
      updates.push('estado = ?')
      args.push(estadoFinal)
    } else if (nuevoEstadoPropuesto) {
      // Manejar cambio de estado sin cambiar 'aceptada'
      const estadosValidos = [
        'pendiente',
        'confirmada',
        'cancelada',
        'completada',
        'atendida'
      ]
      if (estadosValidos.includes(nuevoEstadoPropuesto)) {
        updates.push('estado = ?')
        args.push(nuevoEstadoPropuesto)
      }
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ message: 'No se proporcionaron datos para actualizar.' })
    }

    updates.push("fecha_actualizacion = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')")
    args.push(id)

    const sql = `UPDATE Citas SET ${updates.join(', ')} WHERE id = ?`

    const { rowsAffected } = await db.execute({ sql, args })

    if (rowsAffected === 0) {
      return res
        .status(404)
        .json({ message: 'Cita no encontrada o no se pudo actualizar.' })
    }

    const {
      rows: [citaActualizada]
    } = await db.execute({
      sql: 'SELECT * FROM Citas WHERE id = ?',
      args: [id]
    })

    return res.status(200).json({
      message: 'Cita actualizada exitosamente.',
      cita: citaActualizada
    })
  } catch (error) {
    console.error('Error al actualizar cita:', error)
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res
        .status(400)
        .json({ message: `Error de base de datos: ${error.message}` })
    }
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al actualizar la cita.' })
  }
}

// Eliminar una cita
export const deleteCita = async (req, res) => {
  const { id } = req.params

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rowsAffected } = await db.execute({
      sql: 'DELETE FROM Citas WHERE id = ?',
      args: [id]
    })

    if (rowsAffected === 0) {
      return res.status(404).json({ message: 'Cita no encontrada.' })
    }

    return res.status(200).json({ message: 'Cita eliminada exitosamente.' })
  } catch (error) {
    console.error('Error al eliminar cita:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al eliminar la cita.' })
  }
}

export const crearCitaAdmin = async (req, res) => {
  const {
    nombre_cliente,
    telefono_cliente,
    fecha_cita,
    hora_cita,
    id_subcategoria_servicio,
    notas
  } = req.body

  if (
    !nombre_cliente ||
    !telefono_cliente ||
    !fecha_cita ||
    !hora_cita ||
    !id_subcategoria_servicio
  ) {
    return res
      .status(400)
      .json({ message: 'Todos los campos son obligatorios.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    // Validar que el servicio (subcategoría) existe y está activo
    const { rows: subcategorias } = await db.execute({
      sql: 'SELECT id FROM Subcategorias WHERE id = ? AND activo = 1',
      args: [id_subcategoria_servicio]
    })

    if (subcategorias.length === 0) {
      return res.status(400).json({
        message: 'El servicio seleccionado no es válido o no está disponible.'
      })
    }

    // Como el admin la crea, la marcamos como confirmada y aceptada por defecto
    const result = await db.execute({
      sql: 'INSERT INTO Citas (nombre_cliente, telefono_cliente, fecha_cita, hora_cita, id_subcategoria_servicio, notas, estado, aceptada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        nombre_cliente,
        telefono_cliente,
        fecha_cita,
        hora_cita,
        id_subcategoria_servicio,
        notas ?? null,
        'confirmada', // Estado por defecto para citas de admin
        1 // Aceptada por defecto
      ]
    })

    const citaId = result?.lastInsertRowid
      ? Number(result.lastInsertRowid)
      : null

    if (!citaId) {
      return res
        .status(500)
        .json({ message: 'Error al crear la cita, no se obtuvo ID.' })
    }

    // Devolver la cita recién creada
    const {
      rows: [nuevaCita]
    } = await db.execute({
      sql: 'SELECT * FROM Citas WHERE id = ?',
      args: [citaId]
    })

    return res.status(201).json({
      message: 'Cita creada exitosamente por el administrador.',
      cita: nuevaCita
    })
  } catch (error) {
    console.error('Error al crear cita desde admin:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al crear la cita.' })
  }
}
