import { describe, expect, it } from "vitest";
import {
  deriveInternalMoveTargetU,
  isClientPointInsideSvg,
} from "$lib/utils/rack-pointer-drag";

describe("isClientPointInsideSvg", () => {
  const createSvgMock = () =>
    ({
      getBoundingClientRect: () => ({
        left: 100,
        top: 200,
        right: 300,
        bottom: 500,
      }),
    }) as unknown as SVGSVGElement;

  it("returns true for points inside bounds", () => {
    const svg = createSvgMock();
    expect(isClientPointInsideSvg(svg, 150, 250)).toBe(true);
  });

  it("returns false for points outside bounds", () => {
    const svg = createSvgMock();
    expect(isClientPointInsideSvg(svg, 99, 250)).toBe(false);
    expect(isClientPointInsideSvg(svg, 150, 199)).toBe(false);
    expect(isClientPointInsideSvg(svg, 300, 250)).toBe(false);
    expect(isClientPointInsideSvg(svg, 150, 500)).toBe(false);
  });
});

describe("deriveInternalMoveTargetU", () => {
  it("keeps source U when there is no vertical movement", () => {
    expect(deriveInternalMoveTargetU(6, 250, 250, 22, 1, 42)).toBe(6);
  });

  it("moves by one U after one full U downward drag", () => {
    // Dragging downward increases clientY and decreases U position.
    expect(deriveInternalMoveTargetU(6, 272, 250, 22, 1, 42)).toBe(5);
  });

  it("supports half-U increments for 0.5U devices", () => {
    // stepPx = 22 * 0.5 = 11 -> one step down
    expect(deriveInternalMoveTargetU(6, 261, 250, 22, 0.5, 42)).toBe(5.5);
  });
});
