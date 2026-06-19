package expo.modules.mediastoresaver

import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Writes a file straight into the device's public Downloads folder via
 * MediaStore — no folder picker, no runtime permission, on Android 10+
 * (API 29). This is the "it just downloads" behavior the Storage Access
 * Framework picker couldn't give us.
 *
 * On Android 9 and below MediaStore.Downloads doesn't exist, so the JS
 * caller falls back to the share sheet.
 */
class MediaStoreSaverModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MediaStoreSaver")

    // JS checks this first; false → fall back to share sheet.
    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    }

    // Copies `sourcePath` (a file:// URI or absolute path) into Downloads
    // as `fileName`. Returns the resulting content:// URI string.
    AsyncFunction("saveToDownloads") { sourcePath: String, fileName: String, mimeType: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw Exception("MediaStore Downloads requires Android 10 or newer")
      }

      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val source = File(sourcePath.removePrefix("file://"))
      if (!source.exists()) {
        throw Exception("Source file not found: $sourcePath")
      }

      val resolver = context.contentResolver
      val pending = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, fileName)
        put(MediaStore.Downloads.MIME_TYPE, mimeType)
        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }

      val uri: Uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, pending)
        ?: throw Exception("Could not create a Downloads entry")

      try {
        resolver.openOutputStream(uri).use { output ->
          if (output == null) throw Exception("Could not open the Downloads file for writing")
          source.inputStream().use { input -> input.copyTo(output) }
        }
      } catch (e: Exception) {
        // Roll back the half-written placeholder so we don't leave a 0-byte
        // file in the user's Downloads.
        resolver.delete(uri, null, null)
        throw e
      }

      val done = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
      resolver.update(uri, done, null, null)

      uri.toString()
    }
  }
}
