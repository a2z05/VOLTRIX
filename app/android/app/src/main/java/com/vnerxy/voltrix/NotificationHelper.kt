package com.vnerxy.voltrix

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.view.View
import android.widget.RemoteViews

/**
 * VOLTRIX custom notification — a real RemoteViews card, not a stock text notification.
 *
 * The card carries VOLTRIX's own dark background, a switch the user can tap right
 * inside the notification, and a live spinner while the apply runs:
 *
 *   QUESTION      -> switch off, "tap to activate"
 *   ACTIVATING    -> spinner animation, apply running as root in the background
 *   ACTIVE        -> switch on, green confirmation
 *   NOT_CHARGING  -> "connect the charger first"
 *   FAILED        -> red failure hint
 *
 * All methods are main-thread only; [show] posts synchronously so a tile tap
 * displays the card immediately ("in place").
 */
object NotificationHelper {

  private const val CHANNEL_ID = "voltrix_fast"
  private const val NOTIF_ID = 6701

  const val ACTION_TOGGLE = "com.vnerxy.voltrix.TOGGLE_67W"
  const val ACTION_DISMISS = "com.vnerxy.voltrix.DISMISS"

  enum class State { QUESTION, ACTIVATING, ACTIVE, NOT_CHARGING, FAILED }

  private val C_SUB = 0xFF9498B3.toInt()
  private val C_ACCENT = 0xFF5E7CFF.toInt()
  private val C_OK = 0xFF3DDC97.toInt()
  private val C_WARN = 0xFFFFD23F.toInt()
  private val C_BAD = 0xFFFF5C72.toInt()

  fun canNotify(context: Context): Boolean =
      if (Build.VERSION.SDK_INT >= 33)
          context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
              PackageManager.PERMISSION_GRANTED
      else true

  /** Sticky battery broadcast — no root, no polling, costs nothing. */
  fun isCharging(context: Context): Boolean {
    val sticky: Intent? =
        try {
          context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        } catch (e: Exception) {
          null
        } ?: return false
    val status =
        sticky.getIntExtra(
            BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
    return status == BatteryManager.BATTERY_STATUS_CHARGING ||
        status == BatteryManager.BATTERY_STATUS_FULL
  }

  /** Builds and posts the custom card for [state]. Returns false if blocked by permission. */
  fun show(context: Context, state: State): Boolean {
    if (!canNotify(context)) return false
    ensureChannel(context)

    var status = ""
    var color = C_SUB
    var toggleIcon = R.drawable.voltrix_toggle_off
    when (state) {
      State.QUESTION -> {
        status = "Switch on to activate 67W fast charge"
        color = C_SUB
        toggleIcon = R.drawable.voltrix_toggle_off
      }
      State.ACTIVATING -> {
        status = "Applying fast charge…"
        color = C_ACCENT
      }
      State.ACTIVE -> {
        status = "67W fast charge active ✓"
        color = C_OK
        toggleIcon = R.drawable.voltrix_toggle_on
      }
      State.NOT_CHARGING -> {
        status = "Connect the charger first, then toggle"
        color = C_WARN
        toggleIcon = R.drawable.voltrix_toggle_off
      }
      State.FAILED -> {
        status = "Activation failed — open the app"
        color = C_BAD
        toggleIcon = R.drawable.voltrix_toggle_off
      }
    }

    val rv = RemoteViews(context.packageName, R.layout.notif_voltrix)
    rv.setTextViewText(R.id.notif_status, status)
    rv.setTextViewTextColor(R.id.notif_status, color)
    rv.setImageViewResource(R.id.notif_toggle, toggleIcon)
    // The spinner only shows while the apply runs; the switch hides during it.
    rv.setViewVisibility(
        R.id.notif_progress, if (state == State.ACTIVATING) View.VISIBLE else View.GONE)
    rv.setViewVisibility(
        R.id.notif_toggle, if (state == State.ACTIVATING) View.GONE else View.VISIBLE)

    val toggleIntent = Intent(context, ChargeActionReceiver::class.java).setAction(ACTION_TOGGLE)
    val togglePi =
        PendingIntent.getBroadcast(
            context,
            1,
            toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    rv.setOnClickPendingIntent(R.id.notif_toggle, togglePi)

    val launch =
        context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent(context, MainActivity::class.java)
    launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val launchPi =
        PendingIntent.getActivity(
            context,
            0,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val builder =
        if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL_ID)
        else Notification.Builder(context)
    builder
        .setSmallIcon(R.drawable.voltrix_bolt)
        .setContentTitle("VOLTRIX · 67W fast charge")
        .setContentText(status)
        .setContentIntent(launchPi)
        .setAutoCancel(true)
        .setCustomContentView(rv)

    val nm = context.getSystemService(NotificationManager::class.java)
    nm.notify(NOTIF_ID, builder.build())
    return true
  }

  fun cancel(context: Context) {
    context.getSystemService(NotificationManager::class.java).cancel(NOTIF_ID)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = context.getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL_ID) == null) {
      nm.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "67W fast charge", NotificationManager.IMPORTANCE_HIGH))
    }
  }
}
