/**
 * Google Identity Services (GIS) Wrapper & Bench Preferences Sync
 * File: seedcounter/src/lib/auth/gis-client.ts
 *
 * Strictly opt-in, non-blocking. Defaults to 100% anonymous offline operation.
 * Complies with ORIGINAL_REQUEST §R3 and PROJECT.md F09.
 */

export interface UserProfile {
  id: string; // Google sub identifier
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface BenchPreferences {
  default_species?: string;
  default_dpi?: number;
  default_researcher?: string;
  [key: string]: unknown;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
  preferences: BenchPreferences | null;
}

export interface GisConfig {
  clientId?: string;
  baseUrl?: string;
  autoLoadScript?: boolean;
}

/**
 * Safe JWT parser that works in both browser and Node.js test environments.
 */
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    let jsonString = '';
    if (typeof atob === 'function') {
      const decoded = atob(base64);
      jsonString = decodeURIComponent(
        decoded
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } else if (typeof Buffer !== 'undefined') {
      jsonString = Buffer.from(base64, 'base64').toString('utf-8');
    } else {
      return null;
    }

    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

export class GisClient {
  private config: Required<GisConfig>;
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    preferences: null,
  };
  private listeners: Set<(state: AuthState) => void> = new Set();
  private scriptLoadingPromise: Promise<boolean> | null = null;

  constructor(config: GisConfig = {}) {
    this.config = {
      clientId: config.clientId ?? (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID ? String(import.meta.env.VITE_GOOGLE_CLIENT_ID) : ''),
      baseUrl: config.baseUrl ?? '',
      autoLoadScript: config.autoLoadScript ?? false,
    };

    this.restoreSession();
  }

  /**
   * Get current auth state (always returns valid state, default: anonymous).
   */
  public getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Check if client is currently authenticated.
   */
  public isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  /**
   * Get current Bearer token or null if anonymous.
   */
  public getToken(): string | null {
    return this.state.token;
  }

  /**
   * Subscribe to auth state updates.
   */
  public onAuthStateChanged(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  /**
   * Restore token and profile from localStorage if present.
   */
  private restoreSession(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const storedToken = localStorage.getItem('sc:auth_token');
      const storedUser = localStorage.getItem('sc:auth_user');
      const storedPrefs = localStorage.getItem('sc:auth_preferences');

      if (storedToken && storedUser) {
        this.state = {
          isAuthenticated: true,
          token: storedToken,
          user: JSON.parse(storedUser),
          preferences: storedPrefs ? JSON.parse(storedPrefs) : null,
        };
      }
    } catch {
      // Storage corrupted or disabled - default to anonymous
      this.state = {
        isAuthenticated: false,
        user: null,
        token: null,
        preferences: null,
      };
    }
  }

  /**
   * Dynamically loads Google Identity Services client script if configured.
   * Fails gracefully to anonymous mode if script is blocked or offline.
   */
  public async loadGisScript(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    const win = window as unknown as { google?: { accounts?: { id?: unknown } } };
    if (win.google?.accounts?.id) {
      return true;
    }

    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise<boolean>((resolve) => {
      try {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => {
          // Graceful fallback to anonymous mode
          resolve(false);
        };
        document.head.appendChild(script);
      } catch {
        resolve(false);
      }
    });

    return this.scriptLoadingPromise;
  }

  /**
   * Process a JWT ID token returned by Google One Tap or Sign-in button.
   */
  public async signInWithToken(token: string): Promise<boolean> {
    if (!token) return false;

    const payload = parseJwtPayload(token);
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const user: UserProfile = {
      id: String(payload.sub || payload.id || 'unknown'),
      email: String(payload.email || ''),
      name: String(payload.name || payload.given_name || 'User'),
      picture: payload.picture ? String(payload.picture) : undefined,
      given_name: payload.given_name ? String(payload.given_name) : undefined,
      family_name: payload.family_name ? String(payload.family_name) : undefined,
    };

    this.applyAuthentication(token, user);
    await this.syncPreferences().catch(() => {});
    return true;
  }

  private applyAuthentication(token: string, user: UserProfile): void {
    this.state = {
      ...this.state,
      isAuthenticated: true,
      token,
      user,
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sc:auth_token', token);
        localStorage.setItem('sc:auth_user', JSON.stringify(user));
      } catch {
        // Ignore quota/private browsing errors
      }
    }

    this.notifyListeners();
  }

  /**
   * Sign out and cleanly revert to anonymous offline operation.
   */
  public async signOut(): Promise<void> {
    const prevUser = this.state.user;
    this.state = {
      isAuthenticated: false,
      user: null,
      token: null,
      preferences: null,
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('sc:auth_token');
        localStorage.removeItem('sc:auth_user');
        localStorage.removeItem('sc:auth_preferences');
      } catch {
        // Ignore storage errors
      }
    }

    // Revoke Google session if API is active
    if (prevUser && typeof window !== 'undefined') {
      const win = window as unknown as {
        google?: { accounts?: { id?: { revoke?: (hint: string, done: () => void) => void } } };
      };
      if (typeof win.google?.accounts?.id?.revoke === 'function' && prevUser.email) {
        try {
          win.google.accounts.id.revoke(prevUser.email, () => {});
        } catch {
          // Silent catch
        }
      }
    }

    this.notifyListeners();
  }

  /**
   * Synchronize bench calibration preferences with backend /api/v1/auth/preferences.
   * If newPreferences is provided, saves to server; otherwise fetches existing from server.
   * If offline or error occurs, caches locally and does not interrupt the user.
   */
  public async syncPreferences(
    newPreferences?: BenchPreferences
  ): Promise<BenchPreferences | null> {
    if (!this.state.isAuthenticated || !this.state.token) {
      return this.state.preferences;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.state.token}`,
      'Content-Type': 'application/json',
    };

    try {
      if (newPreferences) {
        const res = await fetch(`${this.config.baseUrl}/api/v1/auth/preferences`, {
          method: 'POST',
          headers,
          body: JSON.stringify(newPreferences),
        });

        if (res.ok) {
          const saved: BenchPreferences = await res.json().catch(() => newPreferences);
          this.updatePreferences(saved);
          return saved;
        }
      } else {
        const res = await fetch(`${this.config.baseUrl}/api/v1/auth/preferences`, {
          method: 'GET',
          headers,
        });

        if (res.ok) {
          const fetched: BenchPreferences = await res.json();
          this.updatePreferences(fetched);
          return fetched;
        }
      }
    } catch {
      // Offline or network error - fallback to local preference cache silently
    }

    if (newPreferences) {
      this.updatePreferences(newPreferences);
      return newPreferences;
    }

    return this.state.preferences;
  }

  private updatePreferences(prefs: BenchPreferences): void {
    this.state = {
      ...this.state,
      preferences: prefs,
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sc:auth_preferences', JSON.stringify(prefs));
      } catch {
        // Ignore storage errors
      }
    }

    this.notifyListeners();
  }
}

/**
 * Singleton instance of GisClient.
 */
export const gisClient = new GisClient();
