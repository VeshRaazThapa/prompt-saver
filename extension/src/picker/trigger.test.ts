import { describe, it, expect } from 'vitest';
import { detectTrigger } from './trigger';

describe('detectTrigger', () => {
  it.each([
    ['//', { query: '', length: 2 }],
    ['hello //em', { query: 'em', length: 4 }],
    ['line\n//code', { query: 'code', length: 6 }],
  ])('triggers for %j', (input, expected) => expect(detectTrigger(input)).toEqual(expected));

  it.each(['https://', 'see https://exa', 'foo//bar', 'a / /b', '// two words', '///'])('does not trigger for %j', (input) =>
    expect(detectTrigger(input)).toBeNull()
  );
});
