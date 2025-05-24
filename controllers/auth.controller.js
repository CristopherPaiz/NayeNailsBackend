import { getDb } from '../database/connection.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const saltRounds = parseInt(process.env.SALT_ROUNDS) ?? 10
const jwtSecretKey = process.env.JWT_SECRET_KEY
const jwtExpirationTime = process.env.JWT_EXPIRATION_TIME ?? '7d'

export const register = async (req, res) => {
  const { username, password, nombre, apellido } = req.body
  console.log('Intento de registro para:', username)

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Nombre de usuario y contraseña son obligatorios' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({
        message: 'Base de datos no disponible temporalmente. Intente más tarde.'
      })
    }

    const { rows: existingUsers } = await db.execute({
      sql: 'SELECT * FROM Usuarios WHERE username = ?',
      args: [username]
    })

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Usuario ya existe' })
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const result = await db.execute({
      sql: 'INSERT INTO Usuarios (username, password, nombre, apellido) VALUES (?, ?, ?, ?)',
      args: [username, hashedPassword, nombre ?? null, apellido ?? null]
    })

    const userId = result?.lastInsertRowid
      ? Number(result.lastInsertRowid)
      : null

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: userId,
        username,
        nombre: nombre ?? null,
        apellido: apellido ?? null
      }
    })
  } catch (error) {
    console.error('Error registrando usuario:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

export const login = async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Nombre de usuario y contraseña son obligatorios' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({
        message: 'Base de datos no disponible temporalmente. Intente más tarde.'
      })
    }

    const { rows: users } = await db.execute({
      sql: 'SELECT * FROM Usuarios WHERE username = ? AND activo = 1', // Asegurar que el usuario esté activo
      args: [username]
    })

    if (users.length === 0) {
      return res
        .status(401)
        .json({ message: 'Credenciales inválidas o usuario inactivo' })
    }

    const user = users[0]

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }

    await db.execute({
      sql: "UPDATE Usuarios SET ultimo_login = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE id = ?",
      args: [user.id]
    })

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecretKey,
      { expiresIn: jwtExpirationTime }
    )

    let expiresInMs
    const unit = jwtExpirationTime.slice(-1).toLowerCase()
    const value = parseInt(jwtExpirationTime.slice(0, -1))

    if (isNaN(value)) {
      expiresInMs = 24 * 60 * 60 * 1000 // 24 horas por defecto
      console.warn(
        `Formato de JWT_EXPIRATION_TIME inválido ('${jwtExpirationTime}'), usando 24h por defecto para la cookie.`
      )
    } else {
      switch (unit) {
        case 's':
          expiresInMs = value * 1000
          break
        case 'm':
          expiresInMs = value * 60 * 1000
          break
        case 'h':
          expiresInMs = value * 60 * 60 * 1000
          break
        case 'd':
          expiresInMs = value * 24 * 60 * 60 * 1000
          break
        case 'w':
          expiresInMs = value * 7 * 24 * 60 * 60 * 1000
          break
        default:
          expiresInMs = 24 * 60 * 60 * 1000 // 24 horas por defecto
          console.warn(
            `Unidad de JWT_EXPIRATION_TIME desconocida ('${unit}'), usando 24h por defecto para la cookie.`
          )
      }
    }

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true en producción
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' para cross-site, 'lax' para desarrollo
      expires: new Date(Date.now() + expiresInMs),
      path: '/'
    })

    const expirationDate = new Date(Date.now() + expiresInMs)
    await db.execute({
      sql: 'INSERT INTO Sesiones (usuario_id, token, fecha_expiracion) VALUES (?, ?, ?)',
      args: [user.id, token, expirationDate.toISOString()]
    })

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        apellido: user.apellido
      }
    })
  } catch (error) {
    console.error('Error en inicio de sesión:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

export const logout = async (req, res) => {
  try {
    const token = req.cookies.token

    if (token) {
      const db = await getDb()
      if (db) {
        try {
          await db.execute({
            sql: 'UPDATE Sesiones SET activa = 0 WHERE token = ?',
            args: [token]
          })
        } catch (dbError) {
          console.error(
            'Error al invalidar token en BD durante logout:',
            dbError
          )
        }
      } else {
        console.warn('Base de datos no disponible durante el logout.')
      }
    }

    res.cookie('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      expires: new Date(0),
      path: '/'
    })

    return res.status(200).json({
      message: 'Sesión cerrada exitosamente',
      authenticated: false
    })
  } catch (error) {
    console.error('Error en cierre de sesión:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

export const getMe = async (req, res) => {
  if (!req.user?.userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' })
  }

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ message: 'Base de datos no disponible.' })
    }

    const { rows: users } = await db.execute({
      sql: 'SELECT id, username, nombre, apellido, activo FROM Usuarios WHERE id = ?',
      args: [req.user.userId]
    })

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' })
    }

    const user = users[0]

    if (!user.activo) {
      res.clearCookie('token') // Limpiar cookie si el usuario está inactivo
      return res
        .status(403)
        .json({ message: 'La cuenta de usuario está inactiva.' })
    }

    return res.status(200).json({
      message: 'Usuario autenticado exitosamente.',
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        apellido: user.apellido
      }
    })
  } catch (error) {
    console.error('Error en getMe:', error)
    return res.status(500).json({
      message: 'Error interno del servidor al obtener datos del usuario.'
    })
  }
}
