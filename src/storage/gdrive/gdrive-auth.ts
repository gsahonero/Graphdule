import { CloudUserInfo } from '../base/storage-provider';

const GDRIVE_TOKEN_KEY = 'graphdule_gdrive_token';
const GDRIVE_TOKEN_EXPIRY_KEY = 'graphdule_gdrive_token_expiry';
const GDRIVE_USER_KEY = 'graphdule_gdrive_user';
const GDRIVE_CLIENT_ID_KEY = 'graphdule_gdrive_client_id';

// Default public Google Drive client ID (can be overridden by user or .env)
export const DEFAULT_GDRIVE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '1081532507375-rv55honr2501rn3r6v9chffuumuiu17c.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

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

  public static getCustomClientId(): string {
    return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || '';
  }

  public static setCustomClientId(clientId: string): void {
    if (clientId.trim()) {
      localStorage.setItem(GDRIVE_CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(GDRIVE_CLIENT_ID_KEY);
    }
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
        if ((window as any).google?.accounts?.oauth2) {
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
        resolve(!!(window as any).google?.accounts?.oauth2);
      }, 3000);
    });
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
    this.token = null;
    this.tokenExpiry = 0;
    this.user = null;
    localStorage.removeItem(GDRIVE_TOKEN_KEY);
    localStorage.removeItem(GDRIVE_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(GDRIVE_USER_KEY);
  }

  private static setTokenData(token: string, expiresInSeconds: number): void {
    this.token = token;
    this.tokenExpiry = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(GDRIVE_TOKEN_KEY, token);
    localStorage.setItem(GDRIVE_TOKEN_EXPIRY_KEY, this.tokenExpiry.toString());
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
