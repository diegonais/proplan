import { describe, expect, it } from 'vitest';

import { parseContentDispositionFileName } from './reportsApi';

describe('reports export downloads', () => {
  it('reads quoted filenames from Content-Disposition', () => {
    expect(
      parseContentDispositionFileName(
        'attachment; filename="proplan-proyecto-12345678-20260724-1200.pdf"',
      ),
    ).toBe('proplan-proyecto-12345678-20260724-1200.pdf');
  });

  it('reads encoded filenames from Content-Disposition', () => {
    expect(
      parseContentDispositionFileName("attachment; filename*=UTF-8''proplan-reporte.xlsx"),
    ).toBe('proplan-reporte.xlsx');
  });

  it('returns null when the filename is absent', () => {
    expect(parseContentDispositionFileName(undefined)).toBeNull();
  });
});
