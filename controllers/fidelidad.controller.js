import { getDb } from '../database/connection.js'

const generarCodigoUnico = async (db) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let codigo = ''
  let codigoExiste = true

  while (codigoExiste) {
    codigo = ''
    for (let i = 0; i < 4; i++) {
      codigo += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const { rows } = await db.execute({
      sql: 'SELECT id FROM TarjetasFidelidad WHERE codigo = ?',
      args: [codigo]
    })
    if (rows.length === 0) {
      codigoExiste = false
    }
  }
  return codigo
}

export const registrarTarjeta = async (req, res) => {
  const { nombre_cliente, telefono_cliente } = req.body
  if (!nombre_cliente || !telefono_cliente) {
    return res
      .status(400)
      .json({ message: 'El nombre y el teléfono son obligatorios.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows: existingCard } = await db.execute({
      sql: 'SELECT id FROM TarjetasFidelidad WHERE telefono_cliente = ?',
      args: [telefono_cliente]
    })

    if (existingCard.length > 0) {
      return res
        .status(409)
        .json({ message: 'Ya existe una tarjeta con este número de teléfono.' })
    }

    const codigo = await generarCodigoUnico(db)

    const result = await db.execute({
      sql: 'INSERT INTO TarjetasFidelidad (codigo, nombre_cliente, telefono_cliente, ciclos_completados, canje_disponible) VALUES (?, ?, ?, 0, 0)',
      args: [codigo, nombre_cliente, telefono_cliente]
    })

    const newCardId = result.lastInsertRowid
    const {
      rows: [nuevaTarjeta]
    } = await db.execute({
      sql: 'SELECT * FROM TarjetasFidelidad WHERE id = ?',
      args: [newCardId]
    })

    return res.status(201).json({
      message: 'Tarjeta de fidelidad creada exitosamente.',
      tarjeta: nuevaTarjeta
    })
  } catch (error) {
    console.error('Error al registrar tarjeta:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const obtenerTarjetas = async (req, res) => {
  const { search = '' } = req.query
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    let sql = 'SELECT * FROM TarjetasFidelidad'
    const args = []

    if (search) {
      sql += ' WHERE nombre_cliente LIKE ? OR telefono_cliente LIKE ?'
      args.push(`%${search}%`, `%${search}%`)
    }

    sql += ' ORDER BY fecha_creacion DESC'

    const { rows } = await db.execute({ sql, args })

    return res.status(200).json(rows)
  } catch (error) {
    console.error('Error al obtener tarjetas:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const obtenerTarjetaPorCodigo = async (req, res) => {
  const { codigo } = req.params
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const {
      rows: [tarjeta]
    } = await db.execute({
      sql: 'SELECT * FROM TarjetasFidelidad WHERE codigo = ?',
      args: [codigo.toUpperCase()]
    })

    if (!tarjeta) {
      return res.status(404).json({ message: 'Tarjeta no encontrada.' })
    }

    return res.status(200).json(tarjeta)
  } catch (error) {
    console.error('Error al obtener tarjeta por código:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const obtenerTarjetaPorTelefono = async (req, res) => {
  const { telefono } = req.query
  if (!telefono) {
    return res
      .status(400)
      .json({ message: 'El número de teléfono es requerido.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const {
      rows: [tarjeta]
    } = await db.execute({
      sql: 'SELECT * FROM TarjetasFidelidad WHERE telefono_cliente = ?',
      args: [telefono]
    })

    if (!tarjeta) {
      return res.status(404).json({
        message: 'No se encontró una tarjeta con ese número de teléfono.'
      })
    }

    return res.status(200).json(tarjeta)
  } catch (error) {
    console.error('Error al obtener tarjeta por teléfono:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const editarVisitas = async (req, res) => {
  const { id } = req.params
  const { visitas } = req.body

  // CAMBIO: El número de visitas debe ser entre 0 y 4.
  if (typeof visitas !== 'number' || visitas < 0 || visitas > 4) {
    return res
      .status(400)
      .json({ message: 'El número de visitas debe ser entre 0 y 4.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const {
      rows: [tarjetaActual]
    } = await db.execute({
      sql: 'SELECT visitas_acumuladas, canje_disponible FROM TarjetasFidelidad WHERE id = ?',
      args: [id]
    })

    if (!tarjetaActual) {
      return res.status(404).json({ message: 'Tarjeta no encontrada.' })
    }

    // CAMBIO: La condición para reducir visitas es ahora sobre 4
    if (tarjetaActual.canje_disponible === 1 && visitas < 4) {
      return res.status(400).json({
        message:
          'No se puede reducir las visitas si hay un canje disponible. Primero canjee el premio.'
      })
    }

    const stmts = []
    const visitasAnteriores = tarjetaActual.visitas_acumuladas
    // CAMBIO: El canje se activa cuando las visitas son igual a 4
    const canjeDisponible = visitas === 4 ? 1 : 0

    let sqlUpdate =
      'UPDATE TarjetasFidelidad SET visitas_acumuladas = ?, canje_disponible = ?'
    const argsUpdate = [visitas, canjeDisponible]

    if (visitas > visitasAnteriores) {
      sqlUpdate += ", ultima_visita = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')"
    }
    sqlUpdate += ' WHERE id = ?'
    argsUpdate.push(id)
    stmts.push({ sql: sqlUpdate, args: argsUpdate })

    stmts.push({
      sql: 'DELETE FROM VisitasFidelidad WHERE id_tarjeta = ?',
      args: [id]
    })

    if (visitas > 0) {
      for (let i = 1; i <= visitas; i++) {
        stmts.push({
          sql: 'INSERT INTO VisitasFidelidad (id_tarjeta, numero_visita) VALUES (?, ?)',
          args: [id, i]
        })
      }
    }

    await db.batch(stmts, 'write')

    const {
      rows: [tarjetaActualizada]
    } = await db.execute({
      sql: 'SELECT * FROM TarjetasFidelidad WHERE id = ?',
      args: [id]
    })

    return res.status(200).json({
      message: 'Visitas actualizadas correctamente.',
      tarjeta: tarjetaActualizada
    })
  } catch (error) {
    console.error('Error al editar visitas:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const canjearTarjeta = async (req, res) => {
  const { id } = req.params

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const {
      rows: [tarjeta]
    } = await db.execute({
      sql: 'SELECT canje_disponible FROM TarjetasFidelidad WHERE id = ?',
      args: [id]
    })

    if (!tarjeta) {
      return res.status(404).json({ message: 'Tarjeta no encontrada.' })
    }
    if (tarjeta.canje_disponible !== 1) {
      return res.status(400).json({
        message: 'Esta tarjeta no tiene un premio disponible para canjear.'
      })
    }

    const stmts = [
      {
        sql: "UPDATE TarjetasFidelidad SET visitas_acumuladas = 0, canje_disponible = 0, ciclos_completados = ciclos_completados + 1, ultima_visita = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE id = ?",
        args: [id]
      },
      {
        sql: 'DELETE FROM VisitasFidelidad WHERE id_tarjeta = ?',
        args: [id]
      }
    ]

    await db.batch(stmts, 'write')

    return res
      .status(200)
      .json({ message: 'Premio canjeado y tarjeta reiniciada exitosamente.' })
  } catch (error) {
    console.error('Error al canjear tarjeta:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const obtenerHistorialVisitas = async (req, res) => {
  const { id } = req.params
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows } = await db.execute({
      sql: 'SELECT * FROM VisitasFidelidad WHERE id_tarjeta = ? ORDER BY fecha_visita DESC',
      args: [id]
    })

    return res.status(200).json(rows)
  } catch (error) {
    console.error('Error al obtener historial de visitas:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}
