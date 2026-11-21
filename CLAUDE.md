# Assistant Helper — contexto para Claude

Proyecto escolar del Equipo 7 (Secretariado, submódulo "Se comunica usando técnicas de expresión
oral en español e inglés"). Metodología Scrum. **Entrega v1.0: 2 de diciembre de 2026.**

- **Product Owner:** Mtra. Olvera Castelan Nalleli (la docente usuaria de la app)
- **Scrum Master:** Diego Infante Solis (quien trabaja conmigo; hablarle en español)
- **Repositorio:** https://github.com/infantesolisdieg-alt/ASSISTANT-HELPER (rama `main`)
- **Despliegue:** Vercel, importado desde GitHub → cada `git push` a `main` publica solo.
  **Sitio público: https://assistant-helper-pi.vercel.app** (panel: https://vercel.com/xt-0a1e/assistant-helper). Deployment Protection (Vercel Authentication) se desactivó el 2026-11-19 para que los profesores entren sin cuenta de Vercel. `assistant-helper.vercel.app` NO es nuestro (404).
- **Firebase:** proyecto `assistant-helper-6a777` (plan Spark). Google sign-in habilitado, Firestore (Standard, nam5, producción) con las reglas de `firestore.rules`. Dominios autorizados: localhost, firebaseapp.com, web.app, `assistant-helper-pi.vercel.app` y `assistant-helper-xt-0a1e.vercel.app`. Si Vercel da otro dominio público, agregarlo en Authentication → Configuración → Dominios autorizados.

## Qué es

Aplicación web 100 % del lado del cliente para que la docente revise trabajos de redacción en
inglés: similitud entre entregas (shingles de 5 palabras, solo contra archivos de la sesión),
validación de formato (.docx: fuente, tamaño, interlineado, márgenes, alineación; todos: palabras,
título, referencias, citas APA/MLA/Chicago), calidad de redacción (voz pasiva, oraciones > 35
palabras, palabras repetidas) e indicadores heurísticos de IA (siempre con aviso de que son
orientativos). Interfaz bilingüe inglés/español (desde v1.8); comentarios del código en español.

## Reglas que no se deben romper

- Sin backend propio ni servicios de pago. El análisis se hace en el navegador. Desde v1.4 hay nube opcional (Firebase Spark, gratis) solo para guardar datos de cada cuenta.
- Sin cuenta: nada se guarda (memoria). Con cuenta de Google: texto, resultados, grupos, perfil y configuración se guardan en Firestore del usuario; los archivos originales nunca se suben.
- No comparar contra internet. No offline/service worker. No soporte para celular: en < 1024 px
  se muestra "ASSISTANT HELPER is available on desktop computers only." (o su versión en español).
- **El nombre de la app nunca se traduce y siempre va en MAYÚSCULAS: `APP_NAME` = "ASSISTANT HELPER"** (src/i18n). Todo texto visible pasa por `t()`.
- `<html translate="no">` + `<meta name="google" content="notranslate">`; el atributo `lang` cambia con el idioma elegido.
- Estilo formal en tonos de rojo (#8B1E2D, #4A0D16, #F6E7E9…), serif Libre Baskerville para
  títulos y Source Sans 3 para la interfaz. Contraste ≥ 4.5:1, ningún texto < 12 px.

## Decisiones tomadas en las sesiones (más allá de la guía original)

- **Umbral de similitud:** Clear < umbral; Review de umbral a 29 %; High match ≥ 30 %. Se usa el
  porcentaje redondeado. Con umbral 30 % no existe "Review" (decisión literal de la guía).
- **Niveles de IA:** Low < 25 %, Moderate 25–44 %, Elevated ≥ 45 % (calibrados con las muestras).
- **Márgenes en centímetros** (por defecto 2.54 cm, tolerancia 0.1 cm).
- **Bienvenida del profesor (v1.1):** el usuario pidió "iniciar sesión / que no sea siempre el
  mismo profesor". Como el login real está fuera del alcance, se hizo una pantalla de bienvenida
  sin contraseña: nombre, rol y grupo, solo en memoria. Botón "Continue with the demo profile"
  (Nalleli). "Change teacher" borra todo (archivos, resultados y configuración).
- **"Clear temporary files"** borra documentos, resultados, notas y decisiones, pero conserva la
  configuración y el perfil.
- **Diseño "formal pero con vida" (elegido por el usuario):** gráficas propias en SVG (dona de
  progreso, barras de similitud con línea del umbral, indicadores circulares, minibarras),
  "Highlights", contadores animados, tarjeta "Session complete", transiciones suaves que se
  desactivan con prefers-reduced-motion. Sin librerías de gráficas.
- Colores de estado para gráficas validados con el validador de dataviz:
  ok #2F7D4C, warn #B0760C, bad #A3283A, neutral #A8999B; siempre acompañados de texto.
- **v1.3 (2026-11-18): documentos tal cual.** El usuario pidió analizar PDF e imágenes "sin pasarlos a texto" y analizar tablas y gráficos. Se hizo: vista "Original" (páginas del PDF con pdf.js, imagen, Word renderizado con tablas/imágenes/gráficas) con resaltados encima usando posiciones de texto (`src/extract/layout.ts`); OCR con tesseract.js (descarga los datos del idioma desde CDN, la imagen no se sube; máx. 15 páginas escaneadas); tablas, imágenes y gráficas nativas de Word (`src/extract/chart.ts`) y revisión de títulos "Table N"/"Figure N" (`src/analysis/figures.ts`). Límite honesto: sin IA en servidor no se interpreta el significado de una gráfica.
- **v1.4 (2026-11-19): cuenta de Google y nube.** El usuario pidió una nube gratis "que no cobre después", inicio de sesión con Google y guardar la información de cada usuario (esto cambia las reglas originales de "sin servidor / sin cuentas / no guardar"; lo decidió el Scrum Master). Se eligió **Firebase plan Spark** (sin tarjeta, no cobra; Storage ya no es gratis, así que NO se suben los archivos originales, solo texto y resultados). Proyecto: `assistant-helper-6a777`. Código en `src/cloud/` (config, cloud, serialize, CloudSync) y `firestore.rules`. Sin config, la app sigue en modo local.
- **Grupos y búsqueda (v1.4):** campo `group` por documento, pestañas/secciones por grupo en Submissions (`SubmissionsList.tsx`), búsqueda sin acentos con atajo "/" (`SearchBox.tsx`).
- **Google Drive (v1.5, 2026-11-19, verificado por el usuario):** botón "From Google Drive" en Upload (`src/cloud/drive.ts`): el permiso `drive.file` se pide con `signInWithPopup` de Firebase en una instancia aparte y en memoria (Google Identity Services daba `origin_mismatch` mientras Google aplicaba los orígenes) + Google Picker; descarga con Drive API v3 y exporta Google Docs a .docx. Configurado en Google Cloud (se aceptaron los Términos con permiso del usuario; NO se activó la prueba de pago de $300): Picker API y Drive API habilitadas, la clave del navegador permite Picker API (26 APIs), y el cliente web OAuth `648698892557-8t5f8gkh1fug1nih4snj5m6o49b60gm8` tiene como orígenes los dominios de Vercel y `http://localhost:5173`. Pantalla de permisos: En producción, usuarios externos.
- **Upload rediseñado (v1.6, 2026-11-20, probado por el usuario con Google Drive en el sitio publicado):** zona grande para arrastrar (clic para buscar, Ctrl+V para pegar) y tarjetas "This computer" / "Google Drive" al lado. Los archivos de Drive aparecen al instante como filas con su descarga y lectura (`source: 'drive'` en `DocItem`, icono de Drive en la fila). Cola de máximo 3 archivos a la vez (`limit` en `Upload.tsx`). Aviso de rechazados con botón para cerrar, chips Ready / In progress / Failed (con "Remove"), barra fija "Analyze N files" que explica por qué está desactivado y botón "Show" al primer nombre faltante. Tabla con anchos fijos (nombres largos con "…"). Ojo: `hasDoc` no conoce las filas hasta que React las dibuja; por eso Upload usa `fresh` + `alive()`.
- **Términos y privacidad (v1.7, 2026-11-20, probado por el usuario en el sitio publicado con Google y Drive):** el usuario pidió términos al inicio sobre el uso de la cuenta de Google y Drive. Texto en `public/terms.html` (página pública https://assistant-helper-pi.vercel.app/terms.html, también se muestra en la app con iframe; se puede poner en la pantalla de permisos de Google Cloud). Versión en `src/terms.ts` (`TERMS_VERSION`): si cambia, la app vuelve a pedir la aceptación. Bienvenida: casilla obligatoria para Google, sin cuenta y demo. Cuentas sin la versión actual ven `TermsGate` (aceptar o salir). La aceptación se guarda en `users/{uid}.terms`. Settings → "Privacy and terms": leer términos, administrar acceso de Google y "Delete my saved data" (`deleteAccountData`).
- **Selector de Drive (v1.7):** el contenido del Google Picker es un iframe de Google y no se puede rediseñar; se cambió lo posible: vista de lista (las miniaturas salían vacías con drive.file), pestaña Starred, título, fondo y marco rojo (`.picker-dialog` en styles.css) y un letrero de la app encima (`showBanner` en drive.ts).
- Corregido: regex sin barra en Settings (`/s+/` quitaba las "s" del nombre, "Solis" → "Soli").
- **Idioma inglés/español (v1.8, 2026-11-20):** el usuario pidió elegir idioma al registrarse, traducir todo según la opción, nunca traducir el título y ponerlo en mayúsculas en todos lados, y que el texto del login cambie solo entre español e inglés. Sistema propio sin librerías en `src/i18n/`: `t('texto en inglés', {vars})` (el inglés es la clave), `tn(n, singular, plural)`, `tk()` para listas fijas, `tRich()` para oraciones con <strong>, `tIn(lang, …)`; diccionario `es.ts` (formal, "usted"). La prueba `i18n.test.ts` falla si un texto de t()/tk()/tn() no tiene traducción. El idioma vive en el estado (`state.lang`, primera visita = idioma del navegador) y con cuenta se guarda en `users/{uid}.profile.lang`; sin cuenta solo en memoria. Se cambia en la bienvenida (English/Español) y en Configuración → Su perfil → Idioma. Los análisis se recalculan al cambiar de idioma. La bienvenida dibuja las dos versiones del texto encimadas y alterna cada 6 s con fundido y palabras escalonadas (botón de pausa; con "reducir movimiento" solo fundido). Términos en español: `public/terms-es.html` (mantenerlo igual que terms.html). El selector de Google Drive usa `setLocale` con el idioma. Los ejemplos de títulos de figuras ("Table 1") siguen en inglés porque es el idioma del documento del alumno.
- Avisar a la Product Owner: la bienvenida no es un login real y las animaciones son discretas.

## Estructura

```
src/analysis/   lógica de análisis (una función por tipo) + pruebas *.test.ts
src/extract/    lectura de .docx (jszip, con tablas/imágenes/gráficas), .pdf (pdfjs-dist + OCR), imágenes (OCR), .txt
src/report/     reporte PDF con jspdf (buildReport / exportReport)
src/components/ pantallas: Welcome, Dashboard, Upload, Review, Plagiarism, AiIndicators,
                SettingsScreen; piezas: charts, icons, Insights, CountUp, common (Modal…)
src/state/store.tsx  estado en memoria (useReducer); analyzeAll se recalcula con useMemo
src/settings.ts      criterios por defecto y validación del .json importado
src/samples.ts       5 entregas de ejemplo (dos cartas comparten párrafos; el memo tiene frases de IA)
```

## Comandos

- `npm run dev` (http://localhost:5173), `npm test` (Vitest, 58 pruebas), `npm run build`.
- En PowerShell de Claude, Node y Git se instalaron con winget en esta máquina; si un comando
  no los encuentra, refrescar el PATH:
  `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`
- `git push` desde Claude necesita `$env:GCM_INTERACTIVE = "always"` (la sesión lo trae en
  "never"); la credencial de GitHub ya quedó guardada en el administrador de credenciales.

## Forma de trabajar que funcionó

- Antes de entregar: `npm test`, `npm run build` y revisar en el navegador las 6 pantallas a
  1024 px y 1440 px buscando elementos que se salgan del ancho (hubo desbordes en Dashboard).
- Los modales se renderizan con portal a `<body>` (la barra lateral es sticky y los tapaba).
- Si el panel del navegador está oculto, las animaciones se pausan: no confiar en capturas para
  juzgar animaciones; verificar con JavaScript y pedir al usuario que lo vea.
- Después de cambios, commit + push a `main` para que Vercel publique; mensajes de commit en español.

## Pendientes conocidos

- (Hecho 2026-11-19) Login con Google y guardado en Firestore verificados en el sitio publicado: users/{uid} con perfil, configuración y submissions. Nota: el panel del navegador de Claude bloquea las ventanas emergentes que abre Claude y, si es angosto (< 1024 px), la app muestra el aviso de solo computadora.
- Probar con trabajos reales de alumnos hechos en Word/PDF (solo se probó con archivos generados).
- Probar a mano el botón "Export report" (descarga un PDF) y ver las animaciones en pantalla.
