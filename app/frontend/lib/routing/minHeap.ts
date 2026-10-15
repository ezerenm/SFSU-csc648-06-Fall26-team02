// Small binary min-heap used by Dijkstra (lowest distance pops first).
// Ties pop in insertion order so routes are deterministic in tests.

type Entry<T> = { item: T; priority: number; order: number };

export class MinHeap<T> {
  private data: Entry<T>[] = [];
  private counter = 0;

  get size(): number {
    return this.data.length;
  }

  push(item: T, priority: number): void {
    this.data.push({ item, priority, order: this.counter++ });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): { item: T; priority: number } | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return { item: top.item, priority: top.priority };
  }

  private less(a: number, b: number): boolean {
    const x = this.data[a];
    const y = this.data[b];
    return x.priority < y.priority || (x.priority === y.priority && x.order < y.order);
  }

  private swap(a: number, b: number): void {
    [this.data[a], this.data[b]] = [this.data[b], this.data[a]];
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) return;
      this.swap(i, parent);
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.less(left, smallest)) smallest = left;
      if (right < n && this.less(right, smallest)) smallest = right;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }
}
