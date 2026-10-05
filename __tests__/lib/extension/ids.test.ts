import {
  allowedExtensionIds,
  isAllowedExtensionId,
  isAllowedExtensionOrigin,
} from '@/lib/extension/ids';

const ORIGINAL = process.env['NEXT_PUBLIC_EXTENSION_IDS'];
afterEach(() => {
  process.env['NEXT_PUBLIC_EXTENSION_IDS'] = ORIGINAL;
});

describe('extension ids', () => {
  it('parses a comma list, trimming blanks', () => {
    process.env['NEXT_PUBLIC_EXTENSION_IDS'] =
      ' abcdefghijklmnopabcdefghijklmnop , ,ponmlkjihgfedcbaponmlkjihgfedcba';
    expect(allowedExtensionIds()).toEqual([
      'abcdefghijklmnopabcdefghijklmnop',
      'ponmlkjihgfedcbaponmlkjihgfedcba',
    ]);
  });
  it('allows nothing when unset', () => {
    delete process.env['NEXT_PUBLIC_EXTENSION_IDS'];
    expect(isAllowedExtensionId('abcdefghijklmnopabcdefghijklmnop')).toBe(false);
  });
  it('matches ids and chrome-extension origins exactly', () => {
    process.env['NEXT_PUBLIC_EXTENSION_IDS'] = 'abcdefghijklmnopabcdefghijklmnop';
    expect(isAllowedExtensionId('abcdefghijklmnopabcdefghijklmnop')).toBe(true);
    expect(isAllowedExtensionId(null)).toBe(false);
    expect(isAllowedExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnop')).toBe(
      true
    );
    expect(isAllowedExtensionOrigin('https://evil.example')).toBe(false);
    expect(isAllowedExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnopX')).toBe(
      false
    );
    expect(isAllowedExtensionOrigin(null)).toBe(false);
  });
  it('"*" allows any well-formed extension id, but nothing malformed', () => {
    process.env['NEXT_PUBLIC_EXTENSION_IDS'] = '*';
    expect(isAllowedExtensionId('coclcgbalhmalehigbkflhaocjieklfe')).toBe(true);
    expect(isAllowedExtensionId('ponmlkjihgfedcbaponmlkjihgfedcba')).toBe(true);
    expect(isAllowedExtensionId('bogus')).toBe(false);
    expect(isAllowedExtensionId('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false); // ids use a-p only
    expect(isAllowedExtensionId('*')).toBe(false);
    expect(isAllowedExtensionId(null)).toBe(false);
    expect(isAllowedExtensionOrigin('chrome-extension://coclcgbalhmalehigbkflhaocjieklfe')).toBe(
      true
    );
    expect(isAllowedExtensionOrigin('https://evil.example')).toBe(false);
  });
});
