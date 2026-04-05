/**
 * Rack Pointer Drag Listeners
 * Attaches document-level listeners for custom pointer-based drag events.
 * This is the Safari #397 workaround: RackDevice dispatches rackula:dragmove
 * and rackula:dragend instead of native DnD on pointer-event browsers.
 *
 * Extracted from Rack.svelte to reduce component size.
 */

import type { Rack, DeviceType, DeviceFace } from "$lib/types";
import type { ContainerHoverInfo } from "$lib/utils/dragdrop";
import {
  resolveDropTarget,
  resolveDropAction,
  type RackDimensions,
} from "$lib/utils/rack-drop-coordinator";
import {
  dispatchDropAction,
  type RackEventCallbacks,
} from "$lib/utils/rack-drop-handlers";
import type { DropPreviewState } from "$lib/utils/rack-interaction-handlers";
import type { getLayoutStore } from "$lib/stores/layout.svelte";
import type { getToastStore } from "$lib/stores/toast.svelte";

export interface PointerDragContext {
  getSvgElement: () => SVGSVGElement | null;
  getRack: () => Rack;
  getDeviceLibrary: () => DeviceType[];
  getRackDims: () => RackDimensions;
  getFaceFilter: () => DeviceFace | undefined;
  getSelectedDeviceId: () => string | null | undefined;
  getEventCallbacks: () => RackEventCallbacks;
  setDropPreview: (preview: DropPreviewState | null) => void;
  setContainerHoverInfo: (info: ContainerHoverInfo | null) => void;
  clearDraggingIndex: () => void;
  onDragFinished: () => void;
  layoutStore: ReturnType<typeof getLayoutStore>;
  toastStore: ReturnType<typeof getToastStore>;
}

/**
 * Create and attach pointer drag event listeners.
 * Returns a cleanup function that removes the listeners.
 */
export function attachPointerDragListeners(
  ctx: PointerDragContext,
): () => void {
  function handleDragMove(event: CustomEvent) {
    const svgElement = ctx.getSvgElement();
    if (!svgElement) return;
    const { clientX, clientY, device } = event.detail;
    const rack = ctx.getRack();
    const isInternalMove = event.detail.rackId === rack.id;
    const excludeIndex = isInternalMove ? event.detail.deviceIndex : undefined;

    const result = resolveDropTarget(
      { svgElement, clientX, clientY },
      ctx.getRackDims(),
      rack,
      ctx.getDeviceLibrary(),
      device,
      ctx.getFaceFilter(),
      excludeIndex,
    );

    ctx.setContainerHoverInfo(result.containerHoverInfo);
    ctx.setDropPreview(result.dropPreview);
  }

  function handleDragEnd(event: CustomEvent) {
    const svgElement = ctx.getSvgElement();
    if (!svgElement) return;
    const {
      clientX,
      clientY,
      device,
      rackId: sourceRackId,
      deviceIndex,
    } = event.detail;

    ctx.setDropPreview(null);
    ctx.setContainerHoverInfo(null);
    ctx.clearDraggingIndex();

    const rack = ctx.getRack();
    const deviceLibrary = ctx.getDeviceLibrary();
    const faceFilter = ctx.getFaceFilter();

    const coords = { svgElement, clientX, clientY };
    const dims = ctx.getRackDims();

    const action = resolveDropAction(
      coords,
      dims,
      rack,
      deviceLibrary,
      { type: "rack-device", device, sourceRackId, sourceIndex: deviceIndex },
      faceFilter,
      ctx.getSelectedDeviceId(),
    );

    dispatchDropAction(action, ctx.getEventCallbacks(), {
      rack,
      deviceLibrary,
      faceFilter,
      toastStore: ctx.toastStore,
      layoutStore: ctx.layoutStore,
      coords,
      dims,
    });

    ctx.onDragFinished();
  }

  document.addEventListener(
    "rackula:dragmove",
    handleDragMove as EventListener,
  );
  document.addEventListener("rackula:dragend", handleDragEnd as EventListener);

  return () => {
    document.removeEventListener(
      "rackula:dragmove",
      handleDragMove as EventListener,
    );
    document.removeEventListener(
      "rackula:dragend",
      handleDragEnd as EventListener,
    );
  };
}
