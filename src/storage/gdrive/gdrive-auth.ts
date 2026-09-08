import { CloudUserInfo } from '../base/storage-provider';

const GDRIVE_TOKEN_KEY = 'graphdule_gdrive_token';
const GDRIVE_TOKEN_EXPIRY_KEY = 'graphdule_gdrive_token_expiry';
const GDRIVE_USER_KEY = 'graphdule_gdrive_user';
const GDRIVE_CLIENT_ID_KEY = 'graphdule_gdrive_client_id';
const ACTIVE_CLOUD_PROVIDER_KEY = 'graphdule_active_cloud_provider';

// Default public Google Drive client ID (can be overridden by user or .env)
export const DEFAULT_GDRIVE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '1081532507375-rv55honr2501rn3r6v9chffuumuiu17c.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

export class GDriveAuth {
  private static token: string | null = localStorage.getItem(GDRIVE_TOKEN_KEY);
  private static tokenExpiry: number = parseInt(localStorage.getItem(GDRIVE_TOKEN_EXPIRY_KEY) || '0', 10);
  private static user: CloudUserInfo | null = (() => {
    try {
      const raw = localStorage.getItem(GDRIVE_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  private static tokenClient: any = null;
  private static refreshTimer: any = null;
  private static refreshInProgressPromise: Promise<{ success: boolean; error?: string; user?: CloudUserInfo }> | null = null;

  public static getCustomClientId(): string {
    return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || '';
  }

  public static setCustomClientId(clientId: string): void {
    if (clientId.trim()) {
      localStorage.setItem(GDRIVE_CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(GDRIVE_CLIENT_ID_KEY);
    }
    // Invalidate cached token client on client ID change
    this.tokenClient = null;
  }

  public static getEffectiveClientId(): string {
    return this.getCustomClientId() || DEFAULT_GDRIVE_CLIENT_ID;
  }

  public static isAuthenticated(): boolean {
    if (!this.token) return false;
    // Check if expired
    if (Date.now() >= this.tokenExpiry) {
      return false;
    }
    return true;
  }

  public static getToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.token;
  }

  /**
   * Retrieves an active token, automatically refreshing it if expired or expiring within 60 seconds.
   */
  public static async getValidToken(): Promise<string | null> {
    if (this.token && Date.now() < this.tokenExpiry - 60000) {
      return this.token;
    }

    // Token is expired or expiring very soon - attempt silent refresh
    const res = await this.refreshToken(false);
    if (res.success && this.token) {
      return this.token;
    }

    return this.isAuthenticated() ? this.token : null;
  }

  public static getUser(): CloudUserInfo | null {
    return this.user;
  }

  private static async ensureGsiLoaded(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if ((window as any).google?.accounts?.oauth2) return true;

    return new Promise((resolve) => {
      let script = document.getElementById('google-gsi-client') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      const checkInterval = setInterval(() => {
        if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      script.addEventListener('load', () => {
        clearInterval(checkInterval);
        resolve(true);
      });

      // Timeout after 3s and fallback
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(typeof window !== 'undefined' && !!(window as any).google?.accounts?.oauth2);
      }, 3000);
    });
  }

  private static async getOrInitTokenClient(): Promise<any> {
    if (typeof window === 'undefined') return null;
    const loaded = await this.ensureGsiLoaded();
    if (!loaded || !(window as any).google?.accounts?.oauth2) return null;

    if (!this.tokenClient) {
      const finalClientId = this.getEffectiveClientId();
      this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: finalClientId,
        scope: SCOPES,
        callback: () => {},
      });
    }
    return this.tokenClient;
  }

  /**
   * Refreshes the Google OAuth token.
   * If interactive is false, uses prompt: '' to refresh silently without a user consent dialog.
   */
  public static async refreshToken(interactive = false): Promise<{ success: boolean; error?: string; user?: CloudUserInfo }> {
    if (this.refreshInProgressPromise) {
      return this.refreshInProgressPromise;
    }

    this.refreshInProgressPromise = new Promise(async (resolve) => {
      try {
        const client = await this.getOrInitTokenClient();
        if (client) {
          client.callback = async (response: any) => {
            this.refreshInProgressPromise = null;
            if (response.error) {
              console.warn('[GDriveAuth] Token refresh error:', response.error_description || response.error);
              resolve({ success: false, error: response.error_description || response.error });
              return;
            }

            if (response.access_token) {
              const expiresIn = parseInt(response.expires_in || '3600', 10);
              this.setTokenData(response.access_token, expiresIn);

              const userInfo = await this.fetchUserInfo(response.access_token);
              if (userInfo && userInfo.email) {
                this.user = userInfo;
                localStorage.setItem(GDRIVE_USER_KEY, JSON.stringify(userInfo));
              }

              resolve({ success: true, user: this.user || undefined });
            } else {
              resolve({ success: false, error: 'No access token received from Google' });
            }
          };

          client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
          return;
        }

        if (interactive) {
          this.refreshInProgressPromise = null;
          const res = await this.login();
          resolve(res);
          return;
        }

        this.refreshInProgressPromise = null;
        resolve({ success: false, error: 'Google Identity Services not initialized' });
      } catch (err: any) {
        this.refreshInProgressPromise = null;
        resolve({ success: false, error: err.message || 'Token refresh failed' });
      }
    });

    return this.refreshInProgressPromise;
  }

  /**
   * Schedules a background token refresh ~5 minutes before current token expires.
   */
  public static scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.token || !this.tokenExpiry) return;

    // Refresh 5 minutes before expiration, or in 10s if already nearing/past expiration
    const timeUntilRefresh = Math.max(this.tokenExpiry - Date.now() - 5 * 60 * 1000, 10000);

    this.refreshTimer = setTimeout(async () => {
      const activeProvider = localStorage.getItem(ACTIVE_CLOUD_PROVIDER_KEY);
      if (activeProvider === 'google_drive') {
        await this.refreshToken(false);
      }
    }, timeUntilRefresh);
  }

  /**
   * Triggers Google OAuth 2.0 Token Flow in browser.
   */
  public static async login(clientId?: string): Promise<{ success: boolean; error?: string; user?: CloudUserInfo }> {
    if (clientId) {
      this.setCustomClientId(clientId);
    }
    const finalClientId = this.getEffectiveClientId();

    await this.ensureGsiLoaded();

    return new Promise((resolve) => {
      // 1. If Google Identity Services script is available
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: finalClientId,
            scope: SCOPES,
            callback: async (response: any) => {
              if (response.error) {
                resolve({ success: false, error: response.error_description || response.error });
                return;
              }

              if (response.access_token) {
                const expiresIn = parseInt(response.expires_in || '3600', 10);
                this.setTokenData(response.access_token, expiresIn);

                const userInfo = await this.fetchUserInfo(response.access_token);
                this.user = userInfo;
                localStorage.setItem(GDRIVE_USER_KEY, JSON.stringify(userInfo));

                resolve({ success: true, user: userInfo });
              } else {
                resolve({ success: false, error: 'No access token received from Google' });
              }
            },
          });
          this.tokenClient = client;

          client.requestAccessToken({ prompt: 'consent' });
          return;
        } catch (err: any) {
          console.warn('Google Identity Services client error, falling back to popup flow:', err);
        }
      }

      // 2. Fallback OAuth 2.0 Popup Flow
      const redirectUri = window.location.origin.replace(/\/$/, '');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(finalClientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `include_granted_scopes=true&` +
        `prompt=consent`;

      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        resolve({ success: false, error: 'Popup blocked by browser. Please allow popups for this site.' });
        return;
      }

      const pollInterval = window.setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            clearInterval(pollInterval);
            resolve({ success: false, error: 'Authentication window closed by user.' });
            return;
          }

          if (popup.location.href.includes(redirectUri)) {
            const hash = popup.location.hash;
            if (hash) {
              const params = new URLSearchParams(hash.substring(1));
              const accessToken = params.get('access_token');
              const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

              if (accessToken) {
                clearInterval(pollInterval);
                popup.close();

                this.setTokenData(accessToken, expiresIn);
                const userInfo = await this.fetchUserInfo(accessToken);
                this.user = userInfo;
                localStorage.setItem(GDRIVE_USER_KEY, JSON.stringify(userInfo));

                resolve({ success: true, user: userInfo });
                return;
              }
            }
          }
        } catch {
          // Cross-origin access until redirected to redirectUri
        }
      }, 500);
    });
  }

  public static logout(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.token = null;
    this.tokenExpiry = 0;
    this.user = null;
    this.tokenClient = null;
    localStorage.removeItem(GDRIVE_TOKEN_KEY);
    localStorage.removeItem(GDRIVE_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(GDRIVE_USER_KEY);
  }

  private static setTokenData(token: string, expiresInSeconds: number): void {
    this.token = token;
    this.tokenExpiry = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(GDRIVE_TOKEN_KEY, token);
    localStorage.setItem(GDRIVE_TOKEN_EXPIRY_KEY, this.tokenExpiry.toString());
    this.scheduleTokenRefresh();
  }

  private static async fetchUserInfo(accessToken: string): Promise<CloudUserInfo> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return {};
      const data = await res.json();
      return {
        email: data.email,
        name: data.name,
        avatarUrl: data.picture,
      };
    } catch {
      return {};
    }
  }
}

// Automatically schedule token refresh on startup if Google Drive is the active provider
if (typeof window !== 'undefined' && localStorage.getItem(ACTIVE_CLOUD_PROVIDER_KEY) === 'google_drive') {
  GDriveAuth.scheduleTokenRefresh();
}
