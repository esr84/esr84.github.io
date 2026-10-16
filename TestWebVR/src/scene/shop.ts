import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Layout of the shop, shared with the code that places the avatar and the subtitles. */
export const SHOP_LAYOUT = {
  /** Counter between the user and the customer. */
  counter: { z: -1.2, depth: 0.5, width: 2.2, height: 0.95 },
  /** The customer stands with its front at this z (behind the counter). */
  avatarFrontZ: -1.5,
  /** Subtitle panel, floating just above the front edge of the counter. */
  subtitles: { y: 1.17, z: -0.97 },
  room: { width: 8, depth: 9, height: 3, backZ: -4.5 },
} as const;

const tmpColor = new Color();

/** A box with a flat vertex colour, translated into place (merged later). */
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d).toNonIndexed();
  geometry.translate(x, y, z);
  return paint(geometry, color);
}

function plane(
  w: number,
  h: number,
  rotate: (g: PlaneGeometry) => void,
  x: number,
  y: number,
  z: number,
  color: number,
): BufferGeometry {
  const geometry = new PlaneGeometry(w, h);
  rotate(geometry);
  geometry.translate(x, y, z);
  return paint(geometry.toNonIndexed(), color);
}

function paint(geometry: BufferGeometry, color: number): BufferGeometry {
  tmpColor.setHex(color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  // Keep only what the Lambert material needs, so every piece merges.
  for (const name of Object.keys(geometry.attributes)) {
    if (!['position', 'normal', 'color'].includes(name)) geometry.deleteAttribute(name);
  }
  return geometry;
}

/** Shelf unit with products, centred at x. */
function shelf(x: number, z: number, palette: readonly number[]): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const width = 1.6;
  parts.push(box(width, 2.0, 0.05, x, 1.0, z - 0.2, 0x8a6e52)); // back panel
  for (const side of [-1, 1])
    parts.push(box(0.05, 2.0, 0.4, x + (side * width) / 2, 1.0, z, 0x7a5f45));
  for (let level = 0; level < 4; level++) {
    const y = 0.25 + level * 0.5;
    parts.push(box(width, 0.04, 0.4, x, y, z, 0x9c7c5c));
    // Products: deterministic sizes/colours (no randomness → identical on every run).
    let cursor = x - width / 2 + 0.12;
    for (let i = 0; cursor < x + width / 2 - 0.15; i++) {
      const w = 0.14 + ((i * 7 + level * 3) % 5) * 0.03;
      const h = 0.18 + ((i * 5 + level) % 4) * 0.05;
      parts.push(
        box(
          w,
          h,
          0.25,
          cursor + w / 2,
          y + 0.02 + h / 2,
          z,
          palette[(i + level) % palette.length] ?? 0xcccccc,
        ),
      );
      cursor += w + 0.05;
    }
  }
  return parts;
}

/**
 * Low-cost shop: every static piece is merged into one mesh with vertex colours and a Lambert
 * material, so the whole room is a single draw call and costs almost nothing on a Quest 2.
 */
export function createShop(scene: Scene): Mesh {
  const { counter, room } = SHOP_LAYOUT;
  const parts: BufferGeometry[] = [];

  // Room shell.
  parts.push(
    plane(
      room.width,
      room.depth,
      (g) => g.rotateX(-Math.PI / 2),
      0,
      0,
      room.backZ + room.depth / 2,
      0x6b6f75,
    ),
  );
  parts.push(
    plane(room.width, room.height, () => undefined, 0, room.height / 2, room.backZ, 0xd8d2c4),
  );
  parts.push(
    plane(
      room.depth,
      room.height,
      (g) => g.rotateY(Math.PI / 2),
      -room.width / 2,
      room.height / 2,
      room.backZ + room.depth / 2,
      0xcfc8b8,
    ),
  );
  parts.push(
    plane(
      room.depth,
      room.height,
      (g) => g.rotateY(-Math.PI / 2),
      room.width / 2,
      room.height / 2,
      room.backZ + room.depth / 2,
      0xcfc8b8,
    ),
  );
  parts.push(
    plane(
      room.width,
      room.depth,
      (g) => g.rotateX(Math.PI / 2),
      0,
      room.height,
      room.backZ + room.depth / 2,
      0xeeeeea,
    ),
  );
  // Floor tiles stripe to give a sense of depth.
  for (let i = 0; i < 9; i++) {
    parts.push(
      plane(
        room.width,
        0.05,
        (g) => g.rotateX(-Math.PI / 2),
        0,
        0.002,
        room.backZ + 0.5 + i,
        0x5d6167,
      ),
    );
  }

  // Counter: body, top and a front strip with the shop colour.
  parts.push(
    box(
      counter.width,
      counter.height - 0.04,
      counter.depth,
      0,
      (counter.height - 0.04) / 2,
      counter.z,
      0x3f5a73,
    ),
  );
  parts.push(
    box(
      counter.width + 0.06,
      0.04,
      counter.depth + 0.06,
      0,
      counter.height - 0.02,
      counter.z,
      0xe9e4da,
    ),
  );
  parts.push(
    box(
      counter.width + 0.002,
      0.08,
      0.01,
      0,
      counter.height - 0.18,
      counter.z + counter.depth / 2 + 0.001,
      0xf2a93b,
    ),
  );

  // The broken toaster (the reason of the complaint) and a cash register on the counter.
  const top = counter.height;
  parts.push(box(0.28, 0.18, 0.16, -0.55, top + 0.09, counter.z - 0.05, 0xc0392b));
  parts.push(box(0.1, 0.01, 0.12, -0.6, top + 0.185, counter.z - 0.05, 0x222222));
  parts.push(box(0.1, 0.01, 0.12, -0.49, top + 0.185, counter.z - 0.05, 0x222222));
  parts.push(box(0.32, 0.12, 0.28, 0.65, top + 0.06, counter.z - 0.05, 0x2c2c2c));
  parts.push(box(0.26, 0.16, 0.02, 0.65, top + 0.2, counter.z - 0.12, 0x1d2b36));

  // Shelves behind the customer and along the side walls.
  const palette = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0xe67e22];
  parts.push(...shelf(-1.9, room.backZ + 0.3, palette));
  parts.push(...shelf(1.9, room.backZ + 0.3, palette));

  const geometry = mergeGeometries(parts, false);
  if (!geometry) throw new Error('Could not merge the shop geometry');
  for (const part of parts) part.dispose();
  geometry.computeBoundingSphere();

  const mesh = new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'shop';
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
  return mesh;
}
