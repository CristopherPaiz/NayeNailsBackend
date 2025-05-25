import { getDb } from '../database/connection.js'

export const registrarVisita = async (req, res) => {
  const ipAddressOriginal =
    req.ip ||
    req.headers['x-forwarded-for']
      ?.split(',')
      .map((ip) => ip.trim())
      .shift() ||
    req.socket?.remoteAddress

  const ipAddressValida = ipAddressOriginal || 'Desconocida'
  const userAgent = req.headers['user-agent'] || 'Desconocido'

  try {
    const db = await getDb()
    if (!db) {
      console.warn('Registro de visita: BD no disponible.')
      // Devolver 204 para no interrumpir al cliente en una operación de fondo
      return res.status(204).send()
    }

    // Verificar si ya existe una visita para esta IP en el día actual
    // Usamos DATE('now') para la fecha actual en UTC, consistente con otras partes del código.
    const { rows: existingVisits } = await db.execute({
      sql: "SELECT id FROM Visitas WHERE ip_address = ? AND DATE(fecha_visita) = DATE('now') LIMIT 1",
      args: [ipAddressValida]
    })

    if (existingVisits.length > 0) {
      // Ya existe un registro para esta IP hoy, no hacer nada.
      return res.status(204).send()
    }

    // Si no existe, registrar la nueva visita
    // Incluir fecha_visita explícitamente. Asumimos que la tabla tiene este campo.
    await db.execute({
      sql: "INSERT INTO Visitas (ip_address, user_agent, fecha_visita) VALUES (?, ?, STRFTIME('%Y-%m-%d %H:%M:%f', 'now'))",
      args: [ipAddressValida, userAgent]
    })

    return res.status(204).send()
  } catch (error) {
    console.error('Error al registrar visita:', error)
    // Aunque haya un error, es una operación de fondo, no alertar al usuario.
    return res.status(204).send()
  }
}
