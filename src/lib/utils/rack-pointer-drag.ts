/**
 * Rack Pointer Drag Listeners
 * Attaches document-level listeners for custom pointer-based drag events.
 * This is the Safari #397 workaround: RackDevice dispatches rackula:dragmove
 * and rackula:dragend instead of native DnD on pointer-event browsers.
 *
 * Extracted from Rack.svelte to reduce component size.
 */

import type { Rack, DeviceType, DeviceFace } from "$lib/types";
import { getDropFeedback, type ContainerHoverInfo } from "$lib/utils/dragdrop";
import { toHumanUnits } from "$lib/utils/position";
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
 * Derive target U for internal pointer-move from real pointer delta since drag start.
 * This guarantees no movement when deltaY is 0, preventing immediate line jumps on pickup.
 */
export function deriveInternalMoveTargetU(
  sourceU: number,
  currentClientY: number,
  startClientY: number,
  uHeight: number,
  snapIncrementU: number,
  rackHeight: number,
): number {
  const stepPx = uHeight * snapIncrementU;
  const deltaSteps = Math.round((currentClientY - startClientY) / stepPx);
  const deltaU = deltaSteps * snapIncrementU;
  const targetU = sourceU - deltaU;
  return Math.max(1, Math.min(rackHeight, targetU));
}

/**
 * Returns true when a client point is inside an SVG element's viewport bounds.
 */
export function isClientPointInsideSvg(
  svgElement: SVGSVGElement,
  clientX: number,
  clientY: number,
): boolean {
  const rect = svgElement.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX < rect.right &&
    clientY >= rect.top &&
    clientY < rect.bottom
  );
}

/**
 * Create and attach pointer drag event listeners.
 * Returns a cleanup function that removes the listeners.
 */
export function attachPointerDragListeners(
  ctx: PointerDragContext,
): () => void {
  let activeInternalDrag: {
    sourceRackId: string;
    sourceIndex: number;
    sourceU: number;
    startClientY: number;
    snapIncrementU: number;
  } | null = null;

  function getSourcePositionU(
    sourceRackId: string | undefined,
    sourceIndex: number | undefined,
  ): number | undefined {
    if (!sourceRackId || sourceIndex === undefined) return undefined;
    const sourceRack = ctx.layoutStore.getRackById(sourceRackId);
    const sourceDevice = sourceRack?.devices[sourceIndex];
    if (!sourceDevice) return undefined;
    return toHumanUnits(sourceDevice.position);
  }

  function handleDragMove(event: CustomEvent) {
    const svgElement = ctx.getSvgElement();
    if (!svgElement) return;
    const { clientX, clientY, device } = event.detail;

    if (!isClientPointInsideSvg(svgElement, clientX, clientY)) {
      // Mirror native DnD behavior: only the hovered rack shows preview state.
      ctx.setContainerHoverInfo(null);
      ctx.setDropPreview(null);
      return;
    }

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

    if (isInternalMove && event.detail.deviceIndex !== undefined) {
      const sourceU = getSourcePositionU(
        event.detail.rackId,
        event.detail.deviceIndex,
      );
      if (sourceU !== undefined) {
        const snapIncrementU = device.u_height < 1 ? 0.5 : 1;
        if (
          !activeInternalDrag ||
          activeInternalDrag.sourceRackId !== event.detail.rackId ||
          activeInternalDrag.sourceIndex !== event.detail.deviceIndex
        ) {
          activeInternalDrag = {
            sourceRackId: event.detail.rackId,
            sourceIndex: event.detail.deviceIndex,
            sourceU,
            startClientY: clientY,
            snapIncrementU,
          };
        }

        const targetU = deriveInternalMoveTargetU(
          activeInternalDrag.sourceU,
          clientY,
          activeInternalDrag.startClientY,
          ctx.getRackDims().uHeight,
          activeInternalDrag.snapIncrementU,
          rack.height,
        );
        const feedback = getDropFeedback(
          rack,
          ctx.getDeviceLibrary(),
          device.u_height,
          targetU,
          excludeIndex,
          ctx.getFaceFilter(),
          result.slotPosition,
        );

        ctx.setContainerHoverInfo(result.containerHoverInfo);
        ctx.setDropPreview({
          ...result.dropPreview,
          position: targetU,
          feedback,
        });
        return;
      }
    }

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

    if (!isClientPointInsideSvg(svgElement, clientX, clientY)) {
      activeInternalDrag = null;
      return;
    }

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

    const isInternalMove =
      sourceRackId === rack.id && deviceIndex !== undefined;
    if (isInternalMove) {
      const sourceU = getSourcePositionU(sourceRackId, deviceIndex);
      if (sourceU !== undefined && "targetU" in action) {
        const snapIncrementU = device.u_height < 1 ? 0.5 : 1;
        const startClientY =
          activeInternalDrag &&
          activeInternalDrag.sourceRackId === sourceRackId &&
          activeInternalDrag.sourceIndex === deviceIndex
            ? activeInternalDrag.startClientY
            : clientY;

        const targetU = deriveInternalMoveTargetU(
          sourceU,
          clientY,
          startClientY,
          dims.uHeight,
          snapIncrementU,
          rack.height,
        );

        if (action.kind === "internal-move") {
          action.targetU = targetU;
        } else if (action.kind === "invalid") {
          const snappedFeedback = getDropFeedback(
            rack,
            deviceLibrary,
            device.u_height,
            targetU,
            deviceIndex,
            faceFilter,
            action.slotPosition,
          );

          if (snappedFeedback === "valid") {
            dispatchDropAction(
              {
                kind: "internal-move",
                rackId: rack.id,
                deviceIndex,
                targetU,
                slotPosition: action.slotPosition,
              },
              ctx.getEventCallbacks(),
              {
                rack,
                deviceLibrary,
                faceFilter,
                toastStore: ctx.toastStore,
                layoutStore: ctx.layoutStore,
                coords,
                dims,
              },
            );
            ctx.onDragFinished();
            activeInternalDrag = null;
            return;
          }
        }
      }
    }

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
    activeInternalDrag = null;
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
