import { registerWebModule, NativeModule } from 'expo';

// Not available on web — isSupported() returns false so callers fall back.
class MediaStoreSaverModule extends NativeModule<{}> {
  isSupported(): boolean {
    return false;
  }
  async saveToDownloads(): Promise<string> {
    throw new Error('MediaStoreSaver is not available on web');
  }
}

export default registerWebModule(MediaStoreSaverModule, 'MediaStoreSaverModule');
