import { describe, expect, it } from 'vitest';
import { asset } from '../src/util/paths';

describe('asset', () => {
  it('prefixes the root base', () => {
    expect(asset('models/a.onnx', '/')).toBe('/models/a.onnx');
  });

  it('prefixes a GitHub Pages sub-path', () => {
    expect(asset('models/a.onnx', '/TestWebVR/')).toBe('/TestWebVR/models/a.onnx');
  });

  it('tolerates a base without trailing slash and a leading slash in the path', () => {
    expect(asset('/models/a.onnx', '/TestWebVR')).toBe('/TestWebVR/models/a.onnx');
  });

  it('uses the Vite base URL by default', () => {
    expect(asset('x.glb')).toBe(`${import.meta.env.BASE_URL}x.glb`);
  });
});
