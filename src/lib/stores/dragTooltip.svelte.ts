/**
 * Drag Tooltip Store
 *
 * Global state for managing the drag tooltip that shows device name
 * and U-height during drag operations. The tooltip follows the cursor
 * and provides immediate context during device placement.
 *
 * Issue #306: feat: drag tooltip showing device name and U-height
 */

import type { DeviceType } from "$lib/types";

const DRAG_SELECTION_LOCK_CLASS = "rackula-drag-selection-lock";

/** Drag tooltip state */
export interface DragTooltipState {
  /** Device being dragged */
  device: DeviceType | null;
  /** X position (clientX from mouse event) */
  x: number;
  /** Y position (clientY from mouse event) */
  y: number;
  /** Whether tooltip is visible */
  visible: boolean;
  /** Device category color for accent */
  categoryColor: string;
  /** Device U-height for sizing */
  uHeight: number;
}

/** Tooltip cursor offset (--space-4) */
const TOOLTIP_OFFSET_X = 16;
/** Tooltip cursor offset (--space-2 negative) */
const TOOLTIP_OFFSET_Y = -8;

/** Drag tooltip store singleton */
let tooltipState = $state<DragTooltipState>({
  device: null,
  x: 0,
  y: 0,
  visible: false,
  categoryColor: "",
  uHeight: 1,
});

let selectionLockCount = 0;

function lockDocumentSelection(): void {
  if (typeof document === "undefined") return;
  selectionLockCount += 1;
  if (selectionLockCount > 1) return;

  document.documentElement.classList.add(DRAG_SELECTION_LOCK_CLASS);
  document.body.classList.add(DRAG_SELECTION_LOCK_CLASS);
}

function unlockDocumentSelection(): void {
  if (typeof document === "undefined") return;
  selectionLockCount = Math.max(0, selectionLockCount - 1);
  if (selectionLockCount !== 0) return;

  document.documentElement.classList.remove(DRAG_SELECTION_LOCK_CLASS);
  document.body.classList.remove(DRAG_SELECTION_LOCK_CLASS);
}

function forceUnlockDocumentSelection(): void {
  if (typeof document === "undefined") return;
  selectionLockCount = 0;
  document.documentElement.classList.remove(DRAG_SELECTION_LOCK_CLASS);
  document.body.classList.remove(DRAG_SELECTION_LOCK_CLASS);
}

if (typeof window !== "undefined") {
  // Failsafe: some browsers can miss dragend/pointercancel, so always clear lock.
  const releaseSelectionLock = () => {
    if (selectionLockCount > 0) {
      forceUnlockDocumentSelection();
    }
  };

  window.addEventListener("blur", releaseSelectionLock, { capture: true });
  window.addEventListener("dragend", releaseSelectionLock, { capture: true });
  window.addEventListener("drop", releaseSelectionLock, { capture: true });
  window.addEventListener("pointerup", releaseSelectionLock, { capture: true });
  window.addEventListener("pointercancel", releaseSelectionLock, {
    capture: true,
  });
  window.addEventListener("mouseup", releaseSelectionLock, { capture: true });
  window.addEventListener("touchend", releaseSelectionLock, { capture: true });
  window.addEventListener("touchcancel", releaseSelectionLock, {
    capture: true,
  });
}

/**
 * Show the drag tooltip at the specified cursor position
 * @param device - The device being dragged
 * @param clientX - Mouse clientX coordinate
 * @param clientY - Mouse clientY coordinate
 */
/** Maximum U-height for rack devices (standard 42U rack) */
const MAX_U_HEIGHT = 42;

/**
 * Check if a color value is valid (non-empty string)
 */
function isValidColor(color: string | undefined | null): color is string {
  return typeof color === "string" && color.trim() !== "";
}

export function showDragTooltip(
  device: DeviceType,
  clientX: number,
  clientY: number,
): void {
  if (!tooltipState.visible) {
    lockDocumentSelection();
  }

  // Clamp uHeight to valid range (1-42U)
  const clampedUHeight = Math.max(1, Math.min(device.u_height, MAX_U_HEIGHT));

  // Use device colour only if it's a valid non-empty string
  const categoryColor = isValidColor(device.colour)
    ? device.colour
    : "var(--colour-primary)";

  tooltipState = {
    device,
    x: clientX + TOOLTIP_OFFSET_X,
    y: clientY + TOOLTIP_OFFSET_Y,
    visible: true,
    categoryColor,
    uHeight: clampedUHeight,
  };
}

/**
 * Update the drag tooltip position (called on mouse move during drag)
 * @param clientX - Mouse clientX coordinate
 * @param clientY - Mouse clientY coordinate
 */
export function updateDragTooltipPosition(
  clientX: number,
  clientY: number,
): void {
  if (tooltipState.visible) {
    tooltipState = {
      ...tooltipState,
      x: clientX + TOOLTIP_OFFSET_X,
      y: clientY + TOOLTIP_OFFSET_Y,
    };
  }
}

/**
 * Hide the drag tooltip
 */
export function hideDragTooltip(): void {
  if (tooltipState.visible) {
    unlockDocumentSelection();
  }

  tooltipState = {
    device: null,
    x: 0,
    y: 0,
    visible: false,
    categoryColor: "",
    uHeight: 1,
  };
}

/**
 * Get the current tooltip state (reactive)
 */
export function getDragTooltipState(): DragTooltipState {
  return tooltipState;
}
