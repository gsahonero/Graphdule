import { OneDriveAuth } from './onedrive-auth';

export interface OneDriveFileItem {
  id: string;
  name: string;
  lastModifiedDateTime: string;
}

export class OneDriveClient {
  private static getHeaders(): HeadersInit {
    const token = OneDriveAuth.getToken();
    if (!token) {
      throw new Error('OneDrive is not authenticated. Please connect your Microsoft account.');
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Lists all files within Graphdule's AppRoot in OneDrive.
   */
  public static async listFiles(): Promise<OneDriveFileItem[]> {
    const url = 'https://graph.microsoft.com/v1.0/me/drive/special/approot/children';
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Failed to list files in OneDrive: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.value || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      lastModifiedDateTime: item.lastModifiedDateTime,
    }));
  }

  /**
   * Downloads and parses JSON content from a file in OneDrive approot.
   */
  public static async downloadJson<T>(filename: string): Promise<T | null> {
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(filename)}:/content`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to download file from OneDrive: ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Uploads or replaces a JSON file in OneDrive approot.
   */
  public static async uploadJson(filename: string, data: any): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(filename)}:/content`;
    const jsonString = JSON.stringify(data, null, 2);

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: jsonString,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload file to OneDrive: ${res.statusText}`);
    }
  }

  /**
   * Deletes a file in OneDrive approot.
   */
  public static async deleteFile(filename: string): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(filename)}`;
    await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }
}
