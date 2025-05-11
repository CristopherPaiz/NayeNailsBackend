import { turso } from '../database/connection.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10
const jwtSecretKey = process.env.JWT_SECRET_KEY
const jwtExpirationTime = process.env.JWT_EXPIRATION_TIME || '7d'

export const register = async (req, res) => {
  const { username, password, nombre, apellido } = req.body
  console.log('si llega')

  // Validar la entrada
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Nombre de usuario y contraseña son obligatorios' })
  }

  try {
    // Verificar si el usuario ya existe
    const { rows: existingUsers } = await turso.execute({
      sql: 'SELECT * FROM Usuarios WHERE username = ?',
      args: [username]
    })

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Usuario ya existe' })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Crear el nuevo usuario con campos opcionales
    const result = await turso.execute({
      sql: 'INSERT INTO Usuarios (username, password, nombre, apellido) VALUES (?, ?, ?, ?)',
      args: [username, hashedPassword, nombre || null, apellido || null]
    })

    console.log('result', result)

    // Convierte el BigInt a Number o String antes de enviarlo en la respuesta JSON
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

  console.log('llego aquí')
  // Validar la entrada
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Nombre de usuario y contraseña son obligatorios' })
  }

  try {
    // Buscar el usuario
    const { rows: users } = await turso.execute({
      sql: 'SELECT * FROM Usuarios WHERE username = ?',
      args: [username]
    })

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }

    const user = users[0]

    // Verificar la contraseña
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }

    // Actualizar último login
    await turso.execute({
      sql: 'UPDATE Usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?',
      args: [user.id]
    })

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecretKey,
      { expiresIn: jwtExpirationTime }
    )

    // Calcular tiempo de expiración para la cookie
    const expiresInMs = jwtExpirationTime.includes('h')
      ? parseInt(jwtExpirationTime) * 60 * 60 * 1000
      : jwtExpirationTime.includes('d')
      ? parseInt(jwtExpirationTime) * 24 * 60 * 60 * 1000
      : jwtExpirationTime.includes('w')
      ? parseInt(jwtExpirationTime) * 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000 // default 24 horas

    // Configurar la cookie con el token JWT
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' // Solo HTTPS en producción
    })

    // Opcional: Registrar la sesión en la base de datos
    const expirationDate = new Date(Date.now() + expiresInMs)
    await turso.execute({
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

    // Invalidar el token en la base de datos
    await turso.execute({
      sql: 'UPDATE Sesiones SET activa = 0 WHERE token = ?',
      args: [token]
    })

    // Eliminar la cookie del token
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
      id: req.user.userId, // Asegúrate que estos campos coincidan con los nombres
      username: req.user.username // que pusiste en el payload del token al crearlo.
    }
  })
}
