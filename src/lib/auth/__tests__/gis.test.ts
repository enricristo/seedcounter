import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GisClient, parseJwtPayload } from '../gis-client';
import type { BenchPreferences } from '../gis-client';

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createMockJwt(payload: Record<string, any>): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.mockSignature`;
}

describe('Google Identity Services (GIS) Auth Client', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();

    // Mock localStorage in Node test environment
    const fakeLocalStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };
    vi.stubGlobal('localStorage', fakeLocalStorage);
  });

  describe('parseJwtPayload', () => {
    it('accurately parses standard JWT payload claims', () => {
      const token = createMockJwt({
        sub: '10987654321',
        email: 'analyst@seedcounter.org',
        name: 'Nelson Botanist',
        given_name: 'Nelson',
        picture: 'https://seedcounter.org/avatar.jpg',
      });

      const parsed = parseJwtPayload(token);
      expect(parsed).toBeDefined();
      expect(parsed?.sub).toBe('10987654321');
      expect(parsed?.email).toBe('analyst@seedcounter.org');
      expect(parsed?.name).toBe('Nelson Botanist');
    });

    it('returns null on invalid or corrupted tokens without throwing', () => {
      expect(parseJwtPayload('')).toBeNull();
      expect(parseJwtPayload('invalid_token_format')).toBeNull();
      expect(parseJwtPayload('header.invalid-base64-json.sig')).toBeNull();
    });
  });

  describe('Anonymous Zero-Barrier Default', () => {
    it('defaults to anonymous offline operation with zero credentials', () => {
      const client = new GisClient();
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getToken()).toBeNull();
      expect(client.getState()).toEqual({
        isAuthenticated: false,
        user: null,
        token: null,
        preferences: null,
      });
    });

    it('loadGisScript gracefully returns false without errors in non-browser environment', async () => {
      const client = new GisClient();
      const loaded = await client.loadGisScript();
      expect(loaded).toBe(false);
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('Authentication Lifecycle', () => {
    it('signs in with valid Google JWT and updates state and localStorage', async () => {
      const client = new GisClient();
      const token = createMockJwt({
        sub: 'usr_456',
        email: 'dr_nelson@ufla.br',
        name: 'Dr. Nelson',
        given_name: 'Nelson',
      });

      let notifiedState = null;
      client.onAuthStateChanged((state) => {
        notifiedState = state;
      });

      const success = await client.signInWithToken(token);
      expect(success).toBe(true);
      expect(client.isAuthenticated()).toBe(true);
      expect(client.getToken()).toBe(token);

      const user = client.getState().user;
      expect(user?.id).toBe('usr_456');
      expect(user?.email).toBe('dr_nelson@ufla.br');
      expect(user?.name).toBe('Dr. Nelson');

      expect(mockStorage['sc:auth_token']).toBe(token);
      expect(mockStorage['sc:auth_user']).toContain('dr_nelson@ufla.br');
      expect(notifiedState).toEqual(client.getState());
    });

    it('signs in with valid Google JWT and populates user profile', async () => {
      const client = new GisClient();
      const token = createMockJwt({
        sub: 'user_technician_01',
        email: 'technician_01@example.com',
        name: 'Technician 01',
      });
      const success = await client.signInWithToken(token);
      expect(success).toBe(true);
      expect(client.isAuthenticated()).toBe(true);
      expect(client.getState().user?.id).toBe('user_technician_01');
      expect(client.getState().user?.email).toBe('technician_01@example.com');
      expect(client.getState().user?.name).toBe('Technician 01');
    });

    it('rejects empty or completely invalid token strings', async () => {
      const client = new GisClient();
      const success = await client.signInWithToken('random_corrupted_string');
      expect(success).toBe(false);
      expect(client.isAuthenticated()).toBe(false);
    });

    it('rejects legacy or forged test mock tokens without valid JWT structure', async () => {
      const client = new GisClient();
      const success = await client.signInWithToken('valid_gis_token_attacker');
      expect(success).toBe(false);
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getState().user).toBeNull();
      expect(mockStorage['sc:auth_token']).toBeUndefined();
    });

    it('signs out and cleanly resets to anonymous operation', async () => {
      const client = new GisClient();
      const token = createMockJwt({
        sub: 'user_researcher',
        email: 'researcher@example.com',
        name: 'Researcher',
      });
      await client.signInWithToken(token);
      expect(client.isAuthenticated()).toBe(true);

      await client.signOut();
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getToken()).toBeNull();
      expect(client.getState().user).toBeNull();
      expect(mockStorage['sc:auth_token']).toBeUndefined();
      expect(mockStorage['sc:auth_user']).toBeUndefined();
    });
  });

  describe('Bench Preferences Synchronization', () => {
    it('returns null preferences without making HTTP calls when anonymous', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const client = new GisClient();
      const prefs = await client.syncPreferences();
      expect(prefs).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('POSTs and retrieves preferences with Bearer token when authenticated', async () => {
      const client = new GisClient({ baseUrl: 'http://backend.local' });
      const token = createMockJwt({
        sub: 'user_dr_nelson',
        email: 'dr_nelson@example.com',
        name: 'Dr. Nelson',
      });
      await client.signInWithToken(token);

      const benchPrefs: BenchPreferences = {
        default_species: 'Cattleya labiata',
        default_dpi: 1200,
        default_researcher: 'Dr. Nelson',
      };

      const mockFetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        expect(url).toContain('/api/v1/auth/preferences');
        expect(opts.headers).toMatchObject({
          Authorization: `Bearer ${token}`,
        });

        if (opts.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(benchPrefs),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(benchPrefs),
        });
      });

      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const saved = await client.syncPreferences(benchPrefs);
      expect(saved).toEqual(benchPrefs);
      expect(client.getState().preferences).toEqual(benchPrefs);
      expect(mockStorage['sc:auth_preferences']).toContain('Cattleya labiata');
    });

    it('falls back to local preference cache without throwing if backend is offline', async () => {
      const client = new GisClient({ baseUrl: 'http://backend.local' });
      const token = createMockJwt({
        sub: 'user_dr_nelson',
        email: 'dr_nelson@example.com',
        name: 'Dr. Nelson',
      });
      await client.signInWithToken(token);

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline')) as unknown as typeof fetch;

      const benchPrefs: BenchPreferences = {
        default_species: 'Glycine max (Soja)',
      };

      const res = await client.syncPreferences(benchPrefs);
      expect(res).toEqual(benchPrefs);
      expect(client.getState().preferences?.default_species).toBe('Glycine max (Soja)');
    });
  });
});
