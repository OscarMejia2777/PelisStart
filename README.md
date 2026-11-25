# PelisStart — Edición Navideña 🎄

Aplicación web de catálogo y reproducción multi-API (**PlayLatinSRC**, **Embed69**, **TMDB**, **Cinemeta**, **TVmaze** y **OMDb**) con tema navideño, nieve con estrellas de colores y **Calendario de Adviento** bloqueado por fecha (1 al 24 de diciembre).

## Ejecución local

1. Copia `.env.example` a `.env` y agrega tus claves opcionales (`TMDB_API_KEY` / `TMDB_BEARER_TOKEN` y `OMDB_API_KEY`).
2. Inicia el servidor:
   ```bash
   npm start
   ```
3. Abre `http://localhost:8124`.

## Despliegue en Vercel

El proyecto ya incluye `vercel.json` y `api/index.js` para servir los archivos estáticos desde el CDN de Vercel y enrutar `/api/*` a la función serverless de Node.js.

1. Sube este repositorio a **GitHub** (el archivo `.env` está protegido en `.gitignore`).
2. En **Vercel**, importa el repositorio de GitHub:
   - **Framework Preset**: `Other`
   - **Output Directory**: `.` (por defecto)
3. Configura las **Environment Variables** en Vercel (*Settings → Environment Variables*):
   - `TMDB_API_KEY` (opcional, recomendada para títulos y sinopsis en español latino)
   - `TMDB_BEARER_TOKEN` (opcional)
   - `OMDB_API_KEY` (opcional, puntuaciones IMDb / Rotten Tomatoes)
   - `RAPIDAPI_KEY` (opcional)
4. Haz clic en **Deploy**.
