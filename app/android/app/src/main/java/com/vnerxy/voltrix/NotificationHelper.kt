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
import android.media.AudioAttributes
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.view.View
import android.widget.RemoteViews

/**
 * VOLTRIX charging notification — four presentation styles, one state machine.
 *
 * Style is picked in Settings (SharedPreferences key [PREF_STYLE]) and read
 * natively here, so every entry point (QS tile, receivers, the root watcher's
 * broadcast) renders the same way:
 *
 *   ISLAND   -> Dynamic-Island-style centered pill: live spinner + status +
 *               switch, accent rim while 67W is engaged. Compact and floating.
 *   CARD     -> the original two-line card (title, status, spinner, switch).
 *   SLIM     -> one-line low-profile strip: bolt, status, spinner, switch.
 *   CLASSIC  -> stock Android text notification with a "Toggle" action button
 *               (no RemoteViews — the lightest, most compatible option).
 *
 * Shared state machine:
 *
 *   QUESTION      -> switch off, "tap to activate"
 *   ACTIVATING    -> spinner animation, apply running as root in the background
 *   ACTIVE        -> switch on, green confirmation
 *   NOT_CHARGING  -> "connect the charger first"
 *   FAILED        -> red failure hint
 *
 * Lifetime: the card STAYS until the user swipes it away or the charger is
 * unplugged (explicit [cancel]) — Dynamic-Island behaviour: it lives while the
 * context does, and dismissal is always manual. setOnlyAlertOnce makes the
 * first appearance a heads-up and every later state change a silent in-place
 * morph, so updates feel like the island re-drawing itself instead of
 * re-alerting.
 *
 * All methods are main-thread only; [show] posts synchronously so a tile tap
 * displays the card immediately ("in place").
 */
object NotificationHelper {

  private const val NOTIF_ID = 6701
  private const val PREFS = "voltrix"

  /**
   * Two channels, both re-issued (create is idempotent) right before notify()
   * and never deleted while we post to them:
   *
   *   CH_HEADS — sound + vibration + DND bypass; used when the overlay card
   *              cannot be drawn (missing SYSTEM_ALERT_WINDOW permission).
   *   CH_SHADE — silent shade entry; used while the overlay is up so the card
   *              never pops twice.
   *
   * v1.0.8 deleted and recreated CH_LEGACY in place; if the device lags
   * between delete and create, notify() targets a channel that no longer
   * exists and the system drops the notification in silence. Posting only to
   * ids we just created makes that state impossible.
   */
  private const val CH_HEADS = "voltrix_hu"
  private const val CH_SHADE = "voltrix_shade"
  private const val CH_LEGACY = "voltrix_fast"

  /** SharedPreferences key written by the Settings screen (JS) and read here. */
  const val PREF_STYLE = "NOTIF_STYLE"

  const val ACTION_TOGGLE = "com.vnerxy.voltrix.TOGGLE_67W"
  const val ACTION_DISMISS = "com.vnerxy.voltrix.DISMISS"

  enum class State { QUESTION, ACTIVATING, ACTIVE, NOT_CHARGING, FAILED }

  enum class Style { ISLAND, CARD, SLIM, CLASSIC }

  private val C_SUB = 0xFF9498B3.toInt()
  private val C_ACCENT = 0xFF5E7CFF.toInt()
  private val C_OK = 0xFF3DDC97.toInt()
  private val C_WARN = 0xFFFFD23F.toInt()
  private val C_BAD = 0xFFFF5C72.toInt()

  /** Current presentation style; default = the original card. */
  fun style(context: Context): Style {
    val raw =
        try {
          context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_STYLE, "") ?: ""
        } catch (e: Exception) {
          ""
        }
    return when (raw) {
      "ISLAND" -> Style.ISLAND
      "SLIM" -> Style.SLIM
      "CLASSIC" -> Style.CLASSIC
      else -> Style.CARD
    }
  }

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
        }
    if (sticky == null) return false
    val status =
        sticky.getIntExtra(
            BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
    return status == BatteryManager.BATTERY_STATUS_CHARGING ||
        status == BatteryManager.BATTERY_STATUS_FULL
  }

  /**
   * Builds and posts the card for [state]. The overlay window is the primary
   * surface (drawn above every app, immune to DND / floating-alert gates);
   * the notification follows on the heads-up channel only when the overlay
   * is unavailable, otherwise silently in the shade.
   */
  fun show(context: Context, state: State): Boolean {
    val overlay =
        if (state == State.NOT_CHARGING) {
          OverlayCard.hide(context)
          false
        } else {
          OverlayCard.show(context, state)
        }
    if (!canNotify(context)) return overlay
    val chId = ensureChannels(context, overlay)

    var status = ""
    var shortStatus = ""
    var color = C_SUB
    var toggleIcon = R.drawable.voltrix_toggle_off
    when (state) {
      State.QUESTION -> {
        status = "Switch on to activate 67W fast charge"
        shortStatus = "Tap to activate 67W"
        color = C_SUB
        toggleIcon = R.drawable.voltrix_toggle_off
      }
      State.ACTIVATING -> {
        status = "Applying fast charge…"
        shortStatus = "Applying…"
        color = C_ACCENT
      }
      State.ACTIVE -> {
        status = "67W fast charge active ✓"
        shortStatus = "67W fast charge ✓"
        color = C_OK
        toggleIcon = R.drawable.voltrix_toggle_on
      }
      State.NOT_CHARGING -> {
        status = "Connect the charger first, then toggle"
        shortStatus = "Connect charger first"
        color = C_WARN
        toggleIcon = R.drawable.voltrix_toggle_off
      }
      State.FAILED -> {
        status = "Activation failed — open the app"
        shortStatus = "Failed — open the app"
        color = C_BAD
        toggleIcon = R.drawable.voltrix_toggle_off
      }
    }

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

    val toggleIntent = Intent(context, ChargeActionReceiver::class.java).setAction(ACTION_TOGGLE)
    val togglePi =
        PendingIntent.getBroadcast(
            context,
            1,
            toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val st = style(context)
    val nm = context.getSystemService(NotificationManager::class.java)

    // --- stock text style: no RemoteViews at all -----------------------------
    if (st == Style.CLASSIC) {
      val classic =
          if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, chId)
          // Pre-O heads-up is governed by priority, not channels.
          else Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
      classic
          .setSmallIcon(R.drawable.voltrix_bolt)
          .setContentTitle("VOLTRIX · 67W fast charge")
          .setContentText(status)
          .setContentIntent(launchPi)
          .setAutoCancel(true)
          .apply { if (Build.VERSION.SDK_INT >= 26) setOnlyAlertOnce(true) }
          .addAction(
              R.drawable.voltrix_bolt,
              if (state == State.ACTIVE) "Turn off" else "Toggle",
              togglePi)
      nm.notify(NOTIF_ID, classic.build())
      return true
    }

    // --- custom RemoteViews styles ------------------------------------------
    val layout =
        when (st) {
          Style.ISLAND -> R.layout.notif_island
          Style.SLIM -> R.layout.notif_slim
          else -> R.layout.notif_voltrix
        }
    val rv = RemoteViews(context.packageName, layout)
    val text = if (st == Style.CARD) status else shortStatus
    rv.setTextViewText(R.id.notif_status, text)
    // RemoteViews has no setTextViewTextColor; the reflection setter is the standard way.
    rv.setInt(R.id.notif_status, "setTextColor", color)
    rv.setImageViewResource(R.id.notif_toggle, toggleIcon)
    // The small spinner stays visible the whole time — the card is "alive"
    // whenever it is on screen; the switch hides while the apply runs.
    rv.setViewVisibility(R.id.notif_progress, View.VISIBLE)
    rv.setViewVisibility(
        R.id.notif_toggle, if (state == State.ACTIVATING) View.GONE else View.VISIBLE)
    if (st == Style.ISLAND) {
      // Accent rim while fast charge is engaged — the island reacts to state.
      rv.setInt(
          R.id.notif_pill,
          "setBackgroundResource",
          if (state == State.ACTIVE) R.drawable.notif_pill_active else R.drawable.notif_pill)
    }
    rv.setOnClickPendingIntent(R.id.notif_toggle, togglePi)

    val builder =
        if (Build.VERSION.SDK_INT >= 26) {
          Notification.Builder(context, chId).setOnlyAlertOnce(true)
        } else Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
    builder
        .setSmallIcon(R.drawable.voltrix_bolt)
        .setContentTitle("VOLTRIX · 67W fast charge")
        .setContentText(text)
        .setContentIntent(launchPi)
        .setAutoCancel(true)
        .setCustomContentView(rv)

    nm.notify(NOTIF_ID, builder.build())
    return true
  }

  fun cancel(context: Context) {
    OverlayCard.hide(context)
    context.getSystemService(NotificationManager::class.java).cancel(NOTIF_ID)
  }

  /**
   * Creates both channels unconditionally — createNotificationChannel() is an
   * idempotent write, and re-issuing it right before notify() guarantees the
   * target exists even if a device-side sweep removed it. Nothing we post to
   * is ever deleted; the legacy v1.0.8 id is cleaned up best-effort instead
   * (deletion there can no longer eat the card, we never post to it).
   */
  private fun ensureChannels(context: Context, overlay: Boolean): String {
    if (Build.VERSION.SDK_INT < 26) return ""
    val nm = context.getSystemService(NotificationManager::class.java)

    val heads =
        NotificationChannel(CH_HEADS, "67W fast charge", NotificationManager.IMPORTANCE_HIGH)
    heads.setBypassDnd(true)
    heads.setSound(
        Uri.parse("content://settings/system/notification_sound"),
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build())
    heads.enableVibration(true)
    heads.vibrationPattern = longArrayOf(0, 60, 90, 60)
    heads.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC)
    heads.setShowBadge(false)
    nm.createNotificationChannel(heads)

    val shade =
        NotificationChannel(CH_SHADE, "67W charge status", NotificationManager.IMPORTANCE_DEFAULT)
    shade.setShowBadge(false)
    nm.createNotificationChannel(shade)

    try {
      if (nm.getNotificationChannel(CH_LEGACY) != null) {
        nm.deleteNotificationChannel(CH_LEGACY)
      }
    } catch (e: Exception) {
    }

    return if (overlay) CH_SHADE else CH_HEADS
  }
}
