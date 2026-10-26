/**
 * Uniform spatial grid rebuilt every tick with a counting sort (no allocations after construction).
 * Answers "which entities are near this point?" without checking every entity.
 */
export class SpatialGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;

  /** cellStart[c] .. cellStart[c + 1] is the range of `items` belonging to cell c. */
  private readonly cellStart: Int32Array;
  private readonly cursor: Int32Array;
  private readonly items: Int32Array;
  private readonly cellOf: Int32Array;

  constructor(width: number, height: number, cellSize: number, capacity: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    const cells = this.cols * this.rows;
    this.cellStart = new Int32Array(cells + 1);
    this.cursor = new Int32Array(cells);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  build(xs: Float64Array, ys: Float64Array, count: number): void {
    const { cellStart, cursor, items, cellOf } = this;
    cellStart.fill(0);
    for (let i = 0; i < count; i++) {
      const c = this.cellIndex(xs[i]!, ys[i]!);
      cellOf[i] = c;
      cellStart[c + 1]!++;
    }
    for (let c = 0; c < cursor.length; c++) {
      cellStart[c + 1]! += cellStart[c]!;
      cursor[c] = cellStart[c]!;
    }
    for (let i = 0; i < count; i++) {
      items[cursor[cellOf[i]!]!++] = i;
    }
  }

  /**
   * Writes the indices of entities in cells overlapping the square around (x, y) into `out`
   * and returns how many were written. Callers still do their own exact distance checks.
   */
  query(x: number, y: number, range: number, out: Int32Array): number {
    const cs = this.cellSize;
    const cx0 = clampInt(Math.floor((x - range) / cs), 0, this.cols - 1);
    const cx1 = clampInt(Math.floor((x + range) / cs), 0, this.cols - 1);
    const cy0 = clampInt(Math.floor((y - range) / cs), 0, this.rows - 1);
    const cy1 = clampInt(Math.floor((y + range) / cs), 0, this.rows - 1);
    let n = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * this.cols + cx;
        const end = this.cellStart[c + 1]!;
        for (let k = this.cellStart[c]!; k < end; k++) {
          if (n >= out.length) return n;
          out[n++] = this.items[k]!;
        }
      }
    }
    return n;
  }

  private cellIndex(x: number, y: number): number {
    const cx = clampInt(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const cy = clampInt(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return cy * this.cols + cx;
  }
}

function clampInt(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
