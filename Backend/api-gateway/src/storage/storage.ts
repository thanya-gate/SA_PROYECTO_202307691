import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { config } from '../config/env';

/**
 * Backend de almacenamiento multimedia. El gateway escribe siempre el archivo
 * entrante en un temporal (para poder validar con ffprobe) y luego delega al
 * backend el "commit": moverlo a su destino final (disco) o subirlo al bucket
 * (Cloud Storage). Cada backend genera la URL pública que se persiste en la
 * base de datos y que el frontend usará para reproducir.
 */
export interface StorageBackend {
  /** Mueve el video temporal a su destino y devuelve la URL pública. */
  guardarVideo(claseId: string, tempPath: string, contentType: string): Promise<string>;

  /**
   * Mueve el material temporal a su destino, elimina los materiales previos de
   * la clase con otra extensión y devuelve la URL pública.
   */
  guardarMaterial(claseId: string, tempPath: string, ext: string, contentType: string): Promise<string>;

  /** Elimina el video y todos los materiales asociados a una clase. */
  eliminarArchivosClase(claseId: string): Promise<void>;
}

/**
 * Backend local: los archivos viven en MEDIA_DIR y nginx los sirve como
 * estáticos bajo /media (mismo origen del SPA).
 */
class LocalStorageBackend implements StorageBackend {
  constructor(private readonly extensionesMaterial: string[]) {}

  async guardarVideo(claseId: string, tempPath: string, _contentType: string): Promise<string> {
    const targetPath = path.join(config.MEDIA_DIR, 'clases', `${claseId}.mp4`);
    await fs.promises.rename(tempPath, targetPath);
    return `/media/clases/${claseId}.mp4`;
  }

  async guardarMaterial(claseId: string, tempPath: string, ext: string, _contentType: string): Promise<string> {
    const dirMateriales = path.join(config.MEDIA_DIR, 'materiales');
    for (const prevExt of this.extensionesMaterial) {
      if (prevExt === ext) continue;
      await fs.promises.rm(path.join(dirMateriales, `${claseId}${prevExt}`), { force: true }).catch(() => {});
    }
    const targetPath = path.join(dirMateriales, `${claseId}${ext}`);
    await fs.promises.rename(tempPath, targetPath);
    return `/media/materiales/${claseId}${ext}`;
  }

  async eliminarArchivosClase(claseId: string): Promise<void> {
    // Se intentan ambas rutas por compatibilidad con archivos creados cuando
    // la URL guardada era /media/videos/clases/...
    await fs.promises.rm(path.join(config.MEDIA_DIR, 'videos', 'clases', `${claseId}.mp4`), { force: true }).catch(() => {});
    await fs.promises.rm(path.join(config.MEDIA_DIR, 'clases', `${claseId}.mp4`), { force: true }).catch(() => {});
    for (const ext of this.extensionesMaterial) {
      await fs.promises.rm(path.join(config.MEDIA_DIR, 'materiales', `${claseId}${ext}`), { force: true }).catch(() => {});
    }
  }
}

/**
 * Backend de Google Cloud Storage: sube los objetos a los buckets
 * GCS_BUCKET_VIDEOS / GCS_BUCKET_MATERIAL, los hace públicos y devuelve su URL
 * absoluta. La autenticación usa las Application Default Credentials (la
 * cuenta de servicio de la VM en producción; GOOGLE_APPLICATION_CREDENTIALS en
 * desarrollo). El archivo temporal se elimina tras la subida.
 */
class GcsStorageBackend implements StorageBackend {
  private readonly storage = new Storage();

  constructor(private readonly extensionesMaterial: string[]) {}

  private urlPublica(bucket: string, objeto: string): string {
    if (config.GCS_PUBLIC_BASE_URL) {
      return `${config.GCS_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${objeto}`;
    }
    return `https://storage.googleapis.com/${bucket}/${objeto}`;
  }

  private async subir(bucket: string, objeto: string, tempPath: string, contentType: string): Promise<string> {
    await this.storage.bucket(bucket).upload(tempPath, {
      destination: objeto,
      contentType,
      resumable: false,
    });
    // Los objetos deben ser públicos para reproducirse directo desde el bucket.
    await this.storage.bucket(bucket).file(objeto).makePublic().catch(() => {});
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    return this.urlPublica(bucket, objeto);
  }

  private async eliminarObjeto(bucket: string, objeto: string): Promise<void> {
    await this.storage.bucket(bucket).file(objeto).delete({ ignoreNotFound: true }).catch(() => {});
  }

  async guardarVideo(claseId: string, tempPath: string, contentType: string): Promise<string> {
    return this.subir(config.GCS_BUCKET_VIDEOS, `clases/${claseId}.mp4`, tempPath, contentType);
  }

  async guardarMaterial(claseId: string, tempPath: string, ext: string, contentType: string): Promise<string> {
    for (const prevExt of this.extensionesMaterial) {
      if (prevExt === ext) continue;
      await this.eliminarObjeto(config.GCS_BUCKET_MATERIAL, `materiales/${claseId}${prevExt}`);
    }
    return this.subir(config.GCS_BUCKET_MATERIAL, `materiales/${claseId}${ext}`, tempPath, contentType);
  }

  async eliminarArchivosClase(claseId: string): Promise<void> {
    await this.eliminarObjeto(config.GCS_BUCKET_VIDEOS, `clases/${claseId}.mp4`);
    for (const ext of this.extensionesMaterial) {
      await this.eliminarObjeto(config.GCS_BUCKET_MATERIAL, `materiales/${claseId}${ext}`);
    }
  }
}

export function createStorageBackend(backend: 'local' | 'gcs', extensionesMaterial: string[]): StorageBackend {
  if (backend === 'gcs') {
    console.log('[api-gateway] Almacenamiento de media: Google Cloud Storage');
    return new GcsStorageBackend(extensionesMaterial);
  }
  console.log(`[api-gateway] Almacenamiento de media: local (${config.MEDIA_DIR})`);
  return new LocalStorageBackend(extensionesMaterial);
}
