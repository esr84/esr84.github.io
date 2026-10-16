# Plan técnico del prototipo

## 1. Objetivo y alcance

Validar si una conversación por voz con un avatar en VR, ejecutada **íntegramente en unas
Meta Quest**, es suficientemente creíble y ágil para entrenar soft skills.

**Dentro del alcance**
- Escena VR sencilla (mostrador de tienda) con un avatar animado.
- Push-to-talk con el gatillo → STT local → guion → TTS local → el avatar "habla".
- Un escenario completo: *"Devolución sin ticket"* (el avatar es un cliente enfadado, el
  usuario es el dependiente y debe calmarle).
- Nivel de enfado del avatar que sube o baja según lo que diga el usuario, con dos finales.
- Pantalla final con un resumen y un log de sesión exportable.

**Fuera del alcance:** lip-sync, LLM, escucha continua, multiusuario, editor de escenarios,
backend, analítica remota, avatar fotorrealista.

## 2. Arquitectura

```
┌──────────────────────── Hilo principal ─────────────────────────┐
│  XR (Three.js)  ── PTT (gatillo / Espacio) ──► AudioCapture      │
│       ▲                                          │ Float32 16 kHz│
│       │                                          ▼               │
│  AvatarController ◄── ConversationController ◄── STTProvider ◄───┼── stt.worker (Whisper)
│       ▲                    │      ▲                              │
│       │                    ▼      │                              │
│   UI 3D (subtítulos,   ScenarioEngine (TS puro)                  │
│   HUD, final)              │                                     │
│                            ▼                                     │
│                       TTSProvider ──► AudioPlayer ───────────────┼── tts.worker (Piper)
└──────────────────────────────────────────────────────────────────┘
```

### Máquina de estados de la conversación (`ConversationController`)

```
INTRO ──(avatar dice su línea inicial)──► IDLE
IDLE ──(PTT pulsado)──► LISTENING ──(PTT soltado)──► TRANSCRIBING
TRANSCRIBING ──(texto)──► THINKING ──(respuesta del guion)──► SPEAKING ──► IDLE
SPEAKING ──(PTT pulsado = interrumpir)──► LISTENING      (barge-in manual, barato)
cualquier estado ──(nodo final del guion)──► ENDED
```

El avatar refleja cada estado: `LISTENING` → mira al usuario e inclina la cabeza;
`TRANSCRIBING/THINKING` → gesto de "pensar"; `SPEAKING` → animación de hablar más el
movimiento de cabeza según la amplitud del audio.

### Interfaces clave

```ts
interface STTProvider {
  load(onProgress?: (p: number) => void): Promise<void>;
  transcribe(pcm16k: Float32Array): Promise<{ text: string; ms: number }>;
}
interface TTSProvider {
  load(onProgress?: (p: number) => void): Promise<void>;
  synthesize(text: string): Promise<{ audio: AudioBuffer; ms: number }>;
}
interface ScenarioEngine {
  start(): AvatarTurn;                 // línea inicial
  respond(userText: string): AvatarTurn;
  readonly state: { nodeId: string; anger: number; ended: boolean; outcome?: string };
}
interface AvatarTurn {
  text: string;
  emotion: 'neutral' | 'annoyed' | 'angry' | 'calm' | 'grateful';
  gesture?: 'yes' | 'no' | 'wave' | 'shrug' | 'point';
  matchedIntent?: string;
}
```

## 3. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Motor 3D | Three.js con su WebXR nativo | Ligero, control total del rendimiento en Quest |
| STT | Whisper `base` q8 (fallback `tiny`) con Transformers.js en un Worker; WebGPU si existe, si no WASM | Buen español, funciona sin servidor |
| Alternativa STT | Vosk-browser (modelo pequeño `es`) | Solo si Whisper no da una latencia aceptable en Quest (punto de decisión en el check D1) |
| TTS | Piper `es_ES` (voz masculina tipo `davefx` o `carlfm`, calidad *medium*) en WASM | Tiempo real incluso en CPUs modestas, ~60 MB |
| Fallback TTS | `speechSynthesis` del navegador, si hay voz `es` | Por si Piper falla en el dispositivo |
| Hilos WASM | Cabeceras COOP/COEP (`crossOriginIsolated`) en dev; `coi-serviceworker` en GitHub Pages | WASM multihilo = 2–4× más rápido |
| Publicación | GitHub Pages, desplegado con GitHub Actions (`actions/deploy-pages`). El workflow descarga los modelos y construye la app | HTTPS gratis (obligatorio para WebXR y el micro); desde las Quest basta con abrir una URL, sin PC ni cable. Pages no sirve ficheros de Git LFS y GitHub rechaza ficheros > 100 MB, por eso los modelos no van en el repo |
| Avatar | Placeholder `RobotExpressive.glb` (CC0, de los ejemplos de three.js) | Ya trae Idle, Yes, No, Wave… y morphs Angry/Sad/Surprised. Se cambia por un humano tras validar |
| Texto 3D | `troika-three-text` | Texto nítido con acentos y ñ |
| Guion | JSON con nodos, intenciones por palabras clave con tolerancia a errores (Levenshtein) y nivel de enfado 0–10 | Determinista, testeable, tolerante a fallos del STT |
| Desarrollo sin visor | Emulador `iwer` + teclado + `?text=1` | Permite que el loop verifique casi todo sin unas Quest |
| Permiso de micrófono | Se pide en la pantalla 2D **antes** de entrar en VR | Los diálogos de permisos dentro de la sesión inmersiva no son fiables |

## 4. Diseño del guion (`scenarios/*.json`)

```jsonc
{
  "id": "devolucion-sin-ticket",
  "title": "Devolución sin ticket",
  "persona": { "name": "Javier", "voice": "es_ES-davefx-medium" },
  "initialAnger": 7,
  "endings": {
    "calmed":   { "when": "anger <= 2", "node": "fin_bien" },
    "escalated":{ "when": "anger >= 10", "node": "fin_mal" }
  },
  "globalIntents": [
    { "id": "disculpa", "keywords": ["lo siento", "disculpe", "perdone"], "anger": -1 },
    { "id": "insulto",  "keywords": ["tonto", "pesado", "callese"], "anger": +3 }
  ],
  "nodes": {
    "inicio": {
      "say": ["¡Esto es una vergüenza! Compré esta tostadora hace una semana y ya no funciona."],
      "emotion": "angry",
      "intents": [
        { "id": "empatia", "keywords": ["entiendo", "comprendo", "tiene razon"], "anger": -2, "next": "pide_ticket" },
        { "id": "ticket",  "keywords": ["ticket", "factura", "recibo"], "anger": +1, "next": "sin_ticket" }
      ],
      "fallback": { "say": ["¿Me está escuchando? ¡Le digo que no funciona!"], "anger": +1 }
    }
  }
}
```

- **Normalización:** minúsculas, sin acentos ni signos de puntuación, colapsar espacios.
- **Coincidencia:** frase clave contenida en el texto, o similitud por palabra con
  distancia de Levenshtein ≤ 1 para palabras de más de 5 letras (tolera los errores del STT).
- **Prioridad:** intenciones del nodo > intenciones globales > fallback. Las globales
  modifican el enfado pero no cambian de nodo (salvo que lo indiquen).
- **Variantes:** `say` es una lista; se elige una que no se haya usado aún.
- **Repeticiones:** tras N fallbacks seguidos en un nodo, el avatar da una pista
  ("¿Me va a ayudar o no?").

## 5. Presupuestos y métricas

| Métrica | Objetivo Quest 3 | Aceptable Quest 2 |
|---|---|---|
| FPS en VR | 90 | 72 |
| STT (frase de ~3 s) | < 1,5 s | < 3 s |
| TTS (frase corta, primer audio) | < 0,5 s | < 1 s |
| Tiempo total de turno (soltar gatillo → empieza a hablar) | < 2,5 s | < 4 s |
| Primera carga (modelos) | < 300 MB en total; se cachean | — |
| Draw calls de la escena | < 50 | — |

Todas se muestran en el HUD (`?debug=1`) y se guardan en el log de sesión.

## 6. Hitos

| Hito | Contenido | Validación en dispositivo |
|---|---|---|
| **M0 Fundaciones** | Proyecto, escena XR, emulador, inicio 2D, paneles, push-to-talk | D0: entra en VR en Quest, el gatillo responde |
| **M1 Voz** | Captura, modelos, TTS, STT, modo "eco" | **D1: latencia y precisión del STT/TTS en Q2 y Q3 → punto de decisión** |
| **M2 Avatar** | Avatar placeholder, estados, mirada, escena de tienda | — |
| **M3 Guion** | Motor, escenario completo, integración, pantalla final | D2: conversación completa en el visor |
| **M4 Pulido** | Rendimiento, robustez, PWA/offline, despliegue | D3: prueba con usuarios de validación |

**Punto de decisión D1.** Si el STT con Whisper `base` supera 3 s en Quest 2:
(a) usar `tiny` en Q2 y `base` en Q3, o (b) añadir la tarea alternativa con Vosk. El loop
no se bloquea: implementa (a) por defecto y anota la decisión en `DECISIONS.md`.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Whisper es lento en la CPU de las Quest | Frases cortas (PTT), `tiny`, WASM multihilo, WebGPU si existe, Vosk como plan B |
| Memoria del navegador en Quest 2 | Cargar solo un modelo de STT; liberar buffers; medir en D1 |
| El STT entiende mal → el guion falla | Palabras clave tolerantes; el subtítulo muestra qué entendió; fallbacks |
| Que no haya WebGPU o hilos WASM en Quest Browser | Detección en runtime + fallback a WASM monohilo; se registra en el HUD |
| Avatar robótico poco creíble | Es un placeholder; cambiar a humano es una tarea aislada tras validar |
| El loop no puede probar en el visor | Todo verificable en el emulador; los checks D0–D3 los hace una persona |
