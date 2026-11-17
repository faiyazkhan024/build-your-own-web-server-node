// Range specification:
// [start, end] (inclusive) or [start, null] (open-ended), or negative number for suffix
export type HTTPRange = [number, number | null] | number;

// Parse "Range: bytes=..." header value into HTTPRange[]
export function parseBytesRanges(r: null | Buffer): HTTPRange[] {
  if (!r) return [];
  const str = r.toString("latin1").trim();
  if (!str.startsWith("bytes=")) {
    return [];
  }
  const spec = str.substring("bytes=".length).trim();
  const parts = spec.split(",");
  const ranges: HTTPRange[] = [];

  for (const part of parts) {
    const item = part.trim();
    if (!item) return [];

    if (item.startsWith("-")) {
      // suffix-range: "-suffix-length"
      const suffixLenStr = item.substring(1);
      if (!/^\d+$/.test(suffixLenStr)) return [];
      const suffixLen = parseInt(suffixLenStr, 10);
      if (suffixLen === 0) return []; // "-0" is invalid per RFC
      ranges.push(-suffixLen);
    } else {
      // int-range: "first-pos-[last-pos]"
      const dashIdx = item.indexOf("-");
      if (dashIdx < 0) return [];
      const firstStr = item.substring(0, dashIdx);
      if (!/^\d+$/.test(firstStr)) return [];
      const first = parseInt(firstStr, 10);

      const lastStr = item.substring(dashIdx + 1);
      if (lastStr.length === 0) {
        // open-ended range: "10-"
        ranges.push([first, null]);
      } else {
        if (!/^\d+$/.test(lastStr)) return [];
        const last = parseInt(lastStr, 10);
        if (last < first) return []; // "4-3" is invalid
        ranges.push([first, last]);
      }
    }
  }

  return ranges;
}

// Compute the effective range [start, end) (end exclusive) for a given file size.
// Returns null if the range is unsatisfiable (out of bounds).
export function computeEffectiveRange(
  range: HTTPRange,
  fileSize: number
): [number, number] | null {
  if (fileSize <= 0) {
    return null; // Empty file cannot satisfy any byte range
  }

  if (typeof range === "number") {
    // Suffix range: -N means last N bytes
    const suffixLen = Math.abs(range);
    const start = Math.max(0, fileSize - suffixLen);
    return [start, fileSize];
  }

  const [first, last] = range;
  if (first >= fileSize) {
    return null; // Range Not Satisfiable
  }

  const start = first;
  let end: number;
  if (last === null) {
    end = fileSize;
  } else {
    // inclusive last-pos -> exclusive end
    end = Math.min(fileSize, last + 1);
  }

  if (start >= end) {
    return null;
  }

  return [start, end];
}
