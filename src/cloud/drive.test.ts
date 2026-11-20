import { describe, expect, it } from 'vitest';
import { downloadName, driveEnabled } from './drive';

describe('Google Drive helpers', () => {
  it('names Google Docs as Word files and keeps other names', () => {
    expect(downloadName({ id: '1', name: 'Letter', mimeType: 'application/vnd.google-apps.document', sizeBytes: 0 })).toBe('Letter.docx');
    expect(downloadName({ id: '2', name: 'memo.pdf', mimeType: 'application/pdf', sizeBytes: 10 })).toBe('memo.pdf');
  });

  it('is turned off in tests (no Google scripts are loaded)', () => {
    expect(driveEnabled).toBe(false);
  });
});
