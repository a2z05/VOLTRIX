package com.vnerxy.voltrix

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Handles the two notification actions.
 *
 *  com.vnerxy.voltrix.APPLY_67W  -> runs the module apply script as root, then posts a
 *                                   result notification ("applied" / "apply failed").
 *  com.vnerxy.voltrix.DISMISS    -> cancels the prompt notification.
 *
 * The receiver is exported=false; it is only reached through explicit PendingIntents
 * created by [NotificationHelper].
 */
class ChargeActionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      NotificationHelper.ACTION_APPLY -> apply(context)
      NotificationHelper.ACTION_DISMISS -> NotificationHelper.cancelActivate(context)
      else -> Unit
    }
  }

  private fun apply(context: Context) {
    val pendingResult = goAsync() // keeps the broadcast alive while the script runs
    Thread {
      var ok = false
      try {
        val process =
            ProcessBuilder(
                    "su",
                    "-c",
                    "sh /data/adb/modules/voltrix/script/charge.sh >/dev/null 2>&1")
                .redirectErrorStream(true)
                .start()
        // Drain output so a chatty script can never block on a full pipe buffer.
        process.inputStream.bufferedReader().use { it.readText() }
        ok = process.waitFor() == 0
      } catch (e: Exception) {
        ok = false
      } finally {
        NotificationHelper.postResult(context, ok)
        pendingResult.finish()
      }
    }.start()
  }
}
