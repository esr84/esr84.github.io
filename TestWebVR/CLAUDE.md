# TestWebVR — Prototipo VR de entrenamiento de soft skills

Prototipo WebXR para validar ideas: el usuario, dentro de unas Meta Quest, habla con un
avatar virtual (un cliente enfadado en una tienda; el usuario hace de dependiente) y el
avatar le responde con voz. El objetivo es **validar la idea**, no hacer un producto.

El equipo participa solo en la **ideación**; todo el desarrollo lo hace Claude en modo loop
(ver `.claude/loop-prompt.md`). Las pruebas en el visor las hace una persona del equipo
siguiendo `docs/DEVICE_CHECKS.md`.

## Restricciones innegociables

1. **Todo corre en las Quest**, en el navegador (Meta Quest Browser). Sin PC, sin servidor
   de inferencia. Objetivo Quest 3; Quest 2 debe funcionar aunque vaya más justo.
2. **Sin servicios externos en tiempo de ejecución.** Nada de APIs en la nube, ni Web Speech
   API de reconocimiento (envía audio fuera), ni descargar modelos de Hugging Face en
   runtime. Los modelos se sirven desde la propia app (`public/models/`).
   Descargar paquetes npm y modelos **durante el desarrollo** sí está permitido.
3. **Push-to-talk:** solo se escucha mientras se mantiene pulsado el gatillo del mando.
4. **Sin lip-sync y sin LLM.** La conversación es un guion con detección por palabras clave.
5. **Idioma:** español de España (STT, TTS y textos de la UI).
6. **Se publica en GitHub Pages** como web estática, en una subruta (`https://<usuario>.github.io/<repo>/`).
   Por eso:
   - **Nunca rutas absolutas** (`'/models/...'`). Todo se resuelve con `import.meta.env.BASE_URL`
     o `new URL(..., import.meta.url)`. Vite usa `base` desde la variable de entorno `BASE_PATH`
     (por defecto `/`).
   - GitHub Pages no permite cabeceras propias: `crossOriginIsolated` lo consigue nuestro
     service worker (`public/sw.js`), que además cachea la app y los modelos para usarla sin
     conexión. Solo se registra en producción (`src/pwa/register.ts`).
   - Los modelos **no se versionan**: el workflow de GitHub Actions ejecuta `fetch-models`
     y publica `dist/` con los modelos dentro.

## Stack

- Vite + TypeScript (strict) + Three.js (WebXR nativo de Three, sin A-Frame ni React).
- STT: Whisper (`tiny` / `base`, ONNX cuantizado) vía `@huggingface/transformers` en un Web Worker.
- TTS: Piper (voz `es_ES`) en WASM, en un Web Worker.
- Texto 3D: `troika-three-text`.
- Emulación WebXR en escritorio: `iwer` (Immersive Web Emulation Runtime).
- Tests: Vitest. Lint: ESLint + Prettier.

Fija versiones exactas en `package.json` (sin `^` ni `~`).

## Comandos

```bash
npm run dev          # servidor de desarrollo en http://localhost:5173 (cabeceras COOP/COEP)
npm run dev:lan      # igual, pero con HTTPS y visible en la red local (para abrirlo por IP desde las Quest)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run build        # build de producción en dist/
npm run fetch-models # descarga los modelos a public/models (no se versionan)
npm run check        # typecheck + lint + test + build (gate obligatorio)
```

**Ojo en Windows con Git Bash:** `BASE_PATH=/TestWebVR/` se convierte en una ruta de Windows.
Usa `MSYS_NO_PATHCONV=1 BASE_PATH=/TestWebVR/ npm run build`, y lo mismo para `vite preview`
(la vista previa también lee `base`; si no se le pasa, sirve la app en `/` y da 404 en la subruta).

**Panel del navegador oculto:** si el panel está oculto, el navegador limita `requestAnimationFrame`
(unos 12 FPS, o se para del todo). Para comprobar algo que depende de los frames (eventos de los
mandos, FPS), haz una captura antes de leer el estado: la captura fuerza el render.

**Escapes Unicode en el código:** la herramienta Write convierte los escapes de un regex
(barra invertida + `u` + 4 dígitos hex) en caracteres literales, y ESLint los rechaza por
`no-irregular-whitespace`. Para ficheros con esos escapes, escribe con un heredoc de bash con
delimitador entre comillas (`<<'EOF'`). Tampoco los pongas dentro de un `node -e "..."`.

**Texto 3D:** todo texto que se muestre con troika pasa por `setText`/`createText` de
`src/ui/font.ts`, que lo sanea: un glifo que falte en Roboto latin haría que troika lo
descargara de un CDN.

**Pose del visor en el emulador:** la interfaz de IWER reimpone la posición del visor en cada frame,
así que `__xrDevice.position.set()` no tiene efecto. Para probar algo que depende de dónde está el
usuario (mirada del avatar), hazlo fuera de VR moviendo `__app.ctx.camera`.

**Commit solo con el gate en verde:** encadena siempre `npm run check && git commit ...`. Un `;` o
un `echo` intermedio se traga el código de salida y deja commitear con el check en rojo (pasó en T15).

## Estructura (objetivo)

```
src/
  main.ts                 # arranque: pantalla 2D de inicio → sesión XR
  app/                    # orquestación (máquina de estados de la conversación)
  xr/                     # renderer, sesión, mandos, push-to-talk, emulador
  audio/                  # captura de micro, AudioWorklet, remuestreo, reproducción
  stt/                    # interfaz STTProvider + worker Whisper
  tts/                    # interfaz TTSProvider + worker Piper
  avatar/                 # carga GLB, AvatarController (estados, gestos, mirada)
  scenario/               # motor de guion (TS puro, sin dependencias de DOM)
  ui/                     # paneles 3D: subtítulos, HUD de depuración, pantalla final
  debug/                  # métricas, log de sesión, modos ?debug / ?text
scenarios/                # guiones en JSON
public/models/            # modelos (gitignored, los trae fetch-models)
public/assets/            # GLB del avatar y escena
tests/                    # tests de Vitest (+ fixtures de audio)
docs/                     # plan, backlog, progreso, decisiones, checks en dispositivo
```

## Convenciones

- Identificadores y comentarios en **inglés**; textos visibles y documentación en **español**.
- Cada subsistema expone una **interfaz** (`STTProvider`, `TTSProvider`, `AvatarController`,
  `ScenarioEngine`) para poder sustituir la implementación sin tocar el resto.
- La lógica pura (motor de guion, remuestreo, máquina de estados PTT) **no depende del DOM
  ni de Three** y tiene tests unitarios.
- Lo pesado (STT, TTS) va siempre en **Web Workers**: el hilo principal es para el render.
- Todo debe ser **verificable sin visor**: emulador IWER, teclado (Espacio = gatillo),
  `?text=1` para escribir en lugar de hablar, `?debug=1` para HUD y métricas.
- No añadas dependencias sin anotarlo en `docs/DECISIONS.md`.

## Parámetros de URL

| Parámetro | Efecto |
|---|---|
| `?debug=1` | HUD con estado, latencias STT/TTS, FPS; log de sesión descargable |
| `?text=1` | Entrada por teclado en lugar de micrófono (para pruebas en escritorio) |
| `?emulate=1` | Fuerza el emulador IWER aunque haya WebXR nativo |
| `?stt=tiny\|base` | Modelo Whisper a usar (por defecto: `base`) |
| `?scenario=<id>` | Guion a cargar (por defecto: `devolucion-sin-ticket`) |

## Trabajo en loop

Lee `.claude/loop-prompt.md`. Una iteración = una tarea de `docs/BACKLOG.md`.
El estado del proyecto vive en los ficheros de `docs/`, no en la memoria de la conversación.
