# Assistant Helper

Aplicación web para ayudar a la docente a revisar los trabajos de redacción en inglés de sus
alumnos: **autenticidad** (similitud entre entregas e indicadores de IA), **formato** y
**calidad de la redacción**.

Proyecto escolar del Equipo 7 — Secretariado, submódulo *"Se comunica usando técnicas de
expresión oral en español e inglés"*. Metodología Scrum.

- **Product Owner:** Mtra. Olvera Castelan Nalleli
- **Scrum Master:** Diego Infante Solis
- **Entrega v1.0:** 2 de diciembre de 2026

## Características principales

| Funcionalidad | Qué hace |
|---|---|
| Bienvenida del profesor | Al abrir la app, el profesor escribe su nombre, materia y grupo (sin contraseña ni servidor). Aparece en la barra lateral, el saludo y el reporte PDF. "Change teacher" termina la sesión y deja todo limpio para el siguiente profesor. |
| Dashboard visual | Tarjetas con contadores animados, "Highlights" con hallazgos automáticos (par más parecido, IA elevada, problema de formato más común, pendientes), dona de progreso, barras de similitud con la línea del umbral y aviso de "Session complete" al terminar. |
| Revisión ágil | Botones anterior/siguiente ("Submission 2 of 5"); al señalar un documento coincidente se resaltan sus pasajes en el visor y con un clic se salta a ellos. |
| Cuenta de Google y nube | Inicio de sesión con Google y guardado automático en Firebase (plan Spark gratuito: sin tarjeta, no cobra; si se rebasa el límite diario, el guardado se detiene hasta el día siguiente). Se guardan el texto, los resultados, las notas, las decisiones, los grupos, el perfil y la configuración de cada profesor; los archivos originales no se suben. Sin Firebase configurado, la app funciona como antes (sin cuenta). |
| Grupos y búsqueda | Grupo por archivo (con "Apply to all"), pestañas y secciones por grupo en Submissions, búsqueda sin acentos con atajo "/", y orden por alumno, similitud, IA o pendientes. |
| Carga de documentos | Arrastrar y soltar o seleccionar archivos `.docx`, `.pdf`, `.txt` e imágenes (`.png`, `.jpg`, `.webp`), con barra de progreso, límite de 30 MB y aviso de archivos repetidos. Nombre del alumno, título de la tarea y opción de marcar archivos de referencia. |
| Documentos tal cual | Vista "Original": las páginas reales del PDF, la imagen y el Word con sus tablas, imágenes y gráficas, con los resaltados dibujados encima. Vista "Text" con el texto extraído. |
| OCR en el navegador | Los PDF escaneados y las imágenes se leen con tesseract.js dentro del navegador (la imagen nunca se sube; solo se descargan una vez los datos del idioma inglés). Máximo 15 páginas escaneadas por PDF. |
| Tablas, figuras y gráficas | Detecta tablas, imágenes y gráficas de Word (tipo, título, series y valores), revisa que tengan título numerado ("Table 1", "Figure 1"), que se mencionen en el texto y que las gráficas tengan ejes con nombre. Botón para leer el texto dentro de una imagen. |
| Detección de similitud | Compara cada entrega con las demás y con los archivos de referencia mediante fragmentos de 5 palabras. Nunca consulta internet. |
| Validación de formato | En `.docx`: fuente, tamaño, interlineado, márgenes y alineación. En todos los formatos: conteo de palabras, título, sección de referencias y estilo de citas (APA 7 / MLA 9 / Chicago). |
| Indicadores de IA | Frases típicas, variación de longitud de oraciones, diversidad de vocabulario, inicios repetitivos y cambios de estilo. Son orientativos, no determinantes. |
| Calidad de redacción | Voz pasiva, oraciones de más de 35 palabras y palabras repetidas cerca unas de otras. |
| Revisión | Visor tipo hoja con resaltados, panel de resultados, notas de la docente, "Complete review" y reporte PDF. |
| Configuración | Criterios, umbral de similitud (15/20/30 %), reglas personalizadas y exportar/importar en `.json`. |
| Privacidad | Todo se procesa en el navegador. No hay servidor, base de datos ni llaves de API. Al recargar o cerrar la pestaña se borra todo. |

### Estados de similitud

Se usa el porcentaje redondeado, el mismo que se muestra en pantalla:

- Por debajo del umbral → **Clear**
- Del umbral hasta 29 % → **Review**
- 30 % o más → **High match**

Si el umbral es 30 %, no existe el rango *Review*: solo hay **Clear** (menos de 30 %) y
**High match** (30 % o más).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior (incluye `npm`)
- Un navegador de escritorio actualizado (Chrome, Edge o Firefox). En pantallas de menos de
  1024 px la app muestra un aviso de que solo está disponible en computadora.

## Correr el proyecto localmente

```bash
npm install
```

```bash
npm run dev
```

Después abrir <http://localhost:5173>. En la bienvenida se puede escribir cualquier nombre o usar
**"Continue with the demo profile"**. En el Dashboard vacío, el botón
**"Load sample submissions"** carga 5 entregas de ejemplo para probar la app:

- Las cartas de **Valeria Gómez** y **Luis Hernández** comparten párrafos (demostración de
  plagio).
- El memo de **Andrés Morales** contiene frases típicas de texto generado por IA.

### Otros comandos

| Comando | Para qué sirve |
|---|---|
| `npm test` | Ejecuta las pruebas de `src/analysis`, `src/extract` y `src/report` (Vitest). |
| `npm run build` | Revisa los tipos (TypeScript) y genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve localmente la versión generada en `dist/`. |

## Conectar la nube (Firebase, gratis)

1. En <https://console.firebase.google.com> crear un proyecto (plan **Spark**, gratuito, no pide tarjeta).
2. **Authentication → Sign-in method → Google → Enable**.
3. **Authentication → Settings → Authorized domains**: agregar el dominio de Vercel (por ejemplo `assistant-helper.vercel.app`).
4. **Firestore Database → Create database** (modo producción) y en **Rules** pegar el contenido de `firestore.rules`.
5. **Project settings → Your apps → Web (</>)**: registrar la app y copiar la configuración.
6. Poner los valores en un archivo `.env.local` (y en **Vercel → Settings → Environment Variables**):

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   ```

   Estos valores no son secretos (Firebase los diseña para el navegador); la seguridad la dan las reglas de Firestore.

## Desplegar en Vercel (plan Hobby, gratuito)

1. **Subir el código a GitHub.** Crear un repositorio vacío en GitHub y, dentro de la carpeta
   del proyecto, ejecutar:

   ```bash
   git init
   ```

   ```bash
   git add .
   ```

   ```bash
   git commit -m "Assistant Helper v1.0"
   ```

   ```bash
   git branch -M main
   ```

   ```bash
   git remote add origin https://github.com/USUARIO/assistant-helper.git
   ```

   ```bash
   git push -u origin main
   ```

2. **Importar el repositorio en Vercel.** Entrar a <https://vercel.com>, iniciar sesión con
   GitHub, elegir **Add New → Project** y seleccionar el repositorio.
3. **Configuración.** Vercel detecta Vite automáticamente:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - No se necesitan variables de entorno.
4. Presionar **Deploy**. Cada `git push` a `main` vuelve a publicar la app automáticamente.

## Estructura del código

```
src/
├── analysis/          Lógica de análisis (una función por tipo) y sus pruebas
│   ├── similarity.ts    Shingles de 5 palabras, porcentajes y estado según el umbral
│   ├── format.ts        Revisión de formato (docx y generales)
│   ├── citations.ts     Detección de estilo de citas APA / MLA / Chicago
│   ├── writing.ts       Voz pasiva, oraciones largas, palabras repetidas
│   ├── ai.ts            Indicadores heurísticos de IA
│   ├── customRules.ts   Reglas personalizadas de la docente
│   ├── text.ts          Tokenización, oraciones y párrafos
│   └── index.ts         Ejecuta todos los análisis de la sesión
├── extract/           Lectura de archivos (.docx con jszip, .pdf con pdfjs-dist, .txt)
├── report/            Reporte PDF con jspdf
├── components/        Pantallas y componentes de interfaz
├── state/store.tsx    Estado de la sesión (solo en memoria)
├── settings.ts        Criterios por defecto, validación del .json importado
└── samples.ts         Entregas de ejemplo
```

## Limitaciones conocidas

- La similitud solo se calcula contra los archivos cargados en la misma sesión (por diseño).
- El OCR puede equivocarse con letra a mano, fotos borrosas o tipografías raras; la app muestra la confianza del reconocimiento.
- En PDF, las tablas y las gráficas vectoriales se detectan por su título ("Table 1", "Figure 1"); sus datos solo se leen en las gráficas nativas de Word.
- La app no interpreta el significado de una gráfica (eso requeriría IA en un servidor); revisa su estructura y sus títulos.
- Las revisiones de fuente, tamaño, interlineado, márgenes y alineación solo están disponibles
  para `.docx`. Para `.pdf` y `.txt` se muestran como *"Not available for this file type"*.
- Los indicadores de IA son heurísticos y orientativos; en textos cortos son menos confiables.
- La configuración no se guarda automáticamente: se debe exportar e importar como `.json`.
- La bienvenida identifica al profesor, pero no es un inicio de sesión con contraseña: no hay cuentas
  ni servidor (fuera del alcance del proyecto). El perfil se borra al cerrar la pestaña.
- Las animaciones son discretas y se desactivan si el sistema tiene activado "reducir movimiento".
