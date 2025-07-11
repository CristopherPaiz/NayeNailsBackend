export const parseUserAgent = (uaString) => {
  if (!uaString) {
    return {
      browser_name: 'Desconocido',
      os_name: 'Desconocido',
      device_type: 'Desconocido'
    }
  }

  let browser_name = 'Desconocido'
  let os_name = 'Desconocido'
  let device_type = 'desktop'

  // Detectar OS
  if (/windows/i.test(uaString)) os_name = 'Windows'
  else if (/macintosh|mac os x/i.test(uaString)) os_name = 'macOS'
  else if (/android/i.test(uaString)) os_name = 'Android'
  else if (/iphone|ipad|ipod/i.test(uaString)) os_name = 'iOS'
  else if (/linux/i.test(uaString)) os_name = 'Linux'

  // Detectar Navegador
  if (/edg/i.test(uaString)) browser_name = 'Edge'
  else if (/chrome/i.test(uaString)) browser_name = 'Chrome'
  else if (/safari/i.test(uaString)) browser_name = 'Safari'
  else if (/firefox/i.test(uaString)) browser_name = 'Firefox'
  else if (/msie|trident/i.test(uaString)) browser_name = 'Internet Explorer'

  // Detectar Tipo de Dispositivo
  if (/mobi|android|iphone/i.test(uaString)) {
    device_type = 'mobile'
  } else if (/ipad|tablet/i.test(uaString)) {
    device_type = 'tablet'
  }

  return { browser_name, os_name, device_type }
}
