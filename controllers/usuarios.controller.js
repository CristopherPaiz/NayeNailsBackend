import { getDb } from '../database/connection.js'
import bcrypt from 'bcrypt'

const saltRounds = parseInt(process.env.SALT_ROUNDS) ?? 10

export const updateMyNombre = async (req, res) => {
  const { nombre } = req.body
  const userId = req.user?.userId

  if (!userId) {
    return res.status(401).json({ message: 'No autorizado' })
  }
  if (typeof nombre !== 'string') {
    return res.status(400).json({ message: 'El nombre debe ser un texto.' })
  }
  if (nombre.trim().length === 0 || nombre.trim().length > 100) {
    return res
      .status(400)
      .json({ message: 'El nombre debe tener entre 1 y 100 caracteres.' })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    await db.execute({
      sql: 'UPDATE Usuarios SET nombre = ? WHERE id = ?',
      args: [nombre.trim(), userId]
    })

    return res
      .status(200)
      .json({ message: 'Nombre actualizado correctamente.' })
  } catch (error) {
    console.error('Error al actualizar nombre:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export const updateMyPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const userId = req.user?.userId

  if (!userId) {
    return res.status(401).json({ message: 'No autorizado' })
  }
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: 'Todos los campos de contraseña son obligatorios.' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({
      message: 'La nueva contraseña debe tener al menos 6 caracteres.'
    })
  }

  try {
    const db = await getDb()
    if (!db)
      return res.status(503).json({ message: 'Base de datos no disponible.' })

    const { rows: users } = await db.execute({
      sql: 'SELECT password FROM Usuarios WHERE id = ?',
      args: [userId]
    })

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' })
    }

    const user = users[0]
    const passwordMatch = await bcrypt.compare(currentPassword, user.password)

    if (!passwordMatch) {
      return res
        .status(403)
        .json({ message: 'La contraseña actual es incorrecta.' })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)
    await db.execute({
      sql: 'UPDATE Usuarios SET password = ? WHERE id = ?',
      args: [hashedNewPassword, userId]
    })

    return res
      .status(200)
      .json({ message: 'Contraseña actualizada correctamente.' })
  } catch (error) {
    console.error('Error al actualizar contraseña:', error)
    return res.status(500).json({ message: 'Error interno del servidor.' })
  }
}
