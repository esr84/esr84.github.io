# Loop Engineering — One Piece: La Caída de Arlong Park

Cada iteración sigue el mismo ciclo:

1. **Objetivo** — qué debe funcionar al terminar la vuelta.
2. **Implementación** — cambios mínimos para cumplirlo.
3. **Verificación** — ejecutar el juego en el navegador (capturas, consola, pruebas automáticas por `?test=`).
4. **Hallazgos** — qué falló o se ve mal.
5. **Corrección** → vuelta a 3 hasta cumplir el objetivo, luego siguiente iteración.

## Requisitos (fijos)

- JavaScript puro (Canvas 2D), sin dependencias.
- Acción/aventura estilo Castlevania clásico (NES/SNES): avance lateral, plataformas, enemigos, objetos que se rompen, jefe final.
- Gráficos **no pixel art**: dibujo vectorial con contornos y sombreado *cel-shading* tipo anime.
- Personajes elegibles: **Luffy** y **Daniela** (aspecto de Sanji, siempre llamada Daniela).
- Un único nivel: **Arlong Park**, jefe final **Arlong**.
- Jugable en PC (teclado / mando) y móvil (controles táctiles).

## Plan de iteraciones

| # | Objetivo | Estado |
|---|----------|--------|
| 1 | Motor: bucle de tiempo fijo, canvas escalado (HiDPI), input teclado/táctil/mando, audio sintetizado | ✅ |
| 2 | Arte: rig esquelético vectorial, Luffy y Daniela con animaciones | ✅ |
| 3 | Jugador: movimiento, salto, ataques, especiales, daño | ✅ |
| 4 | Nivel Arlong Park: fondo parallax, suelo, pozas, plataformas, farolillos | ✅ |
| 5 | Enemigos hombres-pez, proyectiles, objetos | ✅ |
| 6 | Mini-jefe Hatchan y jefe final Arlong (2 fases) | ✅ |
| 7 | Menús, diálogos, HUD, victoria/derrota, música | ✅ |
| 8 | Móvil: controles táctiles, orientación, rendimiento | ✅ |
| 9 | Pulido y pruebas de juego completas | ✅ |

## Registro

### Vuelta 1 — Motor + arte base
- **Hecho:** canvas HiDPI 960×540 lógico, bucle de paso fijo (60 Hz), entrada multi-fuente (teclado/táctil/mando), audio WebAudio sintetizado.
- **Verificación:** banco de pruebas `tests/art.html` con capturas ampliadas de cada personaje.
- **Hallazgos → corrección:** la oreja estaba demasiado adelantada (parecía un tercer ojo) en Luffy y Daniela → movida atrás; cicatriz de Luffy demasiado gruesa → trazo fino; cabeza de Arlong pequeña → +12 %, ojos más amenazantes.

### Vuelta 2 — Juego completo (primer montaje)
- **Hecho:** nivel Arlong Park (exterior → puerta → patio con pozas → arena de Hatchan → pasarela → arena de Arlong), enemigos, jefes, HUD, diálogos, menús.
- **Verificación:** título y juego renderizan a 144 fps sin errores. Detección táctil incorrecta en PC → ahora sólo `pointer: coarse` o primer toque real.

### Vuelta 3 — Bot de regresión (`tests/bot.js`, `/?bot`)
Simulación determinista `G.sim()` + bot que recorre el nivel y pelea.
| Problema detectado por el bot | Corrección |
|---|---|
| Atascado en la 1.ª poza: salto ≈162 px vs poza 160 px | Pozas reducidas a 120 px; salto de Luffy 800→840, velocidad 228→240; más control aéreo |
| Caídas repetidas en la poza ancha | Repisa intermedia más baja y ancha |
| Reaparición al borde de la poza | Punto seguro requiere suelo a ±48 px |
| Arlong nunca aparecía (referencia al jefe Hatchan derrotado) | Hatchan pasa a decorado K.O.; `boss` se libera |
| Arlong no hacía daño: *stun-lock* por golpes | "Aguante" (poise): se tambalea cada 5 golpes y contraataca a veces |
| Arlong demasiado letal tras el cambio | Daño del mordisco/Kiribachi/caída reducido en 1 |

Resultado: partida completa de principio a fin con ambos personajes (modo dios 91 s); sin modo dios el bot (que no esquiva) gana con Daniela 2 de 3 veces contra Arlong.

### Vuelta 4 — Verificación visual
| Hallazgo (captura) | Corrección |
|---|---|
| El muro del patio tapaba el cielo y la torre lejana | Muro bajado de y=150 a y=215 |
| La caja de diálogo tapaba a los personajes | Diálogo movido arriba, bajo el HUD |
| La barra del jefe quedaba bajo los botones de pausa/sonido | Barra movida al centro superior |
| Retrato de Arlong descentrado | Encuadre por personaje (`dx`, `hy`, escala) |
| Al clavarse, Arlong quedaba medio fuera de pantalla | Columnas visibles en los bordes de la arena; la nariz se clava en ellas; hitbox del embiste extendida hacia delante (sin rincón seguro) |
| Los seis brazos de Hatchan se amontonaban | Brazos en abanico: tres delante, tres detrás |
| Fondo de la selección de personaje medio negro | Se pinta también el mar |
| 404 del favicon | Favicon SVG del sombrero de paja |

### Vuelta 5 — Móvil
- Vertical: juego arriba, controles abajo, aviso "gira el móvil". Horizontal: controles translúcidos superpuestos.
- Prueba con eventos `PointerEvent` reales: salto, cruceta (derecha mueve 107 px en 0,4 s), abajo agacha, soltar limpia el estado.
- Rendimiento: 0,85 ms de CPU por fotograma en una escena cargada (margen amplio para móviles).

### Vuelta 6 — Balance final (bot que espacia y esquiva)
| Medida | Antes | Después |
|---|---|---|
| Arlong vs Daniela | 4/4 victorias, ~17 s | igual |
| Arlong vs Luffy | 0/4 (DPS la mitad) | 4/4 tras puñetazo 2→3 de daño |
| Arlong PV | 48 | 44 + mandarina y energía al entrar en fase 2 |
| Partida completa (desde Hatchan) | — | 4/4 victorias, 0–2 vidas perdidas |

## Cómo repetir las pruebas
- `node server.js` y abrir `http://localhost:8080/?bot`
- En la consola: `runBot('luffy')`, `runBot('daniela', 400, false)` (sin modo dios), `runBot('luffy', 200, false, {at: 2})` (sólo Arlong).
- Atajos de depuración: `?char=luffy|daniela` (salta menús), `?at=hatchan|arlong|<x>`, `?god`, `?debug` (cajas de colisión y FPS), `?touch` (fuerza controles táctiles).
- Banco de arte: `/tests/art.html` y `/tests/art.html?w=enemies`.

---

## Segunda vuelta: gráficos, animación y game feel

### Vuelta 7 — Animación
- **Mezcla de poses** (`A.blend`): las transiciones entre estados se interpolan (rápido en ataques, suave en locomoción). Las cajas de golpe siguen usando la pose objetivo para que el *timing* sea exacto.
- **Squash & stretch** con muelles amortiguados: estirón al saltar (0,78×1,25), aplastamiento al aterrizar proporcional a la velocidad, rebote del cuerpo de enemigos y jefes al recibir golpes.
- **Anticipación y seguimiento**: Luffy echa el brazo atrás antes del Pistol y **alterna brazos**; el brazo se dibuja como **tubo de goma curvo** que vibra al recogerse. Daniela **recoge la rodilla** antes de cada patada y tiene un **combo de 3** (Collier → Épaule → Poitrine, con llamas).
- **Estelas** (cinta *smear*) que siguen al puño o al pie, e **imágenes residuales** naranjas en el Mouton Shot.
- **Movimiento secundario**: el sombrero de Luffy se inclina y se eleva al caer; el flequillo y la chaqueta de Daniela ondean con la velocidad.
- Nuevas poses: **aterrizaje**, **derrape** al cambiar de sentido a toda velocidad, salto continuo (subida → cima → caída), carrera con rebote y brazos más marcados.
- **Animaciones de reposo**: Luffy se recoloca el sombrero; Daniela saca una mano del bolsillo, da una calada y suelta una bocanada de humo.
- Arte: brillo anime en el pelo, pliegues en pantalones, raya en el traje de Daniela.

### Vuelta 8 — Game feel
| Sistema | Detalle |
|---|---|
| Cámara | Sacudida por **trauma** (ruido senoidal + leve giro), **retroceso** en la dirección del golpe y **zoom de impacto** con muelle |
| Hitstop | Proporcional al daño (0,05–0,1 s); el enemigo tiembla durante la pausa |
| Fotograma de impacto | Negativo monocromo estilo manga en golpes de 4+, muerte y derrota de jefes (máx. 1 cada 0,5 s) |
| Líneas de concentración | En especiales, aparición de Arlong y golpe final |
| Feedback de golpe | Tajos direccionales, números de daño, destello blanco→rojo, **contador de combos** con bonificación |
| Control | Buffer de ataque (0,16 s), cola de combos, cancelar la recuperación con salto tras acertar, girarse al inicio del golpe |
| HUD | Vida perdida que se **drena** con retraso, panel que tiembla al recibir daño, "ESP" que late cuando el especial está listo |
| Peligro | Bordes rojos al recibir daño y latido con vida baja; aviso "!" antes del tajo; **burbujas** antes de que salte un hombre-pez |
| Recompensas | Lluvia de berries al romper farolillos, objetos que rebotan y **vuelan hacia el jugador** (imán) |
| Móvil | Vibración breve en golpes y daño |
| Accesibilidad | Con "reducir movimiento" del sistema: sin negativos y sacudida reducida |

### Vuelta 9 — Gráficos y atmósfera
- **Rayos de sol** animados, gaviotas, **el Going Merry** fondeado en el horizonte, olas con paralaje por profundidad.
- **Posprocesado**: gradación cálida/fría (soft-light) y viñeta pre-renderizada.
- Suelo con hierba, flores, musgo, grietas y guijarros (pseudoaleatorio estable). Pozas con reflejo cálido y espuma.
- Braseros con **charco de luz** parpadeante y **brasas**; motas de luz flotando.
- Primer plano con hojas oscuras y **luz de contorno** del atardecer.
- **Calidad adaptativa**: si baja de ~45 fps durante 3 s, se apagan gradación, rayos y motas.

### Hallazgos de esta vuelta → corrección
| Hallazgo | Corrección |
|---|---|
| La gradación apagaba los colores (arena gris lavanda) | Intensidad reducida |
| El destello blanco tapaba el negativo del impacto | Destello retrasado 0,12 s; negativo desaturado (blanco y negro) |
| "¡ESPECIAL LISTO!" saltaba al empezar | Sólo avisa al cruzar el umbral durante la partida |
| Bot atascado encadenando golpes a enemigos inalcanzables (efecto de la nueva cola de combos) | Bot ajustado a la altura real del golpe |
| Coste de render | 1,0 ms/fotograma de CPU (sin cambios relevantes) |

**Regresión final:** 9/10 partidas completas ganadas por el bot sin modo dios (5/5 Daniela, 4/5 Luffy), 0 atascos, 0 errores.

---

## Tercera tanda: vueltas continuas de mejora gráfica

Herramientas nuevas para el bucle: `tests/fx.html` (banco de efectos: cada efecto congelado en 3 instantes a ×3) y `G.freeze` (congela la simulación para capturar un fotograma exacto).

### Vuelta 10 — Acabado de personajes
- **Contorno exterior grueso**: cada personaje se dibuja primero como silueta engrosada y luego encima (`A.outlined`); el borde exterior queda más grueso que las líneas interiores, como en el anime.
- **Contraluz del atardecer** en las extremidades (banda cálida en el lado en sombra).
- *Hallazgo:* en formas con degradado radial (chaqueta de Daniela) el contraluz creaba una mancha marrón → limitado a las extremidades e intensidad reducida.

### Vuelta 11 — Efectos cartoon
- Polvo y humo como **nubecillas con contorno** (base + brillo, se encogen al desaparecer).
- **Explosiones de dibujo animado**: bolas que pasan de amarillo → naranja → humo gris.
- Gotas en forma de **lágrima con contorno** y **corona de salpicadura**.
- **Transición de iris** (círculo que se cierra sobre el personaje) en lugar del fundido a negro.

### Vuelta 12 — Fondos
- Nubes de atardecer **alargadas con base plana** y filo dorado; estratos en el horizonte; primeras estrellas; destellos en el reflejo del sol.
- **Isla de Cocoyashi** con el mandarinal de Bell-mère, su casa y un molino girando, reflejada en el mar.
- Patio: **columnas lacadas**, molduras de piedra y clave en los arcos, **guirnaldas de banderines**, variación de color en los sillares, musgo y sombra de contacto.
- Arena final: sillares, sombra, **portón con remaches y aldabas**, emblema de los Piratas de Arlong, farolillos.
- *Hallazgo:* la primera versión de las nubes parecían bolas de algodón rosa → rediseño alargado con base plana.

### Vuelta 13 — Ilustración del título
- Logotipo con capas de contorno, degradado con brillo y **el sombrero de paja sobre la "O"**; cinta roja con puntas plegadas para el subtítulo.
- **Silueta gigante de Arlong** con el ojo rojo encendido asomando tras Daniela; estallido radial de luz.
- Luffy lanzando el Pistol y Daniela en patada alta.
- *Hallazgos:* el sombrero heredaba un trazo blanco de 7 px del texto → se reinicia el estilo; el brillo del logo usaba `source-atop` sobre todo el lienzo → integrado en el degradado; la cabeza de Arlong quedaba tapada → recolocada.

Regresión: 4/4 victorias, 0 errores, 1,4 ms/fotograma.

### Vuelta 14 — La pasarela de la torre
- Nueva capa de paralaje (0,85): **la base de la torre principal** se eleva tras el muro en la segunda mitad del nivel, con tejado de pagoda, cornisa y **ventanas de celosía encendidas** (algunas con un vigía hombre-pez en silueta). Distingue la zona del patio y enlaza con la fachada final; se hunde con el derrumbe en la victoria.

### Vuelta 15 — Selección de personaje
- Tarjetas como **viñetas de manga** inclinadas con borde grueso, fondo del color de cada personaje, líneas de velocidad giratorias y **trama de puntos** (screentone); la tarjeta no elegida se oscurece; Daniela seleccionada patea con la pierna en llamas.

### Vuelta 16 — Narrativa visual: Nami
- **Nami** añadida al rig: pelo naranja corto con brillo, camiseta de rayas, minifalda, tatuaje de los Piratas de Arlong en el hombro; caras de llanto (con lágrimas) y de felicidad.
- La introducción es ahora una **página de manga de 4 viñetas** que aparecen con rebote: Cocoyashi al atardecer, primer plano de Arlong, Nami llorando bajo la lluvia, y el héroe elegido.
- **Victoria**: Nami entra corriendo y se queda junto al protagonista; estadísticas a la derecha para no tapar la escena.
- *Hallazgos:* el flequillo de Nami tapaba los ojos → subido; la cabeza del héroe se salía de la viñeta → escala ajustada.

### Vuelta 17 — Variedad de enemigos
- Cada variante de hombre-pez tiene un accesorio propio: **pañuelo rojo** anudado con puntas al viento, **parche y cicatriz**, **gorra de marinero**, o **aleta de tiburón con sonrisa dentada**.

### Vuelta 18 — HUD estilo manga
- Panel inclinado con borde grueso, **franja del color del personaje** con trama de puntos, retrato con **marco de estallido dorado**, celdas de vida inclinadas con brillo (amarillo = vida drenándose), barra de energía segmentada.
- Barra del jefe continua con **drenaje retrasado**, emblema del sol-tiburón y destello al recibir golpes.

### Vuelta 19 — Espectáculo de jefes
- Al levantarse Arlong: **géiseres de agua**, onda de choque y polvo.
- Fase 2: **aura roja** de lenguas de energía con chispas que suben.
- Shark on Darts: **tiburón de agua translúcido** envolviéndolo durante el embiste.

### Vuelta 20 — El atardecer avanza
- Con el progreso (`G.nightK`), el cielo pasa del atardecer al crepúsculo, el **sol se hunde** tras el horizonte, aparecen **más estrellas**, los rayos se apagan, los **farolillos brillan más** y la gradación se enfría.

### Vuelta 21 — Reflejos en el agua
- Personajes y enemigos se **reflejan invertidos** en las pozas, en franjas desplazadas que simulan la ondulación. Comprimidos verticalmente (×0,28) porque la franja de agua en pantalla es estrecha; sin sombras ni estelas en el reflejo.

### Vuelta 22 — Derrota dramática
- Al morir: **cámara lenta**, fotograma de impacto, líneas de concentración y **estrellas de K.O.** girando sobre la cabeza.
- **Game Over ilustrado**: lluvia, foco de luz, el sombrero de Luffy (o el cigarro humeante de Daniela) en el suelo y el texto agrietado que tiembla al aparecer.
- *Hallazgo:* el humo del cigarro creaba partículas que no se actualizan en esa pantalla → sustituido por una voluta dibujada. *Nota del bucle:* las capturas a veces devuelven el fotograma anterior → esperar 1 s antes de capturar.

### Vuelta 23 — Diálogos en bocadillos
- **Bocadillo blanco** con contorno grueso, sombra y rabito hacia el retrato; **etiqueta inclinada** del color de cada personaje; retrato con estallido; indicador ▼ para continuar.

### Vuelta 24 — Onomatopeyas e impactos
- Gatling: "¡DA!/¡DADA!/¡DADADA!" en cada ráfaga y **estelas detrás de cada puño**.
- Golpes fuertes: onomatopeyas "¡PAM!/¡ZAS!/¡BAM!/¡CRAC!" (45 % de probabilidad, para no saturar).
- Farolillos que **estallan en llamas de papel**; objetos del suelo con **destello** periódico.

### Vuelta 25 — Separar personajes y fondo
- Trazo de los fondos **más fino y translúcido** (tono cálido) frente al contorno fuerte de personajes y plataformas: la acción se lee mucho mejor.
- **Espuma de olas** rompiendo en la orilla del exterior.

### Vuelta 26 — Marcas en el suelo
- **Grietas radiales** en los aterrizajes muy fuertes (Ono/Concassé, caída de Hatchan con "¡DON!", golpe de Kiribachi) y **charcos de tinta** donde cae la tinta de Hatchan; se desvanecen solas.
- **Gomu Gomu no Ono**: la pierna de Luffy se estira hacia el cielo antes del hachazo, con el grito del ataque.

### Vuelta 27 — Arlong más amenazante
- **Sombra de villano** sobre la mirada, **brillo rojo** en el ojo, manga con **estampado de flores** y dobladillo.

### Vuelta 28 — Cruzar la puerta
- Evento único al entrar en Arlong Park: **sello rojo "¡ARLONG PARK!"** que se estampa (escala 2,2 → 1 con rebote), líneas de concentración, temblor y rugido.

### Vuelta 29 — Retratos expresivos
- Cada línea de diálogo puede llevar `face`: Luffy enfadado/gritando, Daniela con mirada fría, Arlong y Hatchan gritando, K.O. al ser derrotados. Nami tiene retrato propio.

### Vuelta 30 — Entrada del título
- Personajes que entran deslizándose, **logotipo que cae y aterriza** con destello y anillo de choque, cinta que entra desde la izquierda; el texto de inicio aparece al final.

### Vuelta 31 — Tormenta final
- Al entrar Arlong en fase 2: el cielo se oscurece, **lluvia oblicua en dos capas**, salpicaduras en el suelo y **relámpagos** con destello y trueno sintetizado. Amaina al vencer.
- Medición: contra Arlong directamente 12/12 victorias; la variación en partidas completas viene de vidas perdidas antes.

### Vuelta 32 — Proporciones
- Cabezas de Luffy, Daniela y Nami un **10 % mayores** para que las expresiones se lean a tamaño de juego.

### Vuelta 33 — Profundidad de primer plano
- **Guirnaldas de farolillos grandes** muy cerca de la cámara (paralaje 1,35) en la parte alta del patio, en penumbra con halo cálido.

### Vuelta 34 — Vida ambiental
- **Sombras de peces** nadando bajo el agua de las pozas; **cangrejitos** que corretean por la arena (y se apartan si te acercas); **gaviotas posadas** en los postes que echan a volar al pasar.

### Vuelta 35 — Iluminación
- **Haces de luz** del atardecer entrando por los arcos del patio hasta el suelo (se atenúan al anochecer).
- Capa de **luz aditiva** de braseros y farolillos sobre la escena: los personajes cercanos quedan iluminados de verdad.

### Vuelta 36 — Calidad adaptativa (hallazgo importante)
- Con la ventana sin foco, el navegador limita los fotogramas (~14 fps) y **la calidad adaptativa se activaba por error**, apagando efectos para siempre (pasaría en móvil al cambiar de app).
- Corrección: no cuenta con la página oculta; se **recupera** tras 8 s fluidos; si baja dos veces se queda baja (evita oscilar); `?low` fuerza calidad baja.

### Vuelta 37 — Objetos y proyectiles
- Carne humeante, orbe de energía con anillo orbital, sombrero 1UP con aura dorada; arpones con cuerda ondulante; balas de agua con estela de gotas.

### Vuelta 38 — Hatchan
- Ventosas de pulpo en los antebrazos, brillo en los ojos, ojos en espiral y gota de sudor al quedar K.O.

### Pendiente para próximas vueltas
- Menú de pausa ilustrado; derrota de Hatchan con explosión de tinta; pulido de caras (expresiones de enfado con sombras); medir FPS reales en un móvil.
