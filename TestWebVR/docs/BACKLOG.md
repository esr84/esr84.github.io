# Backlog

Una iteración del loop = **una tarea**. Se coge la primera tarea `[ ]` cuyas dependencias
estén `[x]`. Las tareas de **Tipo: humano** (checks en el visor) no las hace el loop: las
salta y no bloquean, salvo que se indique lo contrario.

**Estados:** `[ ]` pendiente · `[~]` en curso · `[x]` hecha · `[!]` bloqueada (motivo en PROGRESS.md)

**Gate común (todas las tareas de código):** `npm run check` pasa (typecheck + lint + test + build)
y, si la tarea toca la UI, la página carga en el navegador de escritorio con el emulador sin
errores en la consola.

---

## M0 · Fundaciones

### T01 · Scaffold del proyecto
- Estado: [x]
- Depende de: —
- Qué:
  - `git init`, `.gitignore` (node_modules, dist, public/models, *.log).
  - Vite + TypeScript strict + Three.js + Vitest + ESLint + Prettier, con versiones exactas.
  - Scripts `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `check`.
  - Dev server con HTTPS (`@vitejs/plugin-basic-ssl`), `host: true` y cabeceras
    `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`
    (también en `preview`).
  - `.claude/launch.json` con la configuración `dev` (puerto 5173) para el panel del navegador.
  - `README.md` corto: cómo arrancar y cómo abrirlo desde las Quest (`adb reverse tcp:5173 tcp:5173`
    o la IP de la LAN con el certificado aceptado).
  - `vite.config.ts` con `base: process.env.BASE_PATH ?? '/'`. Un helper `asset(path)` en
    `src/util/paths.ts` que antepone `import.meta.env.BASE_URL` (todas las rutas a modelos y
    assets pasarán por ahí).
  - Página mínima que pinte "TestWebVR" y muestre `crossOriginIsolated` en la consola.
- Aceptación: `npm run check` pasa; la página carga; `crossOriginIsolated === true` en dev;
  `BASE_PATH=/TestWebVR/ npm run build && npm run preview` sirve la app bajo esa subruta sin 404.

### T01b · Despliegue en GitHub Pages
- Estado: [x]
- Depende de: T01
- Qué:
  - `.github/workflows/deploy.yml`: en cada push a `main` → `npm ci` → caché de
    `public/models` (`actions/cache`, con clave = hash de `scripts/fetch-models.mjs`) →
    `npm run fetch-models` (si el script aún no existe, se salta) → `npm run check` →
    `BASE_PATH=/<repo>/ npm run build` (el nombre del repo sale de `github.event.repository.name`)
    → `actions/upload-pages-artifact` + `actions/deploy-pages`. Acciones con versiones fijadas.
  - `coi-serviceworker` copiado a `public/` y registrado en `index.html`, para tener
    `crossOriginIsolated` en Pages (la primera visita recarga la página una vez; está bien).
  - `public/.nojekyll`.
  - En el README: cómo activar Pages (Settings → Pages → Source: GitHub Actions) y la URL final.
  - Si en `DECISIONS.md` → "Respuestas del equipo" ya hay una URL de repo y "push autorizado: sí",
    añadir el remoto y hacer push. Si no, añadir la pregunta en "Preguntas abiertas" y seguir.
- Aceptación: el workflow pasa `actionlint` (o, si no está disponible, una revisión manual del
  YAML); en local, `BASE_PATH=/TestWebVR/ npm run build` + `npm run preview` **sin cabeceras
  COOP/COEP** da `crossOriginIsolated === true` tras la recarga del service worker.
  Cuando haya remoto: el despliegue aparece en verde en la pestaña Actions y la URL carga.

### T02 · Escena WebXR mínima + emulador
- Estado: [x]
- Depende de: T01
- Qué:
  - `src/xr/`: renderer con `xr.enabled`, `setAnimationLoop`, suelo, luces, cielo de color
    neutro, `foveation = 1`, sesión `immersive-vr` con `local-floor`.
  - Mandos con `XRControllerModelFactory`, más un rayo en el mando derecho.
  - Botón propio "Entrar en VR" (no el `VRButton` por defecto) que el inicio 2D (T03) pueda reutilizar.
  - Emulador: si no hay `navigator.xr`, si `isSessionSupported('immersive-vr')` es false o si hay
    `?emulate=1`, cargar `iwer` (+ devui si existe) con un dispositivo Quest 3 **solo en dev**
    (import dinámico, fuera del bundle de producción). Ojo: el navegador de escritorio del panel
    ya expone `navigator.xr`, así que comprobar solo su existencia no basta.
  - Contador de FPS interno (media móvil) accesible para el HUD.
- Aceptación: en el navegador de escritorio se entra en la sesión XR emulada y se ven el suelo
  y los mandos; el build de producción no incluye iwer.

### T03 · Pantalla de inicio 2D y precarga
- Estado: [x]
- Depende de: T02
- Qué:
  - Overlay HTML: título, descripción del escenario, botón **"Empezar"**.
  - "Empezar" → `getUserMedia` (echoCancellation, noiseSuppression, autoGainControl) y crear
    o reanudar el `AudioContext` (gesto del usuario) → lanzar la precarga (de momento un
    loader simulado; los reales se enchufan en T08/T09) con una barra de progreso → botón
    **"Entrar en VR"**.
  - Mensajes claros si se deniega el micro o si no hay WebXR. Si falta el micro, se ofrece
    seguir en modo `?text=1`.
  - Registro de capacidades: WebXR, WebGPU (`navigator.gpu`), `crossOriginIsolated`, núcleos
    (`hardwareConcurrency`), memoria (`deviceMemory`). Se guardan para el HUD y el log.
- Aceptación: el flujo funciona en escritorio con el emulador; un micro denegado no rompe la app.

### T04 · Paneles 3D: subtítulos y HUD
- Estado: [x]
- Depende de: T02
- Qué:
  - `troika-three-text`. Panel de subtítulos bajo el avatar con dos líneas ("Tú: …" en gris,
    "Javier: …" en blanco), con ajuste de línea y acentos correctos.
  - Indicador de estado (icono o texto: Escuchando / Transcribiendo / Pensando / Hablando).
  - HUD de depuración (`?debug=1`) anclado al mando izquierdo: estado, FPS, último STT (ms),
    último TTS (ms), backend del STT (webgpu/wasm), modelo.
  - Botón **B/Y** para mostrar u ocultar el HUD (y una tecla en escritorio).
- Aceptación: los textos con "ñ, á, ¿, ¡" se ven bien en el emulador; el HUD se muestra y oculta.

### T05 · Push-to-talk
- Estado: [x]
- Depende de: T02
- Qué:
  - `src/xr/ptt.ts`: máquina de estados pura (`idle → pressed → released`) con debounce y
    duración mínima (300 ms; por debajo se descarta como pulsación accidental).
  - Entradas: `selectstart`/`selectend` del mando derecho (gatillo) y la tecla **Espacio** en escritorio.
  - Vibración háptica corta al empezar y al terminar (`gamepad.hapticActuators` / `vibrationEffect`, si existen).
  - Emite eventos tipados `ptt:start`, `ptt:end`, `ptt:cancel`.
- Aceptación: tests unitarios de la máquina de estados (pulsación corta descartada, doble
  pulsación, soltar sin pulsar); en el emulador, Espacio y el gatillo emiten los eventos.

### D0 · Check en dispositivo: entrar en VR
- Estado: [ ]
- Tipo: humano
- Depende de: T03, T04, T05
- Qué: seguir `docs/DEVICE_CHECKS.md` (sección D0).

---

## M1 · Voz

### T06 · Captura de audio
- Estado: [x]
- Depende de: T03, T05
- Qué:
  - `src/audio/capture.ts` + `AudioWorklet` que acumula muestras solo mientras el PTT está activo.
  - Remuestreo a **16 kHz mono Float32** (función pura `resample(input, fromRate, 16000)`).
  - Límite de 15 s por grabación (se corta y avisa); se descarta si dura menos de 0,3 s.
  - Normalización de pico suave.
  - En `?debug=1`: botón o tecla para reproducir la última grabación.
- Aceptación: tests de `resample` (longitud correcta, un seno de 440 Hz conserva su frecuencia
  con un error < 2 %); en el navegador se graba y se reproduce la última toma.

### T07 · Script de descarga de modelos
- Estado: [x]
- Depende de: T01
- Qué:
  - `scripts/fetch-models.mjs` (Node, sin dependencias extra) que descarga en `public/models/`:
    - Whisper `tiny` y `base` en ONNX, compatibles con Transformers.js (`onnx-community/whisper-*`
      o `Xenova/whisper-*`), solo los ficheros del dtype elegido (q8 o q4) y los de configuración.
    - Voz Piper `es_ES` calidad *medium* (`.onnx` + `.onnx.json`) y lo que necesite el runtime
      de Piper elegido (por ejemplo los datos de espeak-ng/phonemizer).
  - Idempotente: salta los ficheros ya presentes con el tamaño correcto. Muestra el progreso.
  - `public/models/MANIFEST.json` con nombres, tamaños y origen (para el log y la doc).
  - Anotar en `DECISIONS.md` los modelos y la voz exactos elegidos, y su licencia.
- Aceptación: `npm run fetch-models` deja los modelos en su sitio; una segunda ejecución no
  descarga nada; tamaño total < 300 MB.

### T08 · TTS con Piper en un Worker
- Estado: [x]
- Depende de: T07
- Qué:
  - Elegir el runtime de Piper para el navegador (candidatos: `@diffusionstudio/vits-web`,
    `@mintplex-labs/piper-tts-web`, sherpa-onnx WASM). Debe poder cargar la voz **desde
    `public/models`**, sin CDN. Documentar la elección en `DECISIONS.md`.
  - `src/tts/piper.worker.ts` + `PiperTTSProvider` (implementa `TTSProvider`). Devuelve PCM
    y el hilo principal crea el `AudioBuffer`.
  - `src/audio/player.ts`: reproduce el audio, expone un `AnalyserNode` (para mover el avatar
    en T12) y permite `stop()` (para interrumpir).
  - `SpeechSynthesisTTSProvider` como fallback si Piper falla al cargar.
  - Enchufar la carga real a la barra de progreso de T03.
  - Script `npm run gen-fixtures` que use el mismo motor (en Node, si se puede) para generar
    `tests/fixtures/*.wav` con 5 frases del escenario. Si no se puede en Node, generarlas una
    vez desde el navegador y versionarlas (son pequeñas).
- Aceptación: en el navegador, una tecla de debug dice "Hola, soy Javier. ¿Me puede ayudar?";
  la latencia se muestra en el HUD; existen los fixtures WAV.

### T09 · STT con Whisper en un Worker
- Estado: [x]
- Depende de: T07, T08
- Qué:
  - `src/stt/whisper.worker.ts` con `@huggingface/transformers`:
    `env.allowRemoteModels = false`, `env.localModelPath = asset('models/')` (nunca `'/models/'`, que rompe en la subruta de Pages), rutas WASM locales
    (sin CDN), `device: 'webgpu'` si `navigator.gpu` existe y si no `'wasm'`,
    `language: 'spanish'`, `task: 'transcribe'`.
  - `WhisperSTTProvider` (implementa `STTProvider`); modelo según `?stt=` (por defecto `base`).
  - Calentamiento: una inferencia con silencio de 1 s tras cargar, para que el primer turno no sea lento.
  - Test **round-trip** en Vitest (entorno Node): fixtures WAV de T08 → Whisper `tiny` → el texto
    normalizado tiene una similitud ≥ 0,8 con la frase original. Marcarlo como test lento
    (`npm run test:slow`) si tarda más de 30 s, fuera del gate `check`.
- Aceptación: el test round-trip pasa; en el navegador una frase grabada se transcribe y se
  muestran el texto, la latencia y el backend en el HUD.

### T10 · Modo "eco" de extremo a extremo
- Estado: [x]
- Depende de: T04, T06, T08, T09
- Qué:
  - Primera versión de `ConversationController` con la máquina de estados del PLAN (§2),
    sin guion: el avatar (de momento un cubo o una cápsula) responde "Has dicho: <texto>".
  - Subtítulos y estados conectados. PTT durante `SPEAKING` → `player.stop()` y pasa a escuchar.
  - Cola o descarte: si se pulsa el PTT mientras transcribe, se ignora con un aviso háptico.
  - `src/debug/sessionLog.ts`: cada turno guarda { t, userText, sttMs, ttsMs, totalMs, backend };
    en `?debug=1` se puede descargar como JSON.
  - `?text=1`: un input de texto sustituye a la voz (en escritorio) y salta el STT.
- Aceptación: en escritorio con el emulador, `?text=1` completa turnos de eco; con el micro
  real, el ciclo completo funciona; los tests de la máquina de estados pasan.

### D1 · Check en dispositivo: rendimiento de voz (PUNTO DE DECISIÓN)
- Estado: [ ]
- Tipo: humano
- Depende de: T10
- Qué: seguir `docs/DEVICE_CHECKS.md` (sección D1) en Quest 2 y Quest 3 y pegar el log de sesión en
  `docs/device-results/`.
- Nota: no bloquea. Mientras no haya resultados, el loop sigue con la opción por defecto
  (`whisper-base` en todos los visores, ver la decisión de T09 en DECISIONS.md).

### T11 · (Condicional) STT alternativo con Vosk
- Estado: [ ]
- Depende de: D1
- Condición: hacerla **solo** si los resultados de D1 indican STT > 3 s en Quest 2 incluso con
  `tiny`. Si no, marcarla `[x]` con la nota "No necesaria según D1".
- Qué: `VoskSTTProvider` con `vosk-browser` y modelo pequeño en español, seleccionable con `?stt=vosk`.

---

## M2 · Avatar

### T12 · Avatar placeholder y AvatarController
- Estado: [x]
- Depende de: T10
- Qué:
  - Descargar `RobotExpressive.glb` (CC0) de los ejemplos de three.js a `public/assets/`;
    anotar el origen y la licencia en `public/assets/CREDITS.md`.
  - `src/avatar/AvatarController.ts` (interfaz independiente del modelo concreto):
    `setState(idle|listening|thinking|speaking)`, `setEmotion(...)`, `playGesture(...)`,
    `lookAt(target)`.
  - `AnimationMixer` con fundidos entre Idle y los gestos (Yes, No, Wave…).
  - Emoción → morph targets (`Angry`, `Sad`, `Surprised`) con interpolación suave.
  - Al hablar: cabeza y torso se mueven ligeramente según el RMS del `AnalyserNode` (pseudo
    "habla" sin lip-sync).
  - Mirada: la cabeza sigue la posición de la cámara XR con límites de giro (±60° en
    horizontal, ±30° en vertical) y suavizado.
  - Parpadeo o micro-movimientos en idle si el modelo lo permite.
  - El `ConversationController` usa el avatar en lugar del cubo.
- Aceptación: en el emulador, el avatar mira al usuario cuando este se mueve, cambia de
  estado con el PTT y gesticula al responder; FPS estables.

### T13 · Escena de tienda
- Estado: [x]
- Depende de: T12
- Qué: mostrador, estantería y suelo hechos con geometría simple y materiales planos (sin
  texturas pesadas), iluminación barata (hemisférica + direccional, sin sombras dinámicas o
  como mucho una), avatar detrás del mostrador a ~1,2 m del usuario y orientado hacia él.
  Draw calls < 50 (mostrar `renderer.info` en el HUD).
- Aceptación: draw calls < 50 en el HUD; la escena se ve coherente en el emulador.

---

## M3 · Guion

### T14 · Motor de escenarios
- Estado: [x]
- Depende de: T01
- Qué:
  - `src/scenario/`: tipos del JSON (PLAN §4), validador (con errores legibles: nodo
    inexistente, intención sin palabras clave…), `normalize()`, `matchIntent()` con
    Levenshtein, cálculo del enfado (limitado a 0–10), finales por umbral, variantes sin
    repetir, pista tras N fallbacks.
  - Sin dependencias de DOM ni de Three. Determinista (RNG inyectable para las variantes).
- Aceptación: tests unitarios con cobertura ≥ 90 % del módulo (normalización, errores de STT
  simulados como "tiket" por "ticket", prioridades, umbrales, validador).

### T15 · Escenario "Devolución sin ticket"
- Estado: [x]
- Depende de: T14
- Qué:
  - `scenarios/devolucion-sin-ticket.json`: Javier, enfado inicial 7, 8–12 nodos, intenciones
    globales (disculpa, empatía, insulto, "cálmese" — que **sube** el enfado —, ofrecer
    alternativa), dos finales (calmado o se va enfadado) y 2–3 variantes por línea.
  - El contenido debe recompensar las buenas prácticas de desescalada: escucha activa,
    validar la emoción, no culpar, ofrecer opciones concretas.
  - Tests que simulan tres conversaciones completas por texto: final bueno, final malo y una
    con errores de STT, y comprueban que llegan al final esperado.
  - Anotar en `DECISIONS.md` la lógica pedagógica del guion para que el equipo la revise.
- Aceptación: el validador acepta el JSON; las tres conversaciones simuladas pasan.

### T16 · Integración conversación completa
- Estado: [x]
- Depende de: T12, T13, T15
- Qué: el `ConversationController` usa el `ScenarioEngine`: línea inicial al entrar en VR,
  turnos completos, la emoción y el gesto de cada `AvatarTurn` llegan al avatar, y el enfado
  se muestra en el HUD (barra 0–10). Selección del escenario con `?scenario=`.
- Aceptación: con `?text=1` en el emulador se juega el escenario hasta los dos finales; el
  log de sesión registra los nodos, las intenciones y el enfado de cada turno.

### T17 · Pantalla final y resumen
- Estado: [x]
- Depende de: T16
- Qué: al terminar, un panel 3D con el resultado (calmado o no), número de turnos, curva de
  enfado (sparkline sencillo), intenciones positivas y negativas detectadas, y 2–3 consejos
  fijos según el resultado. Botones (rayo + gatillo) "Repetir" y "Descargar log" (solo en debug).
- Aceptación: el panel aparece en los dos finales en el emulador; "Repetir" reinicia sin recargar.

### D2 · Check en dispositivo: conversación completa
- Estado: [ ]
- Tipo: humano
- Depende de: T17
- Qué: seguir `docs/DEVICE_CHECKS.md` (sección D2).

---

## M4 · Pulido

### T18 · Rendimiento
- Estado: [x]
- Depende de: T16
- Qué: `framebufferScaleFactor` y foveación según el dispositivo, revisar el GC en el loop de
  render (sin `new` por frame), comprobar que los workers no compiten con el render (prioridades,
  carga diferida del STT si hace falta), lazy-load del avatar. Documentar las medidas de antes
  y después en PROGRESS.md (desde el emulador; las cifras reales salen de D2/D3).
- Aceptación: no hay asignaciones por frame en el loop (revisión de código y profiler); FPS
  estables en el emulador.

### T19 · Robustez y errores
- Estado: [x]
- Depende de: T16
- Qué: timeouts (STT > 10 s → "No te he oído bien, ¿puedes repetir?"), fallo de carga de
  modelos (mensaje y reintento), pérdida del micro, sesión XR terminada inesperadamente (volver
  al inicio 2D), transcripción vacía o solo ruido (Whisper alucina con el silencio: filtrar
  textos típicos como "Subtítulos realizados por…", "Gracias." solos o repeticiones).
- Aceptación: tests del filtro de alucinaciones; cada error simulado muestra un mensaje y la
  app sigue usable.

### T20 · Offline y PWA
- Estado: [x]
- Depende de: T18, T19
- Qué: service worker que cachea la app y los modelos (Cache API) para uso offline tras la
  primera carga, **integrado con `coi-serviceworker`** (solo puede haber un service worker
  por scope: fusionarlos en uno o usar un SW propio que añada las cabeceras COOP/COEP);
  ámbito y rutas relativos a `BASE_URL`; `manifest.webmanifest` con `start_url` relativa;
  versionado de la caché para que un nuevo despliegue sustituya a la versión anterior.
  Actualizar en el README cómo instalarla desde las Quest.
- Aceptación: `BASE_PATH=/TestWebVR/ npm run build` + `npm run preview`, recargar sin red y
  sigue funcionando; `crossOriginIsolated` sigue siendo true; un nuevo build invalida la caché antigua.

### D3 · Check en dispositivo: sesión de validación
- Estado: [ ]
- Tipo: humano
- Depende de: T20
- Qué: seguir `docs/DEVICE_CHECKS.md` (sección D3).

---

## Ideas aparcadas (no hacer sin que el equipo lo pida)

- Avatar humano (Character Creator, Mixamo, Quaternius CC0…) en lugar del robot.
- Segundo escenario (el usuario es el cliente que reclama).
- Lip-sync por amplitud o visemas.
- Clasificación de intención con embeddings (`multilingual-e5-small`).
- LLM local o remoto detrás de la interfaz `ScenarioEngine`.
- Evaluación del tono de voz (volumen, velocidad del habla).
