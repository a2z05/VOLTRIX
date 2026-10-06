package com.vnerxy.voltrix

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

/**
 * Builds and posts the two VOLTRIX notifications:
 *  1. the "Activate 67W fast charge?" prompt with Apply / Dismiss actions, and
 *  2. the follow-up result notification after the apply script ran.
 */
object NotificationHelper {

  const val CHANNEL_ID = "voltrix_67w"
  const val CHANNEL_NAME = "67W unlock"

  const val ACTION_APPLY = "com.vnerxy.voltrix.APPLY_67W"
  const val ACTION_DISMISS = "com.vnerxy.voltrix.DISMISS"

  private const val ACTIVATE_ID = 6701
  private const val RESULT_ID = 6702
  private const val ACCENT = 0xFF5E7CFF.toInt()

  /** Creates the HIGH importance channel (API 26+). Safe to call repeatedly. */
  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
        NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Unlocks the 67W fast charge profile from the Quick Settings tile"
          enableVibration(true)
        }
    manager.createNotificationChannel(channel)
  }

  /** True when the app is allowed to post notifications (POST_NOTIFICATIONS on API 33+). */
  fun canPost(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < 33) return true
    return context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED
  }

  /** The activation prompt: "Activate 67W fast charge?" with Apply and Dismiss actions. */
  fun postActivate(context: Context): Boolean {
    if (!canPost(context)) return false
    ensureChannel(context)

    val openApp =
        PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val applyPending =
        PendingIntent.getBroadcast(
            context,
            1,
            Intent(context, ChargeActionReceiver::class.java).setAction(ACTION_APPLY),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val dismissPending =
        PendingIntent.getBroadcast(
            context,
            2,
            Intent(context, ChargeActionReceiver::class.java).setAction(ACTION_DISMISS),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val builder = baseBuilder(context)
        .setContentTitle("Activate 67W fast charge?")
        .setContentText("Fast charge profile and thermal gate unlock will be applied now.")
        .setStyle(Notification.BigTextStyle()
            .bigText("Fast charge profile and thermal gate unlock will be applied now."))
        .setContentIntent(openApp)
        .setAutoCancel(true)
        .setColor(ACCENT)
        .addAction(Notification.Action.Builder(null, "Apply", applyPending).build())
        .addAction(Notification.Action.Builder(null, "Dismiss", dismissPending).build()

    notifyCompat(context, ACTIVATE_ID, builder)
    return true
  }

  /** Follow-up notification shown after the apply script finishes. */
  fun postResult(context: Context, ok: Boolean) {
    if (!canPost(context)) return
    ensureChannel(context)

    val title = if (ok) "67W fast charge applied" else "Apply failed — check VOLTRIX log"
    val text =
        if (ok) "Fast charge profile and thermal gate unlock are active."
        else "The module script returned an error. Open VOLTRIX → Log for details."

    val openApp =
        PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val builder = baseBuilder(context)
        .setContentTitle(title)
        .setContentText(text)
        .setStyle(Notification.BigTextStyle().bigText(text))
        .setContentIntent(openApp)
        .setAutoCancel(true)
        .setColor(if (ok) 0xFF3DDC97.toInt() else 0xFFFF5C72.toInt())

    notifyCompat(context, RESULT_ID, builder)
  }

  fun cancelActivate(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(ACTIVATE_ID)
  }

  private fun baseBuilder(context: Context): Notification.Builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(context, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
      }

  private fun notifyCompat(context: Context, id: Int, builder: Notification.Builder) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(id, builder.build())
  }
}
