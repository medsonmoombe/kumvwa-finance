export interface StoredObject {
  size: number;
  etag: string;
}

export interface StorageDriver {
  init(): Promise<void>;
  presignPut(key: string, mime: string): Promise<string>;
  /** `mime` is signed by backends that need it to serve the object inline. */
  presignGet(key: string, mime?: string): Promise<string>;
  head(key: string): Promise<StoredObject | null>;
}
