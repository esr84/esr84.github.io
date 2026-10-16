import { Matrix4, Raycaster, Vector2 } from 'three';
import type { XRContext } from '../xr/context';
import type { Controllers } from '../xr/controllers';
import type { FinalPanel } from './finalPanel';

/**
 * Lets the user press the final panel buttons: right controller ray + trigger in VR, or a
 * mouse click on desktop. Also highlights the button under the ray.
 */
export function attachPanelPointer(ctx: XRContext, controllers: Controllers, panel: FinalPanel) {
  const raycaster = new Raycaster();
  const rotation = new Matrix4();
  const mouse = new Vector2();

  const aimFromController = (): boolean => {
    const ray = controllers.right?.ray;
    if (!ray) return false;
    rotation.identity().extractRotation(ray.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(ray.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    return true;
  };

  ctx.onFrame(() => {
    if (!panel.visible || !ctx.renderer.xr.isPresenting) return;
    panel.setHovered(aimFromController() ? panel.pick(raycaster) : null);
  });

  for (const handle of controllers.all) {
    handle.ray.addEventListener('selectstart', () => {
      if (!panel.visible || handle !== controllers.right || !aimFromController()) return;
      panel.pick(raycaster)?.action();
    });
  }

  ctx.renderer.domElement.addEventListener('click', (event) => {
    if (!panel.visible || ctx.renderer.xr.isPresenting) return;
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, ctx.camera);
    panel.pick(raycaster)?.action();
  });
}
