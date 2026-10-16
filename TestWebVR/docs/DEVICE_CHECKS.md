# Checks en dispositivo

Pruebas que **tiene que hacer una persona con las Quest puestas**. Son cortas (10–20 min).
Al terminar, guardad las notas (y el log JSON si se pide) en `docs/device-results/` con el
nombre `Dx-<quest2|quest3>-<fecha>.md`. El loop las lee en la siguiente iteración.

## Cómo abrir la app en las Quest

- **Opción A, GitHub Pages (recomendada):** abrid en Meta Quest Browser
  `https://<usuario>.github.io/<repo>/`. No hace falta PC ni cable. La primera visita recarga
  la página una vez (es el service worker que activa el modo multihilo) y descarga los modelos;
  las siguientes van desde la caché.
- **Opción B, por cable USB (desarrollo):** con el modo desarrollador activado en las Quest,
  ejecutad en el PC `adb reverse tcp:5173 tcp:5173` y abrid `http://localhost:5173`.
- **Opción C, por Wi-Fi (desarrollo):** con `npm run dev:lan` en el PC, abrid `https://<IP-del-PC>:5173` y aceptad el aviso del certificado.

Añadid `?debug=1` a la URL para ver el HUD con las métricas.

---

## D0 · Entrar en VR
Tras T03–T05.
- [ ] La pantalla de inicio carga y "Empezar" pide permiso de micrófono.
- [ ] Al aceptar, la barra de carga llega al 100 % y aparece "Entrar en VR". Al denegarlo,
  sale el mensaje con "Reintentar" y "Continuar en modo texto".
- [ ] "Entrar en VR" abre la sesión inmersiva; se ven el suelo y los mandos.
- [ ] Mantener el gatillo derecho vibra al empezar y al soltar, y el subtítulo cambia a
  "Escuchando…" mientras se mantiene. Un toque muy corto no debe contar. El gatillo izquierdo
  no hace nada.
- [ ] El HUD (`?debug=1`) se muestra y se oculta con B/Y; los acentos se ven bien.
- [ ] Apuntad lo que dice el HUD sobre las capacidades: WebGPU sí/no, crossOriginIsolated sí/no, núcleos.
- [ ] FPS aproximados: ____ (Q2) / ____ (Q3)

## D1 · Rendimiento de voz — PUNTO DE DECISIÓN
Tras T10. Hacedlo en **Quest 2 y Quest 3** con `?debug=1` (whisper-base). Si en Quest 2 tarda
más de 3 s, repetid con `?debug=1&stt=tiny` y, si el HUD dice WebGPU: sí, con `&sttdevice=webgpu`.
En esta fase el avatar es una cápsula que repite lo que entiende ("Has dicho: …").
- [ ] Tiempo de la primera carga (desde "Empezar" hasta "Entrar en VR"): ____ s
- [ ] Decid estas 5 frases y anotad qué entendió y la latencia del STT:
  1. "Buenos días, ¿en qué puedo ayudarle?"
  2. "Entiendo que esté molesto, tiene usted razón."
  3. "¿Tiene el ticket de compra?"
  4. "Lo siento mucho, vamos a buscar una solución."
  5. "Podemos cambiársela por otra o devolverle el dinero."
- [ ] La voz del TTS se entiende y suena aceptable (1–5): ____
- [ ] Tiempo total de turno percibido (soltar el gatillo → empieza a hablar): ____ s
- [ ] FPS y "CPU ms/frame" del HUD durante la transcripción: ____ FPS / ____ ms
- [ ] Si el STT va lento, probad `&threads=2`, `&threads=3` y `&threads=4` y anotad la latencia de
  cada uno (el HUD muestra "STT … ms").
- [ ] ¿Algún cuelgue, recarga de pestaña o aviso de memoria?
- [ ] Descargad el log de sesión: salid de VR (botón Meta) y pulsad "Descargar log de sesión"
  en la pantalla 2D. Guardadlo junto a las notas. Incluye la latencia de STT, TTS y turno por frase.
- [ ] Probad a interrumpir al avatar mientras habla pulsando el gatillo: debe callarse y escucharos.

## D2 · Conversación completa
Tras T17.
- [ ] Jugad el escenario intentando calmar al cliente. ¿Llega al final bueno? ¿Cuántos turnos?
- [ ] Jugadlo siendo borde. ¿Llega al final malo?
- [ ] ¿El avatar se siente presente (mirada, gestos, reacción al enfado)? (1–5): ____
- [ ] ¿Cuántas veces no entendió algo que sí era razonable? Anotad la frase.
- [ ] ¿Se puede interrumpir al avatar pulsando el gatillo mientras habla?
- [ ] Al terminar sale el panel de resumen. ¿Se lee bien? ¿Os parece justo lo que dice que ha
  funcionado y lo que hay que mejorar? Apuntad con el mando derecho a "Repetir" y pulsad el gatillo.
- [ ] Impresión general y qué cambiaríais.

## D3 · Sesión de validación
Tras T20. Con 3–5 personas que no hayan visto el prototipo.
- [ ] ¿Entienden qué hacer sin explicación (más allá de "mantén el gatillo para hablar")?
- [ ] ¿Les parece útil para practicar? (1–5)
- [ ] ¿Qué les ha sacado de la experiencia? (latencia, voz, avatar, que no le entienda…)
- [ ] Funciona sin conexión tras la primera carga completa: activad el modo avión en las Quest,
  cerrad la pestaña y volved a abrir la URL (o la app instalada). Debe cargar y conversar igual.
