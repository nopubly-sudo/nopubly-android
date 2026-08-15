# 🧪 Nopubly QA & Stress Testing Guide

**Objective**: Verify that Nopubly is robust ("doesn't collapse") and effectively detects threats in real-world scenarios.

## 1. Stability & Stress Test ( The "Collapse" Test)
*Goal: Ensure the app handles heavy usage without crashing.*

1.  **The "Spam" Test**:
    *   Open Nopubly.
    *   Tap the **"SCAN NOW"** button.
    *   **Action**: While scanning, try to tap the button again repeatedly.
    *   **Pass Condition**: The button should be disabled (greyed out) or ignore clicks until the scan finishes. The app should NOT crash.
2.  **The "Background" Test**:
    *   Start a Scan.
    *   Immediately minimize the app (go to home screen).
    *   Wait 5 seconds.
    *   Open Nopubly again.
    *   **Pass Condition**: The scan should have completed or be continuing without a blank screen.

## 2. Detection Efficacy (The "Real Value" Test)
*Goal: Prove to yourself that the scanner works by finding "safe" spies.*

**Note**: Do NOT install real malware. Use these common apps to trigger our detectors safely:

| App Type | Install This (Example) | Expected Badge | Why? |
| :--- | :--- | :--- | :--- |
| **Spyware (Mic)** | Any "Voice Recorder" App | **🎤 MIC** (Amber) | It asks for `RECORD_AUDIO`. |
| **Spyware (Cam)** | Instagram / Snapchat | **📷 CAM** (Pink) | It asks for `CAMERA` access. |
| **Tracker** | Any "Free Compass" or "Flashlight" | **📍 TRACKER** (Purple) | Many older ones ask for `FINE_LOCATION`. |
| **Malware** | *Self-Test Only* | **☣️ MALWARE** (Red) | *We added a test signature: `com.nopubly.test` (if implemented)* |

## 3. Viral Loop Test
*Goal: Verify the "Crown Jewel" growth feature.*

1.  Run a Scan.
2.  Wait for the "Scan Complete" or "Clean" alert.
3.  Tap **"Tell Friends?"** (EN) or **"¿Avisar a amigos?"** (ES).
4.  **Pass Condition**: The system "Share Sheet" opens with our pre-written viral message and link `https://nopubly.com`.

## 4. Emergency Button Test
1.  Tap **"⚠️ STOP INTERFERING APPS"** (or Spanish equivalent).
2.  **Pass Condition**: It should immediately open the Android System Settings for **"Display Over Other Apps"**. This proves we give control back to the user.

---

# 🇪🇸 Guía de Pruebas de Estrés y QA (Español)

**Objetivo**: Verificar que Nopubly es robusto ("no colapsa") y detecta amenazas eficazmente en escenarios reales.

## 1. Prueba de Estabilidad y Estrés (La Prueba de "Colapso")
*Meta: Asegurar que la app aguanta uso intenso sin cerrarse.*

1.  **La Prueba de "Spam"**:
    *   Abre Nopubly.
    *   Pulsa el botón **"ESCANEAR AHORA"**.
    *   **Acción**: Mientras escanea, intenta pulsar el botón repetidamente muchas veces.
    *   **Condición de Éxito**: El botón debe estar deshabilitado (gris) o ignorar los clics hasta que termine. La app NO debe cerrarse.
2.  **La Prueba de "Segundo Plano"**:
    *   Inicia un Escáner.
    *   Minimiza la app inmediatamente (ve a inicio).
    *   Espera 5 segundos.
    *   Abre Nopubly de nuevo.
    *   **Condición de Éxito**: El escaneo debe haber terminado o continuar sin mostrar una pantalla en blanco.

## 2. Eficacia de Detección (La Prueba de "Valor Real")
*Meta: Demostrarte a ti mismo que el escáner funciona encontrando espías "seguros".*

**Nota**: NO instales malware real. Usa estas apps comunes para activar nuestros detectores de forma segura:

| Tipo de App | Instala Esto (Ejemplo) | Etiqueta Esperada | ¿Por qué? |
| :--- | :--- | :--- | :--- |
| **Spyware (Micro)** | Grabadora de Voz | **🎤 MICRO** (Ámbar) | Pide permiso `RECORD_AUDIO`. |
| **Spyware (Cámara)** | Instagram / Snapchat | **📷 CÁMARA** (Rosa) | Pide acceso a `CAMERA`. |
| **Rastreador** | Brújula o Linterna Gratis | **📍 RASTREADOR** (Morado) | Muchas piden `FINE_LOCATION` (Ubicación Precisa). |
| **Malware** | *Solo Test Interno* | **☣️ MALWARE** (Rojo) | *Si implementamos la firma de prueba `com.nopubly.test`* |

## 3. Prueba del Bucle Viral
*Meta: Verificar la funcionalidad "Joya de la Corona" para el crecimiento.*

1.  Ejecuta un Escáner.
2.  Espera a la alerta de "Escaneo Completo" o "Limpio".
3.  Pulsa **"¿Avisar a amigos?"** (ES).
4.  **Condición de Éxito**: Se abre el menú de compartir del sistema con nuestro mensaje viral preescrito y el enlace `https://nopubly.com`.

## 4. Prueba del Botón de Emergencia
1.  Pulsa **"⚠️ DETENER INTERFERENCIAS"**.
2.  **Condición de Éxito**: Debe abrir inmediatamente los Ajustes del Sistema Android para **"Mostrar sobre otras apps"**. Esto demuestra que devolvemos el control al usuario.
