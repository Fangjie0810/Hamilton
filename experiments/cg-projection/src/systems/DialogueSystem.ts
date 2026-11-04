/** A dialogue ends only after the player advances beyond the final line. */
export class DialogueCursor<Line> {
  private lines: readonly Line[];
  private position = 0;

  constructor(lines: readonly Line[] = []) {
    this.lines = [...lines];
  }

  get index(): number {
    return this.position;
  }

  get current(): Line | undefined {
    return this.lines[this.position];
  }

  get done(): boolean {
    return this.position >= this.lines.length;
  }

  next(): Line | undefined {
    if (!this.done) this.position += 1;
    return this.current;
  }

  reset(lines?: readonly Line[]): void {
    if (lines !== undefined) this.lines = [...lines];
    this.position = 0;
  }
}
