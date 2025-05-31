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

// Actualizar estado de una cita (aceptada, reagendar)
export const actualizarEstadoCita = async (req, res) => {
  const { id } = req.params
  const {
    aceptada,
    fecha_cita,
    hora_cita,
    notas,
    estado: nuevoEstadoPropuesto
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
    let estadoFinal = citaExistente.estado // Por defecto, mantener el estado actual

    if (typeof aceptada !== 'undefined') {
      updates.push('aceptada = ?')
      args.push(aceptada ? 1 : 0)
      // Actualizar estado basado en 'aceptada' si no se provee un 'nuevoEstadoPropuesto' específico
      if (!nuevoEstadoPropuesto) {
        estadoFinal = aceptada ? 'confirmada' : 'pendiente'
      }
    }

    if (nuevoEstadoPropuesto) {
      // Si se envía un estado específico, usarlo
      // Validar que el nuevoEstadoPropuesto sea uno de los permitidos
      const estadosValidos = [
        'pendiente',
        'confirmada',
        'cancelada',
        'completada',
        'atendida'
      ]
      if (estadosValidos.includes(nuevoEstadoPropuesto)) {
        estadoFinal = nuevoEstadoPropuesto
      } else {
        // Si no es válido, no cambiar el estado o manejar error.
        // Por ahora, no lo cambiaremos si no es válido y no se cambió por 'aceptada'.
        console.warn(
          `Estado propuesto '${nuevoEstadoPropuesto}' no es válido. Se mantendrá '${estadoFinal}'.`
        )
      }
    }

    // Solo añadir el estado a 'updates' si realmente cambió o si se está actualizando 'aceptada'
    if (
      estadoFinal !== citaExistente.estado ||
      typeof aceptada !== 'undefined'
    ) {
      updates.push('estado = ?')
      args.push(estadoFinal)
    }

    if (fecha_cita) {
      updates.push('fecha_cita = ?')
      args.push(fecha_cita)
      // Si se reagenda, volver a pendiente y no aceptada
      if (!updates.includes('estado = ?')) {
        // Evitar duplicar si ya se añadió por 'aceptada' o 'nuevoEstadoPropuesto'
        updates.push('estado = ?')
        args.push('pendiente')
      } else {
        // Si ya está, asegurarse que sea 'pendiente'
        const estadoIndex = updates.indexOf('estado = ?')
        args[estadoIndex] = 'pendiente'
      }
      if (!updates.includes('aceptada = ?')) {
        updates.push('aceptada = ?')
        args.push(0)
      } else {
        const aceptadaIndex = updates.indexOf('aceptada = ?')
        args[aceptadaIndex] = 0
      }
    }
    if (hora_cita) {
      updates.push('hora_cita = ?')
      args.push(hora_cita)
    }
    if (typeof notas !== 'undefined') {
      updates.push('notas = ?')
      args.push(notas)
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
    // Devolver el mensaje de error de SQLite si es una violación de constraint
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
