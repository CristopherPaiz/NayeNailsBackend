import dotenv from 'dotenv'
dotenv.config()
const jwtSecretKey = process.env.JWT_SECRET_KEY

// Middleware para verificar la autenticación
export const authMiddleware = (req, res, next) => {
  const token = req.cookies.token

  if (!token) {
    return res
      .status(401)
      .json({ message: 'Acceso denegado. Se requiere autenticación.' })
  }

  try {
    const decoded = jwt.verify(token, jwtSecretKey)
    req.user = decoded
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.clearCookie('token')
      return res.status(401).json({
        message: 'Sesión expirada. Por favor inicie sesión nuevamente.'
      })
    }
    return res.status(403).json({ message: 'Token inválido' })
  }
}
