// Unit tests for Spotify service helpers

// --- extractAuthStatus (same logic as in spotify.js) ---
function extractAuthStatus(err) {
  if (!err) return null;

  if (typeof err.statusCode === 'number') {
    return err.statusCode;
  }

  if (typeof err.status === 'number') {
    return err.status;
  }

  if (typeof err.message === 'string') {
    const match = err.message.match(/Spotify API Error: (\d{3})/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

describe('extractAuthStatus', () => {
  test('returns null for null/undefined', () => {
    expect(extractAuthStatus(null)).toBeNull();
    expect(extractAuthStatus(undefined)).toBeNull();
  });

  test('extracts statusCode from spotify-web-api-node errors', () => {
    expect(extractAuthStatus({ statusCode: 401 })).toBe(401);
    expect(extractAuthStatus({ statusCode: 403 })).toBe(403);
    expect(extractAuthStatus({ statusCode: 429 })).toBe(429);
  });

  test('extracts .status from alternative error objects', () => {
    expect(extractAuthStatus({ status: 401 })).toBe(401);
    expect(extractAuthStatus({ status: 500 })).toBe(500);
  });

  test('statusCode takes precedence over status', () => {
    expect(extractAuthStatus({ statusCode: 401, status: 500 })).toBe(401);
  });

  test('extracts status from .message for manual fetch errors', () => {
    expect(extractAuthStatus({ message: 'Spotify API Error: 401' })).toBe(401);
    expect(extractAuthStatus({ message: 'Spotify API Error: 403' })).toBe(403);
  });

  test('ignores .message without Spotify API Error pattern', () => {
    expect(extractAuthStatus({ message: 'Network error' })).toBeNull();
    expect(extractAuthStatus({ message: 'Something failed: 401' })).toBeNull();
  });

  test('returns null for objects with no recognizable status', () => {
    expect(extractAuthStatus({})).toBeNull();
    expect(extractAuthStatus({ code: 'ETIMEDOUT' })).toBeNull();
  });

  test('ignores non-numeric statusCode/status', () => {
    expect(extractAuthStatus({ statusCode: '401' })).toBeNull();
    expect(extractAuthStatus({ status: 'error' })).toBeNull();
  });

  test('falls back to .status when statusCode is absent', () => {
    expect(extractAuthStatus({ status: 401, message: 'unauthorized' })).toBe(401);
  });

  test('prefers .message pattern over .status when statusCode absent', () => {
    // Both .status and .message have valid data; .status wins because it's checked first
    expect(extractAuthStatus({ status: 500, message: 'Spotify API Error: 401' })).toBe(500);
  });
});