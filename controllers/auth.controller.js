import { getDb } from '../database/connection.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10
const jwtSecretKey = process.env.JWT_SECRET_KEY
const jwtExpirationTime = process.env.JWT_EXPIRATION_TIME || '7d'

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
      args: [username, hashedPassword, nombre || null, apellido || null]
    })

    const userId = result?.lastInsertRowid
      ? Number(result.lastInsertRowid)
      : null

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: userId,
        username,
        nombre: nombre || null,
        apellido: apellido || null
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
      sql: 'SELECT * FROM Usuarios WHERE username = ?',
      args: [username]
    })

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }

    const user = users[0]

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }

    await db.execute({
      sql: 'UPDATE Usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?',
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
      expiresInMs = 24 * 60 * 60 * 1000
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
          expiresInMs = 24 * 60 * 60 * 1000
          console.warn(
            `Unidad de JWT_EXPIRATION_TIME desconocida ('${unit}'), usando 24h por defecto para la cookie.`
          )
      }
    }

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(Date.now() + expiresInMs),
      sameSite: 'none',
      domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost'
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

    if (!token) {
      return res.status(400).json({
        message: 'No hay sesión activa',
        authenticated: false
      })
    }

    const db = await getDb()
    if (!db) {
      console.warn(
        'Base de datos no disponible durante el logout. Procediendo a borrar solo la cookie.'
      )
    } else {
      try {
        await db.execute({
          sql: 'UPDATE Sesiones SET activa = 0 WHERE token = ?',
          args: [token]
        })
      } catch (dbError) {
        console.error('Error al invalidar token en BD durante logout:', dbError)
      }
    }

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
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
  if (!req.user) {
    return res.status(401).json({ message: 'Usuario no autenticado.' })
  }

  return res.status(200).json({
    message: 'Usuario autenticado exitosamente.',
    user: {
      id: req.user.userId,
      username: req.user.username
    }
  })
}
