import { GDriveAuth } from './gdrive-auth';

export interface GDriveFileItem {
  id: string;
  name: string;
  modifiedTime: string;
}

export class GDriveClient {
  private static cachedFolderId: string | null = null;

  private static getHeaders(): HeadersInit {
    const token = GDriveAuth.getToken();
    if (!token) {
      throw new Error('Google Drive is not authenticated. Please connect your Google account.');
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Discovers or creates the dedicated "Graphdule" root folder in user's Google Drive.
   */
  public static async getOrCreateAppFolder(folderName = 'Graphdule'): Promise<string> {
    if (this.cachedFolderId) return this.cachedFolderId;

    const query = encodeURIComponent(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to search Google Drive folders: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.cachedFolderId = data.files[0].id;
      return this.cachedFolderId!;
    }

    // Create the folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
    }

    const newFolder = await createRes.json();
    this.cachedFolderId = newFolder.id;
    return newFolder.id;
  }

  /**
   * Lists all files within the Graphdule folder.
   */
  public static async listFiles(folderId?: string): Promise<GDriveFileItem[]> {
    const targetFolderId = folderId || (await this.getOrCreateAppFolder());
    const query = encodeURIComponent(`'${targetFolderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&pageSize=1000`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to list files in Google Drive: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Finds a specific file by filename inside the Graphdule folder.
   */
  public static async findFileByName(filename: string, folderId?: string): Promise<GDriveFileItem | null> {
    const targetFolderId = folderId || (await this.getOrCreateAppFolder());
    const query = encodeURIComponent(`'${targetFolderId}' in parents and name = '${filename}' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  }

  /**
   * Downloads and parses JSON content from a Google Drive file.
   */
  public static async downloadJson<T>(fileId: string): Promise<T | null> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) return null;
    return await res.json();
  }

  /**
   * Uploads or updates a JSON file inside the Graphdule folder using multipart upload.
   */
  public static async uploadJson(filename: string, data: any, folderId?: string): Promise<string> {
    const targetFolderId = folderId || (await this.getOrCreateAppFolder());
    const existing = await this.findFileByName(filename, targetFolderId);

    const jsonString = JSON.stringify(data, null, 2);

    if (existing) {
      // Update existing file content
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: jsonString,
      });

      if (!updateRes.ok) {
        throw new Error(`Failed to update file in Google Drive: ${updateRes.statusText}`);
      }
      return existing.id;
    }

    // Create new file with multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: filename,
      parents: [targetFolderId],
      mimeType: 'application/json',
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonString +
      closeDelimiter;

    const createUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create file in Google Drive: ${createRes.statusText}`);
    }

    const created = await createRes.json();
    return created.id;
  }

  /**
   * Deletes a file by file ID in Google Drive.
   */
  public static async deleteFile(fileId: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }
}
