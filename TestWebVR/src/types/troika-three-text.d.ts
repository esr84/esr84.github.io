// Minimal typings for the parts of troika-three-text this project uses (the package ships none).
declare module 'troika-three-text' {
  import type { Color, Material, Mesh } from 'three';

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    fontWeight: number | 'normal' | 'bold';
    color: string | number | Color;
    maxWidth: number;
    lineHeight: number | 'normal';
    textAlign: 'left' | 'right' | 'center' | 'justify';
    anchorX: number | 'left' | 'center' | 'right' | string;
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | string;
    outlineWidth: number | string;
    outlineColor: string | number | Color;
    depthOffset: number;
    material: Material;
    readonly textRenderInfo: { blockBounds: [number, number, number, number] } | null;
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function preloadFont(
    options: { font?: string; characters?: string | string[] },
    callback: () => void,
  ): void;
}
