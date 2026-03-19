import { diffLines } from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  // Normalize inputs to ensure proper line-by-line diffing
  const normalizedOld = oldText.length > 0 && !oldText.endsWith('\n') ? oldText + '\n' : oldText;
  const normalizedNew = newText.length > 0 && !newText.endsWith('\n') ? newText + '\n' : newText;

  const changes = diffLines(normalizedOld, normalizedNew);
  const lines: DiffLine[] = [];

  for (const change of changes) {
    const changeLines = change.value.replace(/\n$/, '').split('\n');
    const type: DiffLine['type'] = change.added
      ? 'added'
      : change.removed
        ? 'removed'
        : 'unchanged';

    for (const line of changeLines) {
      lines.push({ type, value: line });
    }
  }

  return lines;
}
