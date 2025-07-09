import { getDb } from '../database/connection.js'

export const crearCita = async (req, res) => {
  const {
    nombre_cliente,
    telefono_cliente,
    fecha_cita,
    hora_cita,
    servicios_ids,
    notas
  } = req.body

  if (
    !nombre_cliente ||
    !telefono_cliente ||
    !fecha_cita ||
    !hora_cita ||
    !servicios_ids ||
    !Array.isArray(servicios_ids) ||
    servicios_ids.length === 0
  ) {
    return res.status(400).json({
      message:
        'Todos los campos marcados con * son obligatorios y debe seleccionar al menos un servicio.'
    })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const placeholders = servicios_ids.map(() => '?').join(',')
    const { rows: subcategorias } = await db.execute({
      sql: `SELECT id FROM Subcategorias WHERE id IN (${placeholders}) AND activo = 1`,
      args: servicios_ids
    })

    if (subcategorias.length !== servicios_ids.length) {
      return res.status(400).json({
        message:
          'Uno o más de los servicios seleccionados no son válidos o no están disponibles.'
      })
    }

    const citaResult = await db.execute({
      sql: 'INSERT INTO Citas (nombre_cliente, telefono_cliente, fecha_cita, hora_cita, notas, estado, aceptada) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        nombre_cliente,
        telefono_cliente,
        fecha_cita,
        hora_cita,
        notas ?? null,
        'pendiente',
        0
      ]
    })

    const citaId = citaResult?.lastInsertRowid
      ? Number(citaResult.lastInsertRowid)
      : null

    if (!citaId) {
      return res
        .status(500)
        .json({ message: 'Error al crear la cita, no se obtuvo ID.' })
    }

    const stmts = servicios_ids.map((servicioId) => ({
      sql: 'INSERT INTO CitaServicios (id_cita, id_subcategoria) VALUES (?, ?)',
      args: [citaId, servicioId]
    }))

    await db.batch(stmts, 'write')

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
        c.notas, c.estado, c.aceptada,
        c.fecha_creacion, c.fecha_actualizacion,
        GROUP_CONCAT(s.id) as servicios_ids,
        GROUP_CONCAT(s.nombre) as servicios_nombres,
        GROUP_CONCAT(cp.nombre) as categorias_padre_nombres
      FROM Citas c
      LEFT JOIN CitaServicios cs ON c.id = cs.id_cita
      LEFT JOIN Subcategorias s ON cs.id_subcategoria = s.id
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

    sql += ' GROUP BY c.id'
    sql += ' ORDER BY c.fecha_cita ASC, c.hora_cita ASC'

    const { rows: citas } = await db.execute({ sql, args })

    const citasConServicios = citas.map((cita) => {
      const servicios = []
      if (
        cita.servicios_ids &&
        cita.servicios_nombres &&
        cita.categorias_padre_nombres
      ) {
        const ids = cita.servicios_ids.split(',')
        const nombres = cita.servicios_nombres.split(',')
        const categoriasPadre = cita.categorias_padre_nombres.split(',')
        for (let i = 0; i < ids.length; i++) {
          servicios.push({
            id: parseInt(ids[i], 10),
            nombre: nombres[i],
            categoria_padre: categoriasPadre[i]
          })
        }
      }
      delete cita.servicios_ids
      delete cita.servicios_nombres
      delete cita.categorias_padre_nombres
      return { ...cita, servicios }
    })

    return res.status(200).json(citasConServicios)
  } catch (error) {
    console.error('Error al obtener citas para admin:', error)
    return res
      .status(500)
      .json({ message: 'Error interno del servidor al obtener citas.' })
  }
}

export const updateCita = async (req, res) => {
  const { id } = req.params
  const {
    nombre_cliente,
    telefono_cliente,
    fecha_cita,
    hora_cita,
    servicios_ids,
    notas,
    aceptada,
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
    if (typeof notas !== 'undefined') {
      updates.push('notas = ?')
      args.push(notas)
    }

    if (typeof aceptada !== 'undefined') {
      const isAccepted = aceptada ? 1 : 0
      updates.push('aceptada = ?')
      args.push(isAccepted)
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

    if (updates.length > 0) {
      updates.push("fecha_actualizacion = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')")
      args.push(id)
      const sql = `UPDATE Citas SET ${updates.join(', ')} WHERE id = ?`
      await db.execute({ sql, args })
    }

    if (
      servicios_ids &&
      Array.isArray(servicios_ids) &&
      servicios_ids.length > 0
    ) {
      const stmts = [
        { sql: 'DELETE FROM CitaServicios WHERE id_cita = ?', args: [id] }
      ]
      servicios_ids.forEach((servicioId) => {
        stmts.push({
          sql: 'INSERT INTO CitaServicios (id_cita, id_subcategoria) VALUES (?, ?)',
          args: [id, servicioId]
        })
      })
      await db.batch(stmts, 'write')
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
    servicios_ids,
    notas
  } = req.body

  if (
    !nombre_cliente ||
    !telefono_cliente ||
    !fecha_cita ||
    !hora_cita ||
    !servicios_ids ||
    !Array.isArray(servicios_ids) ||
    servicios_ids.length === 0
  ) {
    return res.status(400).json({
      message:
        'Todos los campos son obligatorios y debe seleccionar al menos un servicio.'
    })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const placeholders = servicios_ids.map(() => '?').join(',')
    const { rows: subcategorias } = await db.execute({
      sql: `SELECT id FROM Subcategorias WHERE id IN (${placeholders}) AND activo = 1`,
      args: servicios_ids
    })

    if (subcategorias.length !== servicios_ids.length) {
      return res.status(400).json({
        message:
          'Uno o más de los servicios seleccionados no son válidos o no están disponibles.'
      })
    }

    const citaResult = await db.execute({
      sql: 'INSERT INTO Citas (nombre_cliente, telefono_cliente, fecha_cita, hora_cita, notas, estado, aceptada) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        nombre_cliente,
        telefono_cliente,
        fecha_cita,
        hora_cita,
        notas ?? null,
        'confirmada',
        1
      ]
    })

    const citaId = citaResult?.lastInsertRowid
      ? Number(citaResult.lastInsertRowid)
      : null

    if (!citaId) {
      return res
        .status(500)
        .json({ message: 'Error al crear la cita, no se obtuvo ID.' })
    }

    const stmts = servicios_ids.map((servicioId) => ({
      sql: 'INSERT INTO CitaServicios (id_cita, id_subcategoria) VALUES (?, ?)',
      args: [citaId, servicioId]
    }))

    await db.batch(stmts, 'write')

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
