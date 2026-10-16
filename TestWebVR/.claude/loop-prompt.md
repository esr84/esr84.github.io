# Iteración del loop — TestWebVR

Eres el único desarrollador de este prototipo. El equipo solo participa en la ideación:
**no le pidas que programe ni que tome decisiones técnicas**. Ejecuta exactamente UNA
iteración y termina.

## 1. Orientarte (siempre, al empezar)

1. Lee `CLAUDE.md`, `docs/PLAN.md`, `docs/BACKLOG.md` y las **3 últimas** entradas de
   `docs/PROGRESS.md`.
2. Lee `docs/DECISIONS.md`, sección "Respuestas del equipo", por si hay respuestas nuevas
   que cambien algo.
3. Mira si hay resultados nuevos en `docs/device-results/` (los checks D0–D3 los hace una persona).
4. Si hay remoto y push autorizado, mira el último despliegue con la API pública
   (`curl -s "https://api.github.com/repos/<owner>/<repo>/actions/runs?per_page=1"`).
   Si falló, arreglarlo es la tarea de esta iteración.
5. `git status` y `git log --oneline -5`. Si hay cambios sin commitear de una iteración
   anterior interrumpida, decide si completarlos o descartarlos y anótalo en PROGRESS.md.

## 2. Elegir la tarea

- Si hay una tarea `[~]`, retómala.
- Si no, elige la **primera** tarea `[ ]` de `BACKLOG.md` cuyas dependencias estén `[x]`,
  saltando las de **Tipo: humano**.
- Una dependencia de tipo humano (D0–D3) cuenta como satisfecha si su nota dice "no bloquea".
  Para T11 (condicional): si no hay resultados de D1, sáltala por ahora.
- Si no queda ninguna tarea elegible, ve directamente al paso 6 (parar).

Marca la tarea `[~]` en BACKLOG.md antes de empezar.

## 3. Implementar

- Haz **solo** lo que pide la tarea. No adelantes trabajo de tareas futuras ni refactorices
  fuera de su alcance. Si ves algo que convendría hacer, añádelo como nota en PROGRESS.md.
- Respeta las restricciones de `CLAUDE.md`. Las más importantes: **nada externo en runtime**,
  todo en Quest, push-to-talk, sin LLM y sin lip-sync.
- Si una librería candidata no sirve (carga desde un CDN sin poder evitarlo, no funciona en
  un Worker, licencia incompatible…), prueba la siguiente candidata y documenta por qué.
- Ante una duda de producto o de diseño: elige la opción más simple que valide la idea,
  apúntala en `DECISIONS.md` → "Preguntas abiertas para el equipo" con el valor por defecto
  que has elegido, y **sigue**. No te bloquees esperando una respuesta.
- Para dependencias nuevas, fija la versión exacta y anótala en DECISIONS.md.

## 4. Verificar (obligatorio antes de dar la tarea por hecha)

1. `npm run check` debe pasar (en T01, cuando ya existan los scripts).
2. Comprueba cada punto de **Aceptación** de la tarea, uno por uno.
3. Si la tarea toca la UI o la escena: arranca el dev server con el panel del navegador
   (`preview_start` con la configuración `dev` de `.claude/launch.json`), abre la página con
   los parámetros necesarios (`?debug=1`, `?text=1`, `?emulate=1`), revisa la consola
   (sin errores) y haz una captura de pantalla para confirmar el resultado visual.
4. Si algo falla, arréglalo. Como máximo **3 intentos** de arreglo por problema. Si sigue
   fallando, marca la tarea `[!]`, describe el bloqueo en PROGRESS.md (qué probaste, el
   error exacto y la siguiente opción sugerida) y pasa al paso 5.

No marques nunca `[x]` una tarea cuya aceptación no hayas comprobado. Si algo solo se puede
comprobar en el visor, márcala `[x]` cuando pase en el emulador y añade el punto a
`docs/DEVICE_CHECKS.md` en el check que corresponda.

## 5. Registrar y commitear

1. BACKLOG.md: marca la tarea `[x]` (o `[!]`).
2. PROGRESS.md: añade una entrada **al final** con este formato:

   ```
   ## <fecha ISO> · Txx · <título>
   - Resultado: hecha | bloqueada
   - Cambios: <ficheros o módulos principales>
   - Verificación: <qué comandos y comprobaciones pasaron>
   - Notas: <decisiones, deudas, cosas a vigilar en el visor>
   ```

3. DECISIONS.md: añade las decisiones técnicas tomadas (librería, versión, motivo).
4. `git add -A && git commit -m "Txx: <título>"` con las líneas de atribución que
   correspondan.
5. **Push:** solo si en `DECISIONS.md` → "Respuestas del equipo" pone `push autorizado: sí`
   y hay un remoto configurado. Entonces `git push` a `main` (eso publica en GitHub Pages).
   Antes, comprueba que `npm run check` acaba de pasar. Nunca hagas `--force`.
   Si el workflow de Actions falla, la siguiente iteración lo arregla antes de coger otra tarea.

## 6. Parar el loop

Detén el loop (en `/loop`, llama a `ScheduleWakeup` con `stop: true`) si se cumple
cualquiera de estas condiciones:

- No quedan tareas elegibles (todas `[x]`, `[!]` o de tipo humano pendientes).
- Hay **2 tareas `[!]` seguidas**: algo de fondo no funciona y hace falta revisarlo.
- Has terminado una tarea que cierra un hito (T05, T10, T13, T17, T20). Para un momento:
  deja en PROGRESS.md un resumen del hito y qué check en dispositivo toca ahora. El equipo
  relanza el loop cuando lo haya visto.
  **Excepción, modo continuo:** si en `DECISIONS.md` → "Respuestas del equipo" pone
  `modo continuo: sí`, escribe igualmente el resumen del hito en PROGRESS.md pero **no
  pares**: sigue con la siguiente tarea.

Si no, programa la siguiente iteración de inmediato (el retardo mínimo que permita el loop).

Al terminar la iteración, responde en 3 líneas como mucho: tarea, resultado y siguiente paso.
