# One Piece: La Caída de Arlong Park

Juego de acción y aventura de avance lateral inspirado en los Castlevania clásicos (NES/SNES), hecho en JavaScript puro con Canvas 2D. Los gráficos **no son pixel art**: todos los personajes se dibujan con trazos vectoriales, contornos y sombreado *cel-shading* de estilo anime, a la resolución nativa de la pantalla.

## Cómo jugar

- **Sin instalar nada:** abre `index.html` en el navegador.
- **Con servidor local** (recomendado para probar en el móvil dentro de la misma red):
  ```bash
  node server.js
  ```
  y abre `http://localhost:8080` (o `http://<IP-del-PC>:8080` desde el móvil).

Las fuentes se cargan de Google Fonts; sin conexión se usan fuentes de respaldo.

## Personajes

| | Luffy | Daniela |
|---|---|---|
| Ataque | Gomu Gomu no Pistol: puño elástico de largo alcance (alterna brazos) | Combo de hasta 3 patadas |
| Especial (10 de energía) | Gomu Gomu no Gatling | Mouton Shot: embestida invulnerable |
| En el aire ↓ + ataque | Gomu Gomu no Ono | Concassé |
| Extra | La carne le cura por completo | Doble salto |

## Controles

| Acción | Teclado | Mando | Móvil |
|---|---|---|---|
| Moverse | ← → / A D | Cruceta / stick | Cruceta virtual |
| Agacharse | ↓ / S | Abajo | Cruceta abajo |
| Saltar | Espacio / Z / K | A | SALTO |
| Atacar | X / J | X | ATQ |
| Especial | C / L | B / Y | ESP |
| Bajar de una repisa | ↓ + Saltar | | |
| Pausa | P / Esc | Select | ❚❚ |
| Sonido | M | | ♪ |

## El nivel

Un único nivel en Arlong Park: la orilla de Cocoyashi, la puerta de Arlong Park, el patio con pozas (de las que saltan hombres-pez, como los tritones de Castlevania), el mini-jefe **Hatchan** con sus seis espadas, la pasarela de la torre y, por último, **Arlong**, sentado en su tumbona. Arlong tiene dos fases: en la segunda saca el **Kiribachi**. Su *Shark on Darts* se esquiva saltando, y si falla, se queda con la nariz clavada en una columna.

Los farolillos y braseros se rompen y sueltan objetos: carne, mandarinas de Nami, berries, energía y un sombrero de paja que da una vida extra.

## Sensaciones de juego

Hitstop proporcional al daño, cámara con sacudida suave y zoom de impacto, fotogramas de impacto en negativo estilo manga, líneas de concentración en los especiales, contador de combos, números de daño, estelas de golpe e imágenes residuales. Los personajes tienen *squash & stretch*, anticipación en los ataques, derrapes, aterrizajes y animaciones de espera. Si el sistema tiene activado "reducir movimiento", se desactivan los destellos y se suaviza la sacudida. En equipos lentos el juego reduce solo algunos efectos para mantener la fluidez.

## Estructura

```
index.html        página y controles táctiles
css/style.css     diseño adaptable (horizontal / vertical)
js/core.js        utilidades, lienzo HiDPI, entrada, física
js/audio.js       efectos y música chiptune sintetizados (WebAudio)
js/art.js         rig esquelético y dibujo de Luffy y Daniela
js/art_enemies.js hombres-pez, Hatchan, Arlong, objetos y decorados
js/fx.js          partículas y onomatopeyas manga
js/level.js       geometría del nivel y escenario parallax
js/player.js      lógica del jugador
js/enemies.js     enemigos, proyectiles, objetos
js/bosses.js      Hatchan y Arlong
js/ui.js          HUD, diálogos y menús
js/post.js        posprocesado: gradación, viñeta, impacto, líneas de concentración
js/touch.js       controles táctiles
js/main.js        estados del juego, cámara, colisiones, bucle principal
tests/            banco de arte y bot de regresión
LOOP.md           registro del proceso iterativo (loop engineering)
```

## Pruebas

En `LOOP.md` se explica cómo ejecutar el bot que recorre el nivel completo (`/?bot` y luego `runBot('luffy')` en la consola) y el resto de opciones de depuración.
