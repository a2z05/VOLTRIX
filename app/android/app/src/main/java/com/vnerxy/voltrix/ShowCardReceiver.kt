package com.vnerxy.voltrix

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Card entry point for the module's root watcher (charger connect / disconnect).
 *
 *   com.vnerxy.voltrix.SHOW_CARD
 *       --ez fast true|false  -> ACTIVE (67W already engaged) or QUESTION card
 *       --ez cancel true      -> remove the card (charger unplugged)
 *
 * The watcher runs as root, so this receiver is exported=true — uid-0 broadcasts
 * are the only senders it is meant for. [NotificationHelper.show] only posts a
 * notification, so a hostile sender could at worst pop the VOLTRIX card; the real
 * TOGGLE action (the one that runs root scripts) stays inside the non-exported
 * [ChargeActionReceiver], reachable only through this app's own PendingIntents.
 *
 * Must be called on the main thread — [NotificationHelper.show] is main-thread only,
 * which is exactly what onReceive gives us.
 */
class ShowCardReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_SHOW) return
    if (intent.getBooleanExtra("cancel", false)) {
      NotificationHelper.cancel(context)
      return
    }
    val fast = intent.getBooleanExtra("fast", false)
    NotificationHelper.show(
        context, if (fast) NotificationHelper.State.ACTIVE else NotificationHelper.State.QUESTION)
  }

  companion object {
    const val ACTION_SHOW = "com.vnerxy.voltrix.SHOW_CARD"
  }
}
