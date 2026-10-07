package com.vnerxy.voltrix

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Exposed to JavaScript as `NativeModules.Voltrix`.
 *
 * Single method:
 *   exec(command: string): Promise<{ code: number, stdout: string, stderr: string }>
 *
 * The command is executed as `su -c <command>` on a background thread.
 * stdout and stderr are captured separately (no merging). The promise always
 * resolves with the exit code plus both streams; it only rejects when `su`
 * cannot be spawned at all (missing binary / not executable) or when the
 * process did not finish within the timeout.
 */
class VoltrixModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "Voltrix"

  @ReactMethod
  fun exec(command: String, promise: Promise) {
    if (!isSuAvailable()) {
      promise.reject(
          "E_NO_SU",
          "su binary not found. Install and grant KernelSU/Magisk root, then reopen VOLTRIX.")
      return
    }

    executor.execute {
      var process: Process? = null
      try {
        process = ProcessBuilder("su", "-c", command).start()
        val stdout = StreamCollector(process.inputStream)
        val stderr = StreamCollector(process.errorStream)
        stdout.start()
        stderr.start()

        if (!process.waitFor(COMMAND_TIMEOUT_SEC, TimeUnit.SECONDS)) {
          process.destroyForcibly()
          stdout.join(STREAM_JOIN_MS)
          stderr.join(STREAM_JOIN_MS)
          promise.reject("E_TIMEOUT", "Root command timed out after ${COMMAND_TIMEOUT_SEC}s")
          return@execute
        }

        stdout.join(STREAM_JOIN_MS)
        stderr.join(STREAM_JOIN_MS)

        val result =
            Arguments.createMap().apply {
              putInt("code", process.exitValue())
              putString("stdout", stdout.text)
              putString("stderr", stderr.text)
            }
        promise.resolve(result)
      } catch (e: IOException) {
        promise.reject(
            "E_SPAWN",
            "Could not run su (${e.message}). Root access is required for VOLTRIX.",
            e)
      } catch (e: InterruptedException) {
        Thread.currentThread().interrupt()
        promise.reject("E_INTERRUPTED", "Root command was interrupted", e)
      } finally {
        process?.let {
          if (it.isAlive) {
            it.destroyForcibly()
          }
        }
      }
    }
  }

  /**
   * App-private preferences (SharedPreferences, "voltrix") — the notification
   * side reads these natively in the same process, no root involved.
   * getPref resolves "" for missing values or any error (best-effort reads).
   */
  @ReactMethod
  fun getPref(key: String, promise: Promise) {
    try {
      val v =
          reactApplicationContext
              .getSharedPreferences("voltrix", Context.MODE_PRIVATE)
              .getString(key, "")
      promise.resolve(v ?: "")
    } catch (e: Exception) {
      promise.resolve("")
    }
  }

  @ReactMethod
  fun setPref(key: String, value: String, promise: Promise) {
    try {
      reactApplicationContext
          .getSharedPreferences("voltrix", Context.MODE_PRIVATE)
          .edit()
          .putString(key, value)
          .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_PREF", "Could not save preference (${e.message})", e)
    }
  }

  /** Checks the usual su install locations before paying for a process spawn. */
  private fun isSuAvailable(): Boolean {
    val candidates =
        listOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/su/bin/su",
            "/vendor/bin/su",
        )
    for (path in candidates) {
      if (File(path).canExecute()) {
        return true
      }
    }
    // Fall back to PATH lookup: some root solutions only expose `su` at runtime.
    return try {
      val p = ProcessBuilder("sh", "-c", "command -v su").start()
      val out = p.inputStream.bufferedReader().use { it.readText() }
      val finished = p.waitFor(5, TimeUnit.SECONDS)
      finished && p.exitValue() == 0 && out.trim().isNotEmpty()
    } catch (e: Exception) {
      false
    }
  }

  /** Reads a stream fully on its own thread so a full pipe buffer cannot deadlock us. */
  private class StreamCollector(private val stream: InputStream) : Thread() {
    @Volatile var text: String = ""

    init {
      isDaemon = true
    }

    override fun run() {
      text =
          try {
            stream.bufferedReader().use { it.readText() }
          } catch (e: Exception) {
            ""
          }
    }
  }

  companion object {
    private const val COMMAND_TIMEOUT_SEC = 120L
    private const val STREAM_JOIN_MS = 2000L
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  }
}
