package com.vnerxy.voltrix

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences

/**
 * Handles the in-notification switch (and the legacy dismiss action).
 *
 *  com.vnerxy.voltrix.TOGGLE_67W
 *      ON  -> runs the module apply script as root while the card shows a live
 *             spinner, then flips the card to the active/failed state.
 *      OFF -> restores thermal protection immediately (mirrors charge.sh's
 *             restore path: thermal_remove=0 + gate state 0), no script run.
 *  com.vnerxy.voltrix.DISMISS -> cancels the card.
 *
 * The receiver is exported=false; it is only reached through explicit PendingIntents
 * created by [NotificationHelper]. Switch state is kept in a tiny SharedPreferences
 * file so the card's on/off matches the last action taken.
 */
class ChargeActionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      NotificationHelper.ACTION_TOGGLE -> toggle(context)
      NotificationHelper.ACTION_DISMISS -> NotificationHelper.cancel(context)
      else -> Unit
    }
  }

  private fun prefs(context: Context): SharedPreferences =
      context.getSharedPreferences("voltrix_session", Context.MODE_PRIVATE)

  private fun toggle(context: Context) {
    val p = prefs(context)
    if (p.getBoolean("fast_on", false)) restore(context, p) else activate(context, p)
  }

  /** Turn OFF now: restore protection with two direct writes (root). */
  private fun restore(context: Context, p: SharedPreferences) {
    val pendingResult = goAsync()
    Thread {
      try {
        val process =
            ProcessBuilder(
                    "su",
                    "-c",
                    "[ -w /sys/class/qcom-battery/thermal_remove ] && " +
                        "echo 0 > /sys/class/qcom-battery/thermal_remove; " +
                        "echo 0 > /data/adb/voltrix/thermal_gate_state; " +
                        "rm -f /data/adb/voltrix/fast_consent")
                .redirectErrorStream(true)
                .start()
        process.inputStream.bufferedReader().use { it.readText() }
        process.waitFor()
      } catch (e: Exception) {
        // best effort — card still resets below
      }
      p.edit().putBoolean("fast_on", false).apply()
      NotificationHelper.show(context, NotificationHelper.State.QUESTION)
      pendingResult.finish()
    }.start()
  }

  /** Turn ON: spinner first, apply as root, then the result state. */
  private fun activate(context: Context, p: SharedPreferences) {
    if (!NotificationHelper.isCharging(context)) {
      NotificationHelper.show(context, NotificationHelper.State.NOT_CHARGING)
      return
    }
    NotificationHelper.show(context, NotificationHelper.State.ACTIVATING)
    val pendingResult = goAsync()
    Thread {
      var ok = false
      try {
        val process =
            ProcessBuilder(
                    "su",
                    "-c",
                    // Consent first — the gate refuses to open without it — then
                    // report whether the gate actually ended up open (temp may
                    // still be over the safe threshold).
                    "touch /data/adb/voltrix/fast_consent && " +
                        "sh /data/adb/modules/voltrix/script/charge.sh >/dev/null 2>&1; " +
                        "[ \"\$(cat /data/adb/voltrix/thermal_gate_state 2>/dev/null)\" = \"1\" ]")
                .redirectErrorStream(true)
                .start()
        // Drain output so a chatty script can never block on a full pipe buffer.
        process.inputStream.bufferedReader().use { it.readText() }
        ok = process.waitFor() == 0
      } catch (e: Exception) {
        ok = false
      } finally {
        p.edit().putBoolean("fast_on", ok).apply()
        NotificationHelper.show(
            context, if (ok) NotificationHelper.State.ACTIVE else NotificationHelper.State.FAILED)
        pendingResult.finish()
      }
    }.start()
  }
}
