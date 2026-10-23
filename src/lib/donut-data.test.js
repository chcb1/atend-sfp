import { describe, expect, test } from "bun:test";
import { DONUT_COLORS, DONUT_OTHER_COLOR, donutPercentage, groupOutflowSlices } from "./donut-data";

describe("outflow chart presentation", () => {
  test("more than six slices retains five largest and groups the smallest", () => {
    const items = [10, 70, 20, 60, 30, 50, 40].map((value, i) => ({ name: `Category ${i}`, value, color: `color-${i}` }));
    const { slices, colors } = groupOutflowSlices(items);
    expect(slices).toHaveLength(6);
    expect(slices.at(-1)?.name).toBe("Outras");
    expect(slices.at(-1)?.value).toBe(30);
    expect(slices.reduce((sum, item) => sum + item.value, 0)).toBe(280);
    expect(slices.at(-1)?.color).toBe(DONUT_OTHER_COLOR);
    expect([...colors.values()]).not.toContain(DONUT_OTHER_COLOR);
    expect(new Set(slices.map((item) => item.color)).size).toBe(6);
    for (const item of slices.slice(0, 5)) expect(colors.get(item.name)).toBe(item.color);
  });
  test("six real slices receive six unique categorical colors, never gray", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({ name: `Procedure ${index}`, value: index + 1, color: "repeated" }));
    const { slices } = groupOutflowSlices(items);
    expect(slices.map((item) => item.color)).toEqual(DONUT_COLORS);
    expect(new Set(slices.map((item) => item.color)).size).toBe(6);
    expect(slices.map((item) => item.color)).not.toContain(DONUT_OTHER_COLOR);
  });
  test("six positive slices are not grouped and zero entries are omitted", () => {
    const items = [0, 1, 2, 3, 4, 5, 6].map((value) => ({ name: String(value), value, color: "color" }));
    expect(groupOutflowSlices(items).slices.map((item) => item.name)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
  test("percentages use the chart total and include the five percent threshold", () => {
    expect(donutPercentage(5, 100)).toBe(5);
    expect(donutPercentage(32, 100)).toBe(32);
    expect(donutPercentage(4, 100)).toBeLessThan(5);
    expect(donutPercentage(0, 0)).toBe(0);
  });
});