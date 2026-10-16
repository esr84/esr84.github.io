# Progreso

Registro de iteraciones del loop. Cada entrada se añade **al final**, con el formato
definido en `.claude/loop-prompt.md` (paso 5).

## 2026-10-16 · Preparación · Plan y backlog
- Resultado: hecha
- Cambios: CLAUDE.md, docs/PLAN.md, docs/BACKLOG.md, docs/DECISIONS.md, docs/DEVICE_CHECKS.md,
  .claude/loop-prompt.md
- Verificación: revisión manual de coherencia entre los documentos y las dependencias del backlog
- Notas: todavía no hay código. La siguiente tarea es T01.

## 2026-10-16 · Preparación · Publicación en GitHub Pages
- Resultado: hecha
- Cambios: CLAUDE.md (restricción 6: subruta, BASE_URL, coi-serviceworker, modelos en el CI),
  PLAN §3 (fila "Publicación"), BACKLOG (T01 con `BASE_PATH`, nueva T01b de despliegue, T09
  sin rutas absolutas, T20 limitada a offline/PWA), DEVICE_CHECKS (Pages como opción A),
  DECISIONS (pregunta del repo y el push), loop-prompt (reglas de push y revisión del despliegue)
- Verificación: revisión manual de las referencias cruzadas
- Notas: hasta que el equipo cree el repo y autorice el push, todo se queda en commits locales.

## 2026-10-16 · T01 · Scaffold del proyecto
- Resultado: hecha
- Cambios: package.json (versiones exactas), tsconfig.json, vite.config.ts, eslint.config.js,
  Prettier, index.html, src/main.ts, src/util/paths.ts (`asset()`), tests/paths.test.ts,
  .claude/launch.json (`dev` y `preview`), README.md, .gitignore; repo git en la rama `main`
- Verificación: `npm run check` pasa (typecheck, lint + prettier, 4 tests, build); en dev
  `crossOriginIsolated === true` y la consola sin errores; `BASE_PATH=/TestWebVR/` build +
  preview sirve la app en la subruta sin 404 y con `crossOriginIsolated === true`
- Notas:
  - Cambio respecto al plan: `npm run dev` va por **HTTP** en localhost (es un contexto seguro y
    así el panel del navegador no choca con el certificado autofirmado). HTTPS solo con
    `npm run dev:lan` (abrir por IP desde las Quest). Ya reflejado en CLAUDE.md, README y DEVICE_CHECKS.
  - En Git Bash hace falta `MSYS_NO_PATHCONV=1` con `BASE_PATH`, y `vite preview` también
    necesita `BASE_PATH` (anotado en CLAUDE.md).
  - El navegador del panel expone `navigator.xr` de forma nativa: en T02 el emulador debe
    decidirse con `isSessionSupported` o `?emulate=1` (anotado en la tarea).
  - TypeScript fijado en 6.0.3 y no en 7.x: typescript-eslint 8.71 solo admite `<6.1`.

## 2026-10-16 · T01b · Despliegue en GitHub Pages
- Resultado: hecha (la parte remota queda pendiente de que exista el repo)
- Cambios: .github/workflows/deploy.yml, public/coi-serviceworker.min.js (registrado en
  index.html con ruta relativa), public/.nojekyll, modo `pages` en vite.config.ts y scripts
  `build:pages` / `preview:pages`, configuración `preview-pages` en launch.json, README
- Verificación: `npm run check` pasa; YAML del workflow parseado con js-yaml y revisado a mano
  (actionlint no está instalado); `preview:pages` sin cabeceras COOP/COEP → el service worker
  toma el control en `/TestWebVR/` y `crossOriginIsolated === true`, sin 404; en dev sigue
  isolated por cabeceras y no se registra ningún service worker
- Notas:
  - Sin remoto ni push autorizado: el despliegue real no se ha ejecutado. Cuando el equipo
    responda en DECISIONS.md, la primera iteración debe hacer push y comprobar el run en Actions.
  - En T20 el service worker offline debe fusionarse con coi-serviceworker (un solo SW por scope).
  - Modo continuo activado por el equipo: el loop no se para en los hitos.

## 2026-10-16 · T02 · Escena WebXR mínima + emulador
- Resultado: hecha
- Cambios: src/xr/context.ts (renderer XR con local-floor y foveación 1, escena con suelo,
  rejilla y luces, bucle de frames con suscriptores), src/xr/fps.ts (FpsMeter EMA),
  src/xr/controllers.ts (mandos con modelo procedural y rayo en el derecho, por handedness),
  src/xr/enterVR.ts (botón "Entrar en VR" reutilizable), src/xr/emulator.ts (IWER solo en
  dev), src/util/params.ts, tests de fps y params; vite.config.ts con optimizeDeps y dedupe
- Verificación: `npm run check` pasa (10 tests); el build de producción no contiene iwer; en
  el navegador con el emulador, el botón abre la sesión (`isPresenting`), se conectan
  left/right, solo el derecho muestra rayo, se ven el suelo y los mandos (captura) y la
  consola no muestra errores tras recargar
- Notas:
  - No se usa XRControllerModelFactory porque descarga los modelos de un CDN (ver DECISIONS).
  - Con el panel oculto, rAF va a unos 12 FPS: es normal y está anotado en CLAUDE.md.
  - Las cifras reales de FPS saldrán del check D0 en el visor.

## 2026-10-16 · T03 · Pantalla de inicio 2D y precarga
- Resultado: hecha
- Cambios: src/ui/startScreen.ts (overlay con Empezar → micro → precarga → Entrar en VR, que se
  oculta durante la sesión), src/ui/styles.css, src/app/preloader.ts (tareas con progreso
  ponderado + `delayTask` provisional), src/app/capabilities.ts (WebXR, immersive-vr, adaptador
  WebGPU, crossOriginIsolated, núcleos, memoria), src/audio/microphone.ts (getUserMedia con
  AEC/NS/AGC y errores clasificados), src/audio/audioContext.ts (contexto compartido que se
  reanuda en el gesto); tests de preloader y del clasificador de errores
- Verificación: `npm run check` pasa (20 tests). En el navegador: con el micro bloqueado sale
  el mensaje de permiso denegado con "Reintentar" y "Continuar en modo texto"; el modo texto
  carga y muestra "Entrar en VR"; `?text=1` no pide micro; al entrar en VR el overlay se oculta
  y `isPresenting === true`
- Notas:
  - Un test encontró un fallo real en el progreso: contaba dos veces cada tarea terminada y la
    barra retrocedía. Corregido.
  - El panel del navegador bloquea el micrófono, así que la captura real solo se podrá
    comprobar en el visor (añadido a D0) o en un Chrome normal.

## 2026-10-16 · T05 · Push-to-talk
- Resultado: hecha
- Cambios: src/xr/pttMachine.ts (máquina pura: mínimo 300 ms, debounce 120 ms, interrupción),
  src/xr/ptt.ts (gatillo derecho por selectstart/selectend, Espacio en escritorio, cancelación
  al perder el foco o al terminar la sesión XR, pulso háptico al empezar y al terminar),
  ControllerHandle con tipos XRTargetRaySpace/XRGripSpace, cableado provisional en main.ts
  (subtítulo "Escuchando…"); tests de la máquina de estados (7 casos)
- Verificación: `npm run check` pasa (32 tests). En el emulador: gatillo derecho → start/end
  (597 ms); pulsación de 100 ms → cancel too-short; el gatillo izquierdo se ignora; Espacio
  real (toque) → cancel too-short; Espacio mantenido 500 ms → end; la repetición de tecla se
  ignora; blur → cancel interrupted; sin errores en la consola
- Notas: la vibración no se puede comprobar en el emulador; queda en el check D0.

### Resumen del hito M0 (Fundaciones)
- Hecho: scaffold y Pages (T01, T01b), escena XR con emulador (T02), inicio 2D con micro y
  precarga (T03), subtítulos y HUD (T04), push-to-talk (T05).
- Toca el **check D0** en el visor (docs/DEVICE_CHECKS.md, sección D0). Para hacerlo sin PC
  hace falta que el repo esté publicado (ver DECISIONS.md → repo y push).
- Modo continuo activo: el loop sigue con M1 (voz).

## 2026-10-16 · T06 · Captura de audio
- Resultado: hecha
- Cambios: src/audio/recorder.worklet.ts (AudioWorklet que envía lotes de 4096 muestras solo
  mientras graba), src/audio/capture.ts (AudioCapture: start/stop/discard, mínimo 0,3 s, límite
  15 s con `onLimitReached`, salida a 16 kHz normalizada, `playRecording` para depurar),
  src/audio/dsp.ts (remuestreo con filtro de caja al bajar y lineal al subir, normalización de
  pico con ganancia máxima ×4 que nunca atenúa, rms/peak/concat); cableado en main.ts (PTT →
  captura, HUD "Audio", tecla P reproduce la última toma en debug); tests de DSP
- Verificación: `npm run check` pasa (47 tests; un tono de 440 Hz conserva su frecuencia con
  error < 2 % desde 48/44,1/8 kHz). En el navegador, con un oscilador conectado como micro
  (MediaStreamDestination): 1,2 s → 19.200 muestras a 16 kHz, pico 0,3; una toma de 150 ms se
  descarta; con límite de 2 s se corta con `truncated: true` y el `stop()` posterior devuelve
  null; `playRecording` crea un buffer de 16 kHz sin errores
- Notas: el micrófono real no se puede probar en el panel (bloqueado); queda para D1.

## 2026-10-16 · T07 · Script de descarga de modelos
- Resultado: hecha
- Cambios: scripts/fetch-models.mjs (`npm run fetch-models`, con `--only=` por grupo):
  descarga con revisiones fijadas de Whisper tiny/base q8 y la voz Piper davefx, copia desde
  node_modules el fonemizador piper-wasm y el runtime onnxruntime asyncify, verifica tamaño y
  sha256 (los ficheros grandes), escribe .part y renombra, y genera public/models/MANIFEST.json;
  nuevas dependencias @huggingface/transformers 4.3.1, onnxruntime-web (misma versión que usa
  transformers, una sola copia) y @diffusionstudio/piper-wasm 1.0.0
- Verificación: primera ejecución 21 ficheros, 232,1 MB (< 300 MB); la segunda ejecución
  no descarga nada (1,7 s, comprobando hashes); `npm run check` pasa
- Notas:
  - El dist/ pesa 223 MB porque Vite copia public/models; dentro del límite de Pages (1 GB).
  - Por defecto el STT usará el backend WASM con q8; WebGPU queda como opción para comparar en D1.
  - Aviso de licencias para producción en DECISIONS (espeak-ng GPL, base lessac).

## 2026-10-16 · T08 · TTS con Piper en un Worker
- Resultado: hecha
- Cambios: src/tts/piperCore.ts (fonemizador con WASM compilado una vez y datos de espeak en
  memoria, troceo por frases, feeds int64, síntesis, WAV), src/tts/piper.worker.ts (ORT con
  rutas locales, carga con progreso, calentamiento, mensaje de depuración `resources`),
  src/tts/piper.ts (PiperTTSProvider), src/tts/speakers.ts (ProviderSpeaker y fallback
  WebSpeechSpeaker solo con voces locales), src/tts/types.ts, src/audio/player.ts
  (AudioPlayer con AnalyserNode, `level()` y `stop()`), scripts/gen-fixtures.mts
  (`npm run gen-fixtures`, Node 24 con onnxruntime-node) y tests/fixtures/*.wav (5 frases
  del check D1); Vite con `worker.format: 'es'` y el glue CJS pre-empaquetado; precarga real
  "Voz del cliente"; tecla T en debug
- Verificación: `npm run check` pasa (59 tests). Fixtures en Node: 1,3–3,0 s de audio en
  ~150 ms por frase. En el navegador (dev): Piper carga en ~2,8 s; 2,0 s de audio en 267 ms y
  4,9 s en 545 ms; `say()` empieza a sonar en 237 ms; `level()` > 0 mientras suena y `stop()`
  corta; el Worker solo pide ficheros locales (/models/piper y /models/ort, cero externos). En
  el build de Pages (`/TestWebVR/`, sin cabeceras) carga y calienta en 4,5 s sin errores
- Notas:
  - Vite también empaqueta su copia del WASM de ORT (27 MB) en dist/assets; no se descarga
    (solo se usa la de models/ort), pero infla el dist. Pendiente para T18.
  - Que la voz sea inteligible lo confirma el test de ida y vuelta de T09 y, de oído, el check D1.

## 2026-10-16 · T09 · STT con Whisper en un Worker
- Resultado: hecha
- Cambios: src/stt/whisper.worker.ts (transformers.js 4.3 sin modelos remotos, ORT local,
  precarga propia con caché en memoria, calentamiento, mensaje `resources`),
  src/stt/whisper.ts (WhisperSTTProvider), src/stt/generation.ts (límites de decodificación
  contra bucles), src/stt/modelChoice.ts (`?stt=`, `?sttdevice=`), src/stt/types.ts,
  src/text/normalize.ts (normalización, Levenshtein y similitud; la reutilizará T14); main.ts
  con la precarga "Reconocimiento de voz" y PTT → captura → STT → subtítulo "Tú: …" y HUD
  (STT ms, modelo, backend); test lento `npm run test:slow` (tests/slow, `vitest --mode slow`)
- Verificación: `npm run check` pasa (71 tests). `npm run test:slow` con whisper-base: 5/5
  frases (similitud 0,84–1,00, ~0,8 s por frase en Node). En el navegador: Whisper base carga
  en 3,5 s con 9 peticiones, todas a /models (antes 17, porque cada fichero se pedía dos
  veces); transcripción de los fixtures idéntica a la de Node, 1,4–1,6 s por frase en este PC;
  flujo completo (micro denegado → modo texto → carga de voz y STT → "Entrar en VR") en 6,3 s
- Notas:
  - **Riesgo confirmado:** 1,4–1,6 s en un PC de 12 núcleos apunta a varios segundos en Quest.
    D1 lo medirá; en T18 se probarán más hilos para el STT cuando el TTS esté parado.
  - Whisper escribe "ticket" como "tiquete": el guion (T15) debe aceptar ticket/tiquet/tiquete/tique.
  - Si el STT no carga, la precarga ya no se queda colgada (se informa en el HUD; UX en T19).

## 2026-10-16 · T10 · Modo "eco" de extremo a extremo
- Resultado: hecha
- Cambios: src/app/conversation.ts (ConversationController: máquina de estados del PLAN §2,
  interrupción al pulsar mientras habla, vibración de "ocupado" si se pulsa mientras
  transcribe o piensa, "No te he entendido" si el STT devuelve vacío, contador de generación
  contra respuestas tardías; EchoResponder), src/debug/sessionLog.ts (log por turno: STT, TTS,
  total, audio, interrumpido, extras; medias; descarga JSON), src/ui/textInput.ts (`?text=1`,
  por encima del overlay del emulador), src/avatar/placeholder.ts (cápsula que cambia de color
  con el estado y se mueve con el nivel de voz), `ptt.buzzBusy()`; main.ts reescrito como raíz
  de composición; botón "Descargar log de sesión" en la pantalla 2D al salir de VR (debug) y
  tecla L; tests del controlador (8 casos) y del log (3)
- Verificación: `npm run check` pasa (82 tests). En el emulador: al entrar en VR el avatar
  saluda; escribiendo en el campo de texto responde "Has dicho: …" en 356 ms. **Voz de extremo
  a extremo en el navegador** (fixture WAV como micrófono vía MediaStream): captura con
  AudioWorklet → Whisper base "Lo siento mucho, vamos a buscar una solución." (exacto, 1,48 s)
  → Piper (0,46 s) → turno total 1,94 s; estados listening → transcribing → thinking →
  speaking; al salir de VR aparece el botón del log
- Notas: el overlay del emulador IWER tapaba el campo de texto; resuelto con z-index máximo.

### Resumen del hito M1 (Voz)
- Hecho: captura (T06), modelos (T07), TTS Piper (T08), STT Whisper (T09) y conversación en
  modo eco (T10). Todo en local, verificado con cero peticiones externas.
- Latencias en un PC de escritorio: STT 1,4–1,6 s por frase, TTS 0,25–0,5 s, turno ~2 s.
- Toca el **check D1** (rendimiento de voz en Quest 2 y 3): es el punto de decisión del
  proyecto. T11 (Vosk) queda pendiente de sus resultados.
- Modo continuo activo: el loop sigue con M2 (avatar).

## 2026-10-16 · T12 · Avatar placeholder y AvatarController
- Resultado: hecha
- Cambios: public/assets/RobotExpressive.glb (CC0, three.js r186) + créditos,
  src/avatar/types.ts (interfaz AvatarController), src/avatar/behaviour.ts (puro: ángulos de
  mirada con límites ±60°/±30°, suavizado independiente de los FPS, emoción → morphs, gesto →
  clip, plan de mirada por estado: atento al escuchar, mira a un lado al pensar, deriva suave
  en reposo), src/avatar/robotAvatar.ts (mixer con Idle, gestos de una vez con fundido de
  vuelta a Idle, morphs Angry/Sad/Surprised interpolados, cabeza que sigue al usuario y asiente
  con el nivel de voz, pose base restaurada cada frame para no acumular rotaciones, sin
  asignaciones por frame), la cápsula pasa a ser el respaldo; main.ts carga el robot en la
  precarga y pasa emoción y gesto de cada turno; regla ESLint para parámetros `_` sin usar
- Verificación: `npm run check` pasa (90 tests). En el emulador: el robot mira al usuario
  (vista frontal con ojos y cejas, trasera lisa), ojos a la altura del usuario y detrás del
  panel; mirada: −28° (usuario a la izquierda), +29°/−5° (a la derecha y más bajo), límite −60°
  (detrás); morph Angry 0 → 1 → 0 al cambiar de emoción; el gesto Yes se reproduce y vuelve a
  Idle; 144 FPS en el emulador
- Notas:
  - La interfaz de IWER reimpone la pose del visor; la mirada se prueba moviendo la cámara 2D
    (anotado en CLAUDE.md).
  - El robot es de dibujos y muy grande de cabeza (1,24 m de ancho con los brazos). Si el equipo
    lo ve raro en D2, se puede reducir o cambiar por un humano (idea aparcada).

## 2026-10-16 · T13 · Escena de tienda
- Resultado: hecha
- Cambios: src/scene/shop.ts (habitación, baldosas, mostrador con franja de color, la
  tostadora rota y una caja registradora, dos estanterías con productos de tamaños y colores
  deterministas; todo fusionado en un único mesh Lambert con colores por vértice;
  `SHOP_LAYOUT` compartido para colocar avatar y subtítulos), luces más baratas y cálidas en
  context.ts (sin suelo ni rejilla genéricos), el avatar detrás del mostrador (z −2,04) y los
  subtítulos flotando sobre el borde del mostrador; el HUD muestra draw calls por ojo
- Verificación: `npm run check` pasa (90 tests). En el emulador: 23 draw calls en 2D y 31 por
  ojo en VR (< 50), 4.145 triángulos, 144 FPS; capturas en 2D y en VR coherentes (robot detrás
  del mostrador, estanterías al fondo, subtítulos legibles)

### Resumen del hito M2 (Avatar)
- Hecho: robot con gestos, expresiones y mirada (T12) y tienda de bajo coste (T13).
- No hay check en dispositivo en este hito; lo visual se valida en D2.
- Modo continuo activo: el loop sigue con M3 (guion).

## 2026-10-16 · T14 · Motor de escenarios
- Resultado: hecha
- Cambios: src/scenario/types.ts (Scenario, nodos, intenciones con `kind` positivo/negativo,
  finales por umbral, consejos, historial), src/scenario/matcher.ts (frases clave
  consecutivas, erratas según longitud, negación con ventana de 2 palabras, puntuación por
  especificidad), src/scenario/validate.ts (errores legibles en español para el equipo),
  src/scenario/engine.ts (ScenarioEngine implementa Responder: prioridad nodo > global >
  fallback, globales que solo cambian el enfado, pista tras N fallos, variantes sin repetir con
  RNG inyectable, enfado limitado a 0–10, finales calmado/escalado, emoción derivada del enfado,
  extras para el log); `npm run test:coverage`
- Verificación: `npm run check` pasa. 29 tests del módulo (erratas del STT, negación, prioridades,
  umbrales, validador, historial); cobertura de src/scenario: 93 % de sentencias, 97,7 % de
  líneas y 100 % de funciones
- Notas: el primer diseño penalizaba disculparse (−1 de la disculpa y +1 del "no entendido");
  lo detectó un test y está corregido (ver DECISIONS).

## 2026-10-16 · T15 · Escenario "Devolución sin ticket"
- Resultado: hecha
- Cambios: scenarios/devolucion-sin-ticket.json (Javier, enfado inicial 7, 11 nodos: inicio,
  explica, sin_ticket, norma, revision, prueba, busca_compra, reparacion, cierre, fin_bien,
  fin_mal; 9 intenciones globales: saludo, disculpa, validar emoción, tranquilizar, "cálmese",
  insulto, culpar, "no es mi problema", consultar al encargado; 2–3 variantes por línea; pistas;
  consejos finales), rendimientos decrecientes en el motor (MAX_CALMING_USES = 2),
  `resolveJsonModule` en tsconfig; tests: tests/scenarioFile.test.ts (9: validez,
  alcanzabilidad de todos los nodos, final bueno, final malo, errores del STT, "tiquete",
  culpar, pistas, consejos) y 2 tests más del motor
- Verificación: `npm run check` pasa; las 3 conversaciones simuladas llegan al final esperado
  (buena práctica → calmado en 5 turnos sin errores; rigidez → se va en 2; con salidas reales
  de Whisper → calmado)
- Notas: al escribir los tests se ajustó la dificultad (con enfado inicial 8, culpar acababa la
  conversación en el primer turno). La lógica pedagógica está en DECISIONS.md para que el
  equipo la revise.

## 2026-10-16 · T16 · Integración conversación completa
- Resultado: hecha
- Cambios: src/scenario/registry.ts (guiones incluidos, `?scenario=`, barra de enfado con
  caracteres que la fuente 3D soporta), main.ts usa ScenarioEngine como Responder (título,
  descripción y nombre del personaje vienen del guion; HUD con "Enfado" y "Nodo"; emoción y
  gesto de cada turno al avatar), el motor registra qué intención provocó el final; tests del
  registro
- Verificación: `npm run check` pasa (133 tests). En el emulador, modo texto dentro de la
  sesión XR: recorrido bueno en 4 turnos (enfado 7 → 6 → 4 → 1 → 0, nodos explica → explica →
  busca_compra → fin_bien, final "calmado", estado `ended`, HUD "Enfado: ·········· 0");
  recorrido malo en 2 turnos (final "escalado", morph Angry = 1, el log guarda `norma_rigida`
  como causa); lo que se escribe tras el final se ignora

## 2026-10-16 · T17 · Pantalla final y resumen
- Resultado: hecha
- Cambios: src/app/summary.ts (puro: titular por resultado, turnos, curva de enfado, buenas
  prácticas y errores sin duplicados y en orden, hasta 3 consejos), `label` legible en las 32
  intenciones del guion, src/ui/finalPanel.ts (panel 3D con curva de enfado, listas, consejos y
  botones "Repetir" y, en debug, "Descargar log"), src/ui/panelPointer.ts (rayo del mando derecho
  + gatillo en VR con resaltado, clic de ratón en escritorio), `ptt.enabled` (el gatillo no habla
  mientras está el panel), main.ts con partidas recreables (motor, log y controlador nuevos al
  repetir, sin recargar) y tecla R; tests del resumen (4)
- Verificación: `npm run check` pasa (141 tests). En el emulador: final bueno → "¡Conseguido!
  Javier se va satisfecho", 5 turnos, 7 aciertos, ningún error, 3 consejos; final malo → "Javier se
  ha ido enfadado", curva ascendente, errores "Pedir el ticket lo primero" y "Escudarse en la
  norma" (y en otra partida "Culpar al cliente" y "Decirle que se calme"); "Repetir" con un clic
  real de ratón y con el rayo + gatillo del mando derecho reinicia la partida (enfado 7, nodo
  inicial, saludo, PTT reactivado)
- Notas:
  - La flecha "→" no está en Roboto latin y el filtro la quitaba: el texto dice "de 7 a 0".
  - Los botones eran opacos sin escribir profundidad y el fondo translúcido se pintaba encima;
    ahora son transparentes con renderOrder mayor.

### Resumen del hito M3 (Guion)
- Hecho: motor (T14), guion "Devolución sin ticket" (T15), integración (T16) y resumen final (T17).
- Toca el **check D2** (conversación completa en el visor).
- Modo continuo activo: el loop sigue con M4 (pulido).

## 2026-10-16 · T18 · Rendimiento
- Resultado: hecha
- Cambios: src/xr/deviceProfile.ts (detección de Quest 2/3/Pro por UA, escala del framebuffer
  0,85 en Quest 2, foveación 1, `onnxThreads` con `?threads=N`), context.ts aplica el perfil y
  mide "CPU ms/frame" (media móvil del bucle de frames), HUD con ese dato, Piper y Whisper usan
  el helper de hilos, el panel final ya no asigna un array por frame al apuntar, plugin de Vite
  que elimina el WASM duplicado de ORT del build; tests del perfil (11)
- Verificación: `npm run check` pasa (146 tests). Revisión de asignaciones por frame en
  context, avatar, HUD, puntero del panel y PTT: sin `new` en caliente salvo el resultado de
  `intersectObjects` cuando el panel está visible. Build de Pages: dist/assets sin WASM de ORT
  (27 MB menos que tras T08) y la app carga voz + Whisper en 9,6 s en la vista previa de Pages sin
  errores. En el emulador: 144 FPS y 31 draw calls por ojo (sin cambios: el cuello de botella real
  se medirá en D1/D2 con el nuevo "CPU ms/frame")
- Notas: no hay cifras de antes y después en el visor; las saldrán de D1/D2 (añadido a
  DEVICE_CHECKS, junto con la prueba de `?threads=`).

## 2026-10-16 · T19 · Robustez y errores
- Resultado: hecha
- Cambios: src/stt/hallucinations.ts (`cleanTranscript`), ConversationController con filtro de
  silencio por nivel de entrada, tiempo máximo del STT (mensaje propio) y limpieza de
  alucinaciones; pantalla de inicio con `warn()` y botón "Reintentar (recargar)"; avisos si no
  carga el STT o no hay ninguna voz; aviso si se pierde la pista del micrófono; al salir de VR se
  para la voz y se cancela la grabación; tests del filtro (13) y del controlador (+3)
- Verificación: `npm run check` pasa (162 tests). En el navegador: cargar un modelo inexistente
  falla en 87 ms con un error claro (no se cuelga); el aviso y "Reintentar" aparecen en la pantalla
  de inicio; salir de VR mientras el avatar habla para el audio (`player.playing === false`) y la
  conversación queda en `idle`
- Notas:
  - Para simular el fallo del STT de verdad intenté renombrar la carpeta del modelo, pero Windows
    la tenía bloqueada por el servidor de desarrollo; se probó con un modelo inexistente (misma ruta
    de error) y el aviso invocándolo directamente.
  - La pérdida del micrófono no se puede probar en el panel (no hay micro); queda para D2.

## 2026-10-16 · T20 · Offline y PWA
- Resultado: hecha
- Cambios: public/sw.js (COOP/COEP + caché: HTML con red primero, resto con caché primero, caché
  `app-<build>` y `models-<manifest>`, limpieza de cachés antiguas al activarse),
  src/pwa/register.ts (registro solo en producción, una recarga en la primera visita con
  protección contra bucles), plugin de Vite `stampServiceWorker` (identificador del build a
  partir de los ficheros emitidos e identificador de modelos a partir del MANIFEST),
  manifest.webmanifest e icon.svg con rutas relativas, se elimina coi-serviceworker (dependencia,
  fichero, script y créditos), README con uso sin conexión e instalación, D3 actualizado
- Verificación: `npm run check` pasa (162 tests). Build de Pages + `preview:pages` sin cabeceras:
  el SW propio controla la página y `crossOriginIsolated === true`; carga completa en 9,4 s y
  quedan en caché 9 ficheros de la app y 13 de modelos; **con el servidor apagado** la página carga
  aislada y la voz y Whisper se cargan de la caché en 4,1 s, sin avisos; con un build nuevo
  (identificador distinto) se borra la caché de la app anterior, se conserva la de modelos (13) y la
  página sirve el código nuevo
- Notas:
  - Mientras probaba, un script de prueba pulsó por error el botón oculto "Reintentar (recargar)"
    (comparte clase con "Continuar en modo texto"); era un fallo del script, no de la app.
  - La primera vez que una pestaña pasa de coi-serviceworker al SW nuevo puede recargarse una vez.

### Resumen del hito M4 (Pulido)
- Hecho: rendimiento (T18), robustez (T19) y offline/PWA (T20).
- Queda el **check D3** (sesión de validación con usuarios) y, antes, D0–D2.
- **Todas las tareas de código del backlog están hechas.** T11 (Vosk) solo se hará si los
  resultados de D1 lo piden. El loop se detiene: no quedan tareas elegibles sin el equipo.
