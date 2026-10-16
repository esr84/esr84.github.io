# TestWebVR

Prototipo WebXR para entrenar soft skills: hablas con un avatar (un cliente enfadado) dentro
de unas Meta Quest, y todo se ejecuta en el propio visor. El contexto completo está en
[CLAUDE.md](CLAUDE.md) y el plan en [docs/PLAN.md](docs/PLAN.md).

## Arrancar

Requisitos: Node 22 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. El resto de comandos están en [CLAUDE.md](CLAUDE.md#comandos).

## Abrirlo desde las Quest durante el desarrollo

- **Por cable USB (recomendado):** activa el modo desarrollador en las Quest, conéctalas y ejecuta
  `adb reverse tcp:5173 tcp:5173`. Luego abre `http://localhost:5173` en Meta Quest Browser
  (`localhost` es un contexto seguro, así que WebXR y el micrófono funcionan sin HTTPS).
- **Por Wi-Fi:** ejecuta `npm run dev:lan` (HTTPS con certificado autofirmado), abre
  `https://<IP-del-PC>:5173` y acepta el aviso del certificado.

## Publicación en GitHub Pages

Cada push a `main` despliega la app con [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
descarga los modelos, pasa `npm run check` y publica `dist/` en la subruta del repositorio.

Configuración (una sola vez):

1. Crea el repositorio en GitHub. Tiene que ser **público** para usar Pages gratis.
2. Ve a **Settings → Pages → Build and deployment → Source** y elige **GitHub Actions**.
3. Sube la rama `main`. La app quedará en `https://<usuario>.github.io/<repo>/`.

GitHub Pages no permite cabeceras HTTP propias, así que `crossOriginIsolated` (necesario para
el WebAssembly multihilo) lo activa nuestro service worker ([public/sw.js](public/sw.js)). La
primera visita recarga la página una vez.

## Uso sin conexión e instalación en las Quest

El service worker guarda la app y los modelos (~230 MB) en la caché del navegador durante la
primera carga completa. A partir de ahí la app funciona **sin conexión** (modo avión incluido).

- Cada despliegue nuevo sustituye la caché de la app, pero **no vuelve a descargar los modelos**
  salvo que cambien (tienen su propia caché, ligada a `public/models/MANIFEST.json`).
- La app incluye un manifest (nombre, icono, pantalla completa), así que si Meta Quest Browser
  ofrece instalarla desde su menú, se abrirá como una app con su icono. Si no, basta con guardar
  la URL en favoritos: el uso sin conexión funciona igual.

Para reproducir Pages en local (subruta `/TestWebVR/` y sin cabeceras):

```bash
npm run build:pages
```

```bash
npm run preview:pages
```

Abre `http://localhost:4173/TestWebVR/`.
