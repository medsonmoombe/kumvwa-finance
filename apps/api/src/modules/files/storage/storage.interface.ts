export interface StoredObject {
  size: number;
  etag: string;
}

/** Outcome of a live round-trip against the backend, for boot logs and ops. */
export interface StorageSelfTest {
  ok: boolean;
  /** Human-readable detail; carries the backend's own error when it fails. */
  detail: string;
}

export interface StorageDriver {
  init(): Promise<void>;
  presignPut(key: string, mime: string): Promise<string>;
  /** `mime` is signed by backends that need it to serve the object inline. */
  presignGet(key: string, mime?: string): Promise<string>;
  head(key: string): Promise<StoredObject | null>;
  /**
   * Writes, reads back and deletes a small probe object. Called at boot so a
   * credential that presigns but cannot actually write — or a region/bucket
   * mismatch — shows up in the logs instead of as a failed user upload.
   */
  selfTest(): Promise<StorageSelfTest>;
}
