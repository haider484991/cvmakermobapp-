import { NativeModule, requireNativeModule } from 'expo';

declare class MediaStoreSaverModule extends NativeModule<{}> {
  /** True only where MediaStore Downloads works without a picker/permission (Android 10+). */
  isSupported(): boolean;
  /** Copy a local file into the public Downloads folder. Resolves to the content:// URI. */
  saveToDownloads(sourcePath: string, fileName: string, mimeType: string): Promise<string>;
}

// Resolve defensively: if the native module isn't in the binary (older build,
// Expo Go), export null so callers fall back to the share sheet instead of
// throwing at import time.
let resolved: MediaStoreSaverModule | null = null;
try {
  resolved = requireNativeModule<MediaStoreSaverModule>('MediaStoreSaver');
} catch {
  resolved = null;
}

export default resolved;
