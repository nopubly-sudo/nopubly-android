# Auditoría de Preparación para Producción - Nopubly

## 🚦 Estado Actual: Beta (Prototipo Funcional)
La aplicación cumple con las funcionalidades prometidas (Bloqueo, Escáner, Anti-Overlay), pero el "motor" interno necesita ajustes antes de lanzarse a miles de usuarios.

## ⚠️ Puntos Críticos a Mejorar (Antes de Play Store)

### 1. Motor VPN (Batería y Estabilidad)
- **Situación Actual**: El `AdBlockVpnService` usa un bucle básico en Java.
- **Riesgo**: Puede consumir mucha batería y congelarse si hay mucho tráfico (descargas grandes, streaming).
- **Recomendación**: Optimizar el bucle de lectura/escritura o limitar el filtrado solo a paquetes DNS (Puerto 53) de manera más estricta para dejar pasar el tráfico pesado (Netflix, YouTube) sin procesarlo.

### 2. Cumplimiento con Google Play (Policy)
Google es **muy estricto** con las apps que usan `VpnService`.
- **Requisito**: Debes declarar explícitamente en la ficha de la tienda que usas VpnService para "Bloqueo de contenido no deseado".
- **Política de Privacidad**: Necesitas una URL pública que diga "No recopilamos datos de tráfico del usuario". **Sin esto, rechazarán la app.**

### 3. Persistencia
- A veces Android mata los servicios en segundo plano. Necesitamos asegurar que el servicio VPN tenga una notificación persistente (ya la tiene por defecto el VpnService, pero hay que verificar que sea informativa).

---

## 🚀 Estrategia de Pruebas y Lanzamiento

No lances directamente a Producción abierta. Sigue estos pasos:

### Fase 1: Pruebas Internas (El APK "Freeware")
Distribuye el APK manualmente a un grupo de confianza (5-10 personas).
**Objetivo**: Ver si la batería dura y si no se corta internet en diferentes modelos (Samsung, Xiaomi, Pixel tienen gestiones de batería distintas).

**Cómo generar el APK de prueba (Debug):**
1. Ejecuta: `cd android && ./gradlew assembleDebug`
2. El archivo estará en: `android/app/build/outputs/apk/debug/app-debug.apk`
3. Envíalo por Telegram/Drive a tus testers.

### Fase 2: Open Testing en Play Store
Una vez validada la batería:
1. Crea una cuenta de Desarrollador ($25 pago único).
2. Sube el **App Bundle (.aab)** (no el APK) al canal de "Pruebas Abiertas".
3. Esto te permite que cualquiera lo descargue desde la tienda pero con la etiqueta "Beta".

---

## 📝 Siguientes Pasos Recomendados

1. **[TÉCNICO]** Refinar el `AdBlockVpnService` para ignorar tráfico pesado (Streaming/Descargas) y ahorrar batería.
2. **[LEGAL]** Redactar una Política de Privacidad simple.
3. **[BUILD]** Generar el primer APK para tus pruebas.
