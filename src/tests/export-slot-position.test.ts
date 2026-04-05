import { describe, it, expect } from "vitest";
import { generateExportSVG } from "$lib/utils/export";
import {
  createTestRack,
  createTestDeviceType,
  createTestDevice,
} from "./factories";

describe("generateExportSVG half-width slot placement", () => {
  it("renders half-width devices side-by-side for a shared U", () => {
    const rack = createTestRack({
      id: "rack-1",
      width: 19,
      devices: [
        createTestDevice({
          id: "left-device",
          device_type: "half-left",
          position: 10,
          face: "front",
          slot_position: "left",
          colour_override: "#ff0000",
        }),
        createTestDevice({
          id: "right-device",
          device_type: "half-right",
          position: 10,
          face: "front",
          slot_position: "right",
          colour_override: "#00ff00",
        }),
      ],
    });

    const deviceLibrary = [
      createTestDeviceType({
        slug: "half-left",
        model: "Half Left",
        slot_width: 1,
        category: "server",
      }),
      createTestDeviceType({
        slug: "half-right",
        model: "Half Right",
        slot_width: 1,
        category: "server",
      }),
    ];

    const svg = generateExportSVG([rack], deviceLibrary, {
      format: "png",
      scope: "all",
      includeNames: false,
      includeLegend: false,
      background: "dark",
      exportView: "front",
      displayMode: "label",
    });

    const leftRect = svg.querySelector('rect[fill="#ff0000"]');
    const rightRect = svg.querySelector('rect[fill="#00ff00"]');

    expect(leftRect).toBeTruthy();
    expect(rightRect).toBeTruthy();

    const leftX = Number(leftRect?.getAttribute("x"));
    const rightX = Number(rightRect?.getAttribute("x"));
    const leftWidth = Number(leftRect?.getAttribute("width"));
    const rightWidth = Number(rightRect?.getAttribute("width"));

    expect(leftWidth).toBe(rightWidth);
    expect(rightX).toBeGreaterThan(leftX);
    expect(rightX).toBeGreaterThanOrEqual(leftX + leftWidth);
  });
});
