import { CloudUserInfo } from '../base/storage-provider';

const ONEDRIVE_TOKEN_KEY = 'graphdule_onedrive_token';
const ONEDRIVE_TOKEN_EXPIRY_KEY = 'graphdule_onedrive_token_expiry';
const ONEDRIVE_USER_KEY = 'graphdule_onedrive_user';
const ONEDRIVE_CLIENT_ID_KEY = 'graphdule_onedrive_client_id';

// Default public Microsoft App Client ID (can be customized by user in settings)
export const DEFAULT_ONEDRIVE_CLIENT_ID =
  (import.meta as any).env?.VITE_ONEDRIVE_CLIENT_ID ||
  'e6435d64-sample-4a92-8065-onedriveclient';

const SCOPES = 'Files.ReadWrite.AppFolder User.Read';

export class OneDriveAuth {
  private static token: string | null = localStorage.getItem(ONEDRIVE_TOKEN_KEY);
  private static tokenExpiry: number = parseInt(localStorage.getItem(ONEDRIVE_TOKEN_EXPIRY_KEY) || '0', 10);
  private static user: CloudUserInfo | null = (() => {
    try {
      const raw = localStorage.getItem(ONEDRIVE_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  public static getCustomClientId(): string {
    return localStorage.getItem(ONEDRIVE_CLIENT_ID_KEY) || '';
  }

  public static setCustomClientId(clientId: string): void {
    if (clientId.trim()) {
      localStorage.setItem(ONEDRIVE_CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(ONEDRIVE_CLIENT_ID_KEY);
    }
  }

  public static getEffectiveClientId(): string {
    return this.getCustomClientId() || DEFAULT_ONEDRIVE_CLIENT_ID;
  }

  public static isAuthenticated(): boolean {
    if (!this.token) return false;
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

  /**
   * Triggers Microsoft OAuth 2.0 Token Flow via Popup.
   */
  public static async login(clientId?: string): Promise<{ success: boolean; error?: string; user?: CloudUserInfo }> {
    if (clientId) {
      this.setCustomClientId(clientId);
    }
    const finalClientId = this.getEffectiveClientId();
    const redirectUri = window.location.origin;

    return new Promise((resolve) => {
      const authUrl =
        `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${encodeURIComponent(finalClientId)}&` +
        `response_type=token&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `response_mode=fragment&` +
        `prompt=select_account`;

      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'onedrive_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        resolve({ success: false, error: 'Popup blocked by browser. Please allow popups for Microsoft sign-in.' });
        return;
      }

      const pollInterval = window.setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            clearInterval(pollInterval);
            resolve({ success: false, error: 'Sign-in window closed by user.' });
            return;
          }

          if (popup.location.href.includes(redirectUri)) {
            const hash = popup.location.hash;
            if (hash) {
              const params = new URLSearchParams(hash.substring(1));
              const accessToken = params.get('access_token');
              const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
              const error = params.get('error_description') || params.get('error');

              if (error) {
                clearInterval(pollInterval);
                popup.close();
                resolve({ success: false, error });
                return;
              }

              if (accessToken) {
                clearInterval(pollInterval);
                popup.close();

                this.setTokenData(accessToken, expiresIn);
                const userInfo = await this.fetchUserInfo(accessToken);
                this.user = userInfo;
                localStorage.setItem(ONEDRIVE_USER_KEY, JSON.stringify(userInfo));

                resolve({ success: true, user: userInfo });
                return;
              }
            }
          }
        } catch {
          // Cross-origin until redirected
        }
      }, 500);
    });
  }

  public static logout(): void {
    this.token = null;
    this.tokenExpiry = 0;
    this.user = null;
    localStorage.removeItem(ONEDRIVE_TOKEN_KEY);
    localStorage.removeItem(ONEDRIVE_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(ONEDRIVE_USER_KEY);
  }

  private static setTokenData(token: string, expiresInSeconds: number): void {
    this.token = token;
    this.tokenExpiry = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(ONEDRIVE_TOKEN_KEY, token);
    localStorage.setItem(ONEDRIVE_TOKEN_EXPIRY_KEY, this.tokenExpiry.toString());
  }

  private static async fetchUserInfo(accessToken: string): Promise<CloudUserInfo> {
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return {};
      const data = await res.json();
      return {
        email: data.userPrincipalName || data.mail,
        name: data.displayName,
      };
    } catch {
      return {};
    }
  }
}
