import { getDb } from '../database/connection.js'

export const getAllConfiguraciones = async (req, res) => {
  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows: configs } = await db.execute(
      'SELECT id, clave, valor FROM ConfiguracionesSitio'
    )
    return res.status(200).json(configs)
  } catch (error) {
    console.error('Error al obtener configuraciones:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const updateConfiguracion = async (req, res) => {
  const { clave, valor } = req.body

  if (!clave || typeof valor === 'undefined') {
    // Permitir string vacío para valor
    return res
      .status(400)
      .json({ message: 'La clave y el valor son obligatorios.' })
  }

  // Validar que el valor sea un string JSON si es necesario, o permitir cualquier string
  // Aquí asumimos que el frontend envía un string (que puede ser un JSON stringificado)
  if (typeof valor !== 'string') {
    return res.status(400).json({
      message: 'El valor debe ser un string (puede ser JSON stringificado).'
    })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    // Intentar un UPSERT (INSERT OR UPDATE)
    // SQLite maneja esto con INSERT ... ON CONFLICT (...) DO UPDATE SET ...
    await db.execute({
      sql: `
        INSERT INTO ConfiguracionesSitio (clave, valor)
        VALUES (?, ?)
        ON CONFLICT(clave)
        DO UPDATE SET valor = excluded.valor, fecha_actualizacion = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
      `,
      args: [clave, valor]
    })

    const {
      rows: [updatedConfig]
    } = await db.execute({
      sql: 'SELECT id, clave, valor FROM ConfiguracionesSitio WHERE clave = ?',
      args: [clave]
    })

    return res.status(200).json({
      message: `Configuración '${clave}' guardada exitosamente.`,
      configuracion: updatedConfig
    })
  } catch (error) {
    console.error(`Error al guardar configuración '${clave}':`, error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}
