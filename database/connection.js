import { createClient } from '@libsql/client'
import dotenv from 'dotenv'
dotenv.config()

// Variable para almacenar el cliente
let turso = null
let isConnected = false
let retryCount = 0
const maxRetries = 5

// Función para conectar a la base de datos
const connectWithRetry = async () => {
  try {
    // Crear el cliente
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    })

    // Probar la conexión
    await client.execute({ sql: 'SELECT 1' })

    // Si llega aquí, la conexión fue exitosa
    turso = client
    isConnected = true
    console.log('Base de datos Turso conectada con éxito')
    retryCount = 0

    return client
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
      // Reintento usando promesa para evitar múltiples conexiones simultáneas
      return new Promise((resolve) => {
        setTimeout(() => resolve(connectWithRetry()), 5000)
      })
    } else {
      console.error(
        'Se alcanzó el número máximo de intentos de conexión. No se realizarán más reintentos.'
      )
      // Retornar null para indicar que no se pudo conectar
      return null
    }
  }
}

// Iniciar la conexión
const dbPromise = connectWithRetry()

// Exportar una función para obtener la conexión segura
export async function getDb() {
  if (isConnected && turso) {
    return turso
  }

  // Esperar a que se resuelva la conexión
  return await dbPromise
}

// Para compatibilidad con tu código actual
export { turso }
