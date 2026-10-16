# Decisiones

Aquí se comunica el loop con el equipo. El equipo solo tiene que leer y contestar en
**"Respuestas del equipo"**; el loop lo lee al inicio de cada iteración.

## Requisitos acordados con el equipo (2026-10-16)

- Todo dentro de las Quest, portable, sin PC cerca. Se lanzará en Quest 2 y Quest 3; se asume
  que Quest 2 irá más limitada.
- Sin lip-sync y sin conversación profunda: basta con que el STT y el TTS funcionen.
- Push-to-talk con un botón del mando.
- Sin servicios externos.
- Escenario: cualquiera de los dos roles vale. **Elegido:** el usuario es el dependiente y
  el avatar, un cliente enfadado (*Devolución sin ticket*). Es lo que mejor ejercita la
  desescalada.
- El equipo participa en la ideación; el desarrollo lo hace Claude.

## Decisiones técnicas

| Fecha | Tema | Decisión | Motivo |
|---|---|---|---|
| 2026-10-16 | Stack base | Vite + TS + Three.js | Ver PLAN §3 |
| 2026-10-16 | STT | Whisper base/tiny con Transformers.js en un Worker | Ver PLAN §3 |
| 2026-10-16 | TTS | Piper es_ES en WASM, en un Worker | Ver PLAN §3 |
| 2026-10-16 | Avatar | RobotExpressive (CC0) como placeholder | Trae gestos y morphs de emoción; cambiar a humano es una tarea aislada |
| 2026-10-16 | Publicación | GitHub Pages con despliegue desde GitHub Actions (tarea T01b) | Lo pide el equipo; HTTPS gratis y acceso desde las Quest solo con la URL. Los modelos se descargan en el CI, no van en el repo |
| 2026-10-16 | Versiones base (T01) | three 0.186.1, vite 8.3.4, vitest 5.0.5, typescript 6.0.3, eslint 10.12.0, typescript-eslint 8.71.2, prettier 3.9.10, @vitejs/plugin-basic-ssl 2.3.0 | Últimas estables compatibles entre sí; TS 7 queda fuera porque typescript-eslint aún no lo admite |
| 2026-10-16 | Dev server (T01) | HTTP en localhost por defecto; HTTPS solo con `npm run dev:lan` | localhost ya es un contexto seguro (también vía `adb reverse`); evita el aviso de certificado en el panel del navegador |
| 2026-10-16 | Pages (T01b) | Workflow con actions/checkout@v7, setup-node@v7, cache@v6, configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5; coi-serviceworker 0.1.7 copiado a `public/` | Últimas versiones mayores publicadas; coi-serviceworker es la solución estándar para tener COOP/COEP sin cabeceras |
| 2026-10-16 | Modo `pages` (T01b) | `npm run build:pages` / `preview:pages` reproducen Pages en local (subruta `/TestWebVR/`, sin cabeceras) | Evita las variables de entorno, que en Windows dan problemas |
| 2026-10-16 | Emulador (T02) | iwer 2.6.0 + @iwer/devui 2.6.0, solo en dev (import dinámico tras `import.meta.env.DEV`), con `forceInstall` | El navegador de escritorio expone `navigator.xr` pero no admite immersive-vr; Vite pre-empaqueta ambos y deduplica three |
| 2026-10-16 | Mandos (T02) | Modelo procedural (cilindro + gatillo) en lugar de XRControllerModelFactory | La factoría de three descarga los modelos de jsDelivr en runtime, y eso rompe la restricción de no usar servicios externos |
| 2026-10-16 | Texto 3D (T04) | troika-three-text 0.52.5 con Roboto latin local (@fontsource/roboto 5.3.0, OFL) y `sanitizeForFont` | troika descarga fuentes de fallback de jsDelivr para cualquier glifo que falte (aunque se le indique otra URL, acaba en el CDN); se filtra todo carácter fuera del subset latin |
| 2026-10-16 | HUD (T04) | Anclado al mando izquierdo y orientado siempre hacia los ojos | Se lee en cualquier postura de la mano |
| 2026-10-16 | Modelos STT (T07) | onnx-community/whisper-tiny@ff41770 y whisper-base@1846881, solo dtype q8 (encoder + decoder_merged quantized): 41 MB y 77 MB | Lo más ligero que mantiene buen español; con WASM es el formato más rápido en CPU. Licencia MIT |
| 2026-10-16 | Voz TTS (T07) | Piper es_ES-davefx-medium (rhasspy/piper-voices@c10ece1), 63 MB, voz masculina de España | Dataset CC0. sharvard (CC-BY 3.0, 77 MB) queda como alternativa |
| 2026-10-16 | Runtime ONNX (T07) | onnxruntime-web 1.31.0-dev.20260914 (la que fija @huggingface/transformers 4.3.1), build asyncify servido desde public/models/ort | Una sola copia y un solo WASM de 27 MB para STT y TTS; transformers.js lo descargaría de jsDelivr si no se le da la ruta |
| 2026-10-16 | Fonemizador (T07) | @diffusionstudio/piper-wasm 1.0.0 (piper-phonemize + espeak-ng en WASM, 18,7 MB) | Es lo que usan todos los runtimes Piper web; se sirve en local |
| 2026-10-16 | Runtime Piper (T08) | Propio y mínimo (src/tts/piperCore.ts + piper.worker.ts) sobre piper-phonemize y onnxruntime-web | @mintplex-labs/piper-tts-web y @diffusionstudio/vits-web llevan la URL de las voces de Hugging Face fija en el código y cargan ORT y el fonemizador de CDNs. El núcleo es común a navegador y Node (fixtures) |
| 2026-10-16 | Interfaz de voz (T08) | `TTSProvider` (texto → PCM) + `Speaker` (decir en voz alta, latencia, stop, nivel) | El fallback speechSynthesis no da PCM; la conversación solo usa Speaker. El fallback solo usa voces locales (`localService`), para que el texto no salga del visor |
| 2026-10-16 | Modelo STT por defecto (T09) | **whisper-base en todos los visores**; `?stt=tiny` solo para comparar | Test de ida y vuelta con voz Piper: base 5/5 (similitud 0,84–1,00); tiny 2/5, con errores en palabras clave ("ticket" → "DQ") que romperían el guion. Se mide la latencia en Q2 en D1 |
| 2026-10-16 | Decodificación Whisper (T09) | `max_new_tokens` ≈ 8 por segundo de audio, `no_repeat_ngram_size: 3`, `repetition_penalty: 1.1` (src/stt/generation.ts) | Evita el bucle típico de Whisper ("sí, sí, sí…" hasta 448 tokens, 8 s de CPU) |
| 2026-10-16 | Carga de Whisper (T09) | Rutas relativas al origen y precarga propia de los ficheros con `env.customCache` en memoria | transformers.js 4.3 no comprueba la existencia de ficheros locales con URL http(s) (no cargaba tokenizer ni preprocesador) y, con `progress_callback`, descarga cada fichero dos veces para saber su tamaño |
| 2026-10-16 | Backend STT (T09) | WASM por defecto; `?sttdevice=webgpu` para comparar en D1 | Determinista y disponible en todas partes; WebGPU con q8 no está garantizado en Quest Browser |
| 2026-10-16 | Avatar robot (T12) | RobotExpressive escalado por la altura del hueso Head (1,2 m → ojos a ~1,5 m, 1,78 m en total) y colocado según su caja posada para quedar detrás de los subtítulos | La caja en pose de reposo de este robot de dibujos engaña; la cabeza es enorme. La cápsula queda como respaldo si el GLB no carga |
| 2026-10-16 | Escena (T13) | Toda la geometría estática de la tienda fusionada en un mesh con colores por vértice y MeshLambertMaterial, sin texturas ni sombras | 1 draw call para el decorado; 31 draw calls por ojo con todo (objetivo < 50) |
| 2026-10-16 | Motor de guion (T14) | Frases clave consecutivas, con tolerancia a erratas por longitud de palabra (1 a partir de 5 letras, 2 a partir de 9), **negación** ("no entiendo" no cuenta como empatía, salvo que la frase clave la incluya) y la frase clave más larga gana | Los errores grandes del STT ("tiquete") se cubren con variantes en el guion, no ampliando la tolerancia, para no dar falsos positivos |
| 2026-10-16 | Intenciones globales (T14) | Una global reconocida sin respuesta propia (p. ej. "lo siento") no cuenta como "no entendido": no penaliza ni suma fallos | Si no, disculparse no servía de nada (−1 de la disculpa y +1 del fallback) |
| 2026-10-16 | Rendimientos decrecientes (T15) | Una misma intención solo reduce el enfado las 2 primeras veces; las que lo suben se aplican siempre | Si no, se podía calmar al cliente repitiendo "lo siento" sin resolver nada |
| 2026-10-16 | Rendimiento (T18) | Escala del framebuffer 0,85 en Quest 2 y 1 en el resto, foveación 1, frecuencia por defecto del navegador (72 Hz); hilos ONNX = núcleos − 2 (1–4), ajustable con `?threads=N` | Margen de GPU en Quest 2 sin bajar la nitidez en Quest 3. El multiview (dibujar los dos ojos en una pasada) solo existe en WebGPURenderer, no en WebGLRenderer: se descarta para el prototipo |
| 2026-10-16 | Build (T18) | Plugin de Vite que elimina la copia del WASM de ORT que onnxruntime-web emite en assets/ | Nunca se pide (ORT apunta a models/ort): 27 MB menos que desplegar |
| 2026-10-16 | Robustez STT (T19) | Grabaciones con pico < 0,02 no llegan al STT ("No te he oído bien"); tiempo máximo de 10 s por transcripción; filtro de alucinaciones (créditos de subtítulos, etiquetas de sonido, bucles de una palabra) | Ahorra segundos de CPU en el visor y evita respuestas a frases que nadie dijo. Un "gracias" a secas se conserva: el usuario puede decirlo de verdad al cerrar |
| 2026-10-16 | Service worker propio (T20) | `public/sw.js` sustituye a coi-serviceworker: añade COOP/COEP y cachea; HTML con red primero, el resto con caché primero; caché de la app por build (hash de los ficheros emitidos) y caché de modelos aparte (hash del MANIFEST); solo en producción | Solo puede haber un service worker por ámbito; separar las cachés evita volver a bajar 230 MB en cada despliegue; en desarrollo interferiría con la recarga en caliente de Vite |

<!-- El loop añade filas aquí: dependencias con su versión, modelos exactos, licencias, etc. -->

## Lógica pedagógica del guion "Devolución sin ticket" (para revisar)

Javier llega con enfado **7/10**. Se calma del todo (0) y se va contento, o llega a 10 y se va.

| Lo que dice el dependiente | Efecto | Por qué |
|---|---|---|
| Preguntar qué ha pasado, "¿en qué puedo ayudarle?" | −1, pasa a contar el problema | Escucha activa |
| "Entiendo", "tiene razón", "es normal que esté molesto" | −1 a −2 | Validar la emoción |
| "Lo siento", "disculpe" | −1 (solo las 2 primeras veces) | Disculparse ayuda, repetirlo no |
| "No se preocupe, lo solucionamos" | −1 | Transmitir que se va a resolver |
| Buscar la compra por la tarjeta o el sistema | −2 | Alternativa concreta al ticket |
| Ofrecer cambio o reembolso | −3 | Resolver |
| Ofrecer reparación | −1, pero el cliente prefiere cambio | Opción válida pero menos satisfactoria |
| Consultar con el encargado | −1 | Escalar internamente está bien |
| Pedir el ticket lo primero | +1 | Ir a la norma antes que a la persona |
| "Sin ticket no se puede", "son las normas" | +3 | Rigidez |
| "No es mi problema" | +3 | Desentenderse |
| "Cálmese", "no se ponga así" | +2 | Invalida la emoción (efecto contrario) |
| Culpar al cliente ("la habrá usado mal") | +2 | Acusar |
| Insultar | +3 | — |
| Algo que no encaja con nada | +1 y, tras 2 seguidas, una pista | La persona se impacienta si no se le atiende |

Recorrido bueno típico: 4–5 turnos. Recorrido malo: 2–3 turnos.

## Preguntas abiertas para el equipo

<!-- El loop añade aquí las dudas de producto, cada una con el valor por defecto que ha
     tomado para no bloquearse. Formato:
     - [Txx] Pregunta… — Por defecto: … -->

- [T01b] Repositorio de GitHub: creadlo (vacío, **público**: GitHub Pages gratis solo funciona
  con repos públicos; con uno privado hace falta un plan de pago), activad Settings → Pages →
  Source: **GitHub Actions** y pegad aquí la URL. Decid también si el loop puede hacer
  `git push` (y por tanto publicar) al cerrar cada tarea.
  — Por defecto: sin remoto y sin push; todo queda en commits locales.
- [T07] **Licencias para producción** (no afecta al prototipo): espeak-ng, el fonemizador del TTS,
  es GPL-3.0, y la voz davefx está afinada a partir de la voz lessac, cuyo dataset tiene licencia
  restrictiva. Para un producto comercial habría que revisar ambos. — Por defecto: se usan tal cual
  en el prototipo.
- [Plan] ¿El avatar debe ser humano ya en esta fase, o vale el robot para validar la mecánica?
  — Por defecto: robot hasta después de D2.
- [T15] ¿Os parece bien la tabla de efectos de arriba (qué suma y qué resta enfado, y cuánto)?
  — Por defecto: tal cual; se ajusta tras D2.
- [Plan] ¿Nombre y personalidad del cliente? — Por defecto: "Javier", unos 45 años, impaciente
  pero razonable si se siente escuchado.
- [Plan] ¿Qué debe ver el usuario al final: solo el resultado o también consejos? — Por
  defecto: resultado, curva de enfado y 2–3 consejos fijos.

## Respuestas del equipo

<!-- Escribid aquí. Ejemplos:
     - 2026-10-20 · Avatar: preferimos una mujer, aspecto de oficina.
     - 2026-10-20 · Repo: https://github.com/<usuario>/TestWebVR · push autorizado: sí -->

- Repo: (pendiente) · push autorizado: no
- 2026-10-16 · modo continuo: sí. El loop no se para en los hitos; sigue hasta que se agote la
  cuota de uso o no queden tareas.
