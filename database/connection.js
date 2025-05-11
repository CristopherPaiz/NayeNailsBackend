import { createClient } from '@libsql/client'
import dotenv from 'dotenv'
dotenv.config()

let turso
let retryCount = 0
const maxRetries = 5

const connectWithRetry = () => {
  try {
    turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    })
    console.log('Base de datos Turso conectada con éxito')
    retryCount = 0 // Reiniciar el contador si la conexión es exitosa
  } catch (err) {
    retryCount++
    console.error(
      `Falló al conectar a la BD (Intento ${retryCount} de ${maxRetries}):`,
      err
    )

    if (retryCount < maxRetries) {
      console.log(
        `Reintentando conexión en 5 segundos... (Intento ${retryCount} de ${maxRetries})`
      )
      setTimeout(connectWithRetry, 5000)
    } else {
      console.error(
        'Se alcanzó el número máximo de intentos de conexión. No se realizarán más reintentos.'
      )
    }
  }
}

// Intentar conectar al iniciar la aplicación
connectWithRetry()

export { turso }
