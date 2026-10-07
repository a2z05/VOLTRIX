package com.vnerxy.voltrix

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * True overlay card: a TYPE_APPLICATION_OVERLAY window drawn above every app,
 * shown whenever the notification pipeline would show the card. Unlike the
 * heads-up notification, overlay windows are not gated by MIUI's floating
 * alerts, notification permission, or DND — only by "display over other
 * apps" (SYSTEM_ALERT_WINDOW), which the Settings screen can grant.
 *
 * Contract with [NotificationHelper.show]:
 *   - show() returns false when the permission is missing; the caller then
 *     falls back to the heads-up channel as before.
 *   - When it returns true, the card is drawn (synchronously on the main
 *     thread, posted when called from a worker) and the notification is only
 *     posted to the silent shade channel, so nothing double-pops.
 *
 * Lifetime: created on charger connect, updated on every state change,
 * removed on cancel broadcast, tap, close button, or a 45-minute safety
 * timeout (a dead watcher must never leave a stuck window). Battery text
 * updates live from ACTION_BATTERY_CHANGED while visible. Window work is
 * main-thread only; show()/hide() marshal as needed.
 */
object OverlayCard {

  private const val AUTO_HIDE_MS = 45L * 60L * 1000L

  private val main = Handler(Looper.getMainLooper())
  private var wm: WindowManager? = null
  private var card: LinearLayout? = null
  private var statusView: TextView? = null
  private var battView: TextView? = null
  private var chip: TextView? = null
  private var accentBg: GradientDrawable? = null
  private var battReceiver: BroadcastReceiver? = null
  private var regCtx: Context? = null
  private val autoHide = Runnable { animateOut() }

  private val C_BG = 0xF012141C.toInt()
  private val C_SUB = 0xFF9498B3.toInt()
  private val C_TEXT = 0xFFFFFFFF.toInt()
  private val C_OK = 0xFF3DDC97.toInt()
  private val C_WARN = 0xFFFFD23F.toInt()
  private val C_ACCENT = 0xFF5E7CFF.toInt()
  private val C_BAD = 0xFFFF5C72.toInt()

  /**
   * True when the overlay will (or already does) cover the card. Answers
   * synchronously so [NotificationHelper.show] can pick the notification
   * channel in the same call.
   */
  fun show(context: Context, state: NotificationHelper.State): Boolean {
    if (!Settings.canDrawOverlays(context)) return false
    val app = context.applicationContext
    return if (Looper.myLooper() == Looper.getMainLooper()) {
      showNow(app, state)
    } else {
      main.post { showNow(app, state) }
      true
    }
  }

  fun hide(context: Context) {
    if (Looper.myLooper() == Looper.getMainLooper()) animateOut()
    else main.post { animateOut() }
  }

  // ---- main thread ---------------------------------------------------------

  private fun showNow(ctx: Context, state: NotificationHelper.State): Boolean {
    try {
      val fresh = card == null
      // First show: addCard() starts the entrance animation — don't snap it away.
      if (fresh) addCard(ctx)
      applyState(state)
      registerBattery(ctx)
      val v = card ?: return false
      if (!fresh) {
        // Re-show: cancel any pending hide, then pulse in so a state change
        // (question -> active) reads as reactive instead of a hard cut.
        v.animate().setListener(null).cancel()
        val d = ctx.resources.displayMetrics.density
        v.alpha = 0.35f
        v.translationY = -8f * d
        v.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(200)
            .setInterpolator(android.view.animation.DecelerateInterpolator())
            .start()
      }
      main.removeCallbacks(autoHide)
      main.postDelayed(autoHide, AUTO_HIDE_MS)
      return true
    } catch (e: Exception) {
      removeNow()
      return false
    }
  }

  private fun addCard(ctx: Context) {
    val dm = ctx.resources.displayMetrics
    fun dp(v: Int): Int = (v * dm.density + 0.5f).toInt()

    val root = LinearLayout(ctx)
    root.orientation = LinearLayout.HORIZONTAL
    root.gravity = Gravity.CENTER_VERTICAL
    root.setPadding(dp(14), dp(9), dp(12), dp(9))
    val bg =
        GradientDrawable().apply {
          cornerRadius = dp(24).toFloat()
          setColor(C_BG)
          setStroke(dp(1), C_ACCENT)
        }
    root.background = bg
    root.elevation = dp(6).toFloat()

    val icon = ImageView(ctx)
    icon.setImageResource(R.drawable.voltrix_bolt)
    root.addView(icon, LinearLayout.LayoutParams(dp(20), dp(20)).apply { rightMargin = dp(10) })

    val col = LinearLayout(ctx)
    col.orientation = LinearLayout.VERTICAL
    val title =
        TextView(ctx).apply {
          text = "VOLTRIX · 67W fast charge"
          setTextColor(C_SUB)
          textSize = 11f
        }
    val status =
        TextView(ctx).apply {
          setTextColor(C_TEXT)
          textSize = 14f
          typeface = Typeface.DEFAULT_BOLD
        }
    col.addView(title)
    col.addView(status)
    root.addView(col, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

    val batt =
        TextView(ctx).apply {
          setTextColor(C_SUB)
          textSize = 12f
          text = ""
        }
    root.addView(batt, LinearLayout.LayoutParams(WRAP(), WRAP()).apply { rightMargin = dp(8) })

    val toggle =
        TextView(ctx).apply {
          text = "67W"
          setTextColor(C_TEXT)
          textSize = 12f
          typeface = Typeface.DEFAULT_BOLD
          setPadding(dp(12), dp(5), dp(12), dp(5))
          background =
              GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(Color.TRANSPARENT)
                setStroke(dp(1), C_ACCENT)
              }
          setOnClickListener {
            try {
              toggleIntent(it.context).send()
            } catch (e: Exception) {
              // PendingIntent cancelled — nothing to toggle.
            }
          }
        }
    root.addView(toggle, LinearLayout.LayoutParams(WRAP(), WRAP()).apply { rightMargin = dp(6) })

    val close =
        TextView(ctx).apply {
          text = "✕"
          setTextColor(C_SUB)
          textSize = 15f
          setPadding(dp(8), dp(4), dp(2), dp(4))
          setOnClickListener { animateOut() }
        }
    root.addView(close, LinearLayout.LayoutParams(WRAP(), WRAP()))

    root.setOnClickListener {
      openApp(it.context)
      animateOut()
    }

    val windowManager = ctx.getSystemService(WindowManager::class.java)
    val lp =
        WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT)
    lp.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
    lp.y = dp(44)
    windowManager.addView(root, lp)

    // Only after the window is actually attached.
    wm = windowManager
    card = root
    statusView = status
    battView = batt
    chip = toggle
    accentBg = bg

    root.translationY = -dp(120).toFloat()
    root.alpha = 0f
    root.animate()
        .translationY(0f)
        .alpha(1f)
        .setDuration(300)
        .setInterpolator(OvershootInterpolator(1.06f))
        .start()
  }

  private fun applyState(state: NotificationHelper.State) {
    val (text, color) =
        when (state) {
          NotificationHelper.State.ACTIVE -> "67W fast charge ON" to C_OK
          NotificationHelper.State.QUESTION -> "Fast charge ready — tap 67W" to C_WARN
          NotificationHelper.State.ACTIVATING -> "Applying…" to C_ACCENT
          NotificationHelper.State.NOT_CHARGING -> "Connect the charger first" to C_SUB
          NotificationHelper.State.FAILED -> "Couldn't enable — check the log" to C_BAD
        }
    statusView?.setTextColor(color)
    statusView?.text = text
    val density = card?.resources?.displayMetrics?.density ?: 1f
    val stroke = (density + 0.5f).toInt().coerceAtLeast(1)
    accentBg?.setStroke(stroke, color)
    chip?.visibility = if (state == NotificationHelper.State.ACTIVATING) View.GONE else View.VISIBLE
    (chip?.background as? GradientDrawable)?.setStroke(stroke, color)
    chip?.setTextColor(color)
  }

  private fun registerBattery(ctx: Context) {
    if (battReceiver != null) return
    val receiver =
        object : BroadcastReceiver() {
          override fun onReceive(c: Context, i: Intent) {
            val level = i.getIntExtra("level", -1)
            val scale = i.getIntExtra("scale", 100)
            if (level >= 0 && scale > 0) battView?.text = "Battery ${level * 100 / scale}%"
          }
        }
    try {
      ctx.registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      battReceiver = receiver
      regCtx = ctx
      // Prime immediately with the sticky value so the card is never blank.
      ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))?.let {
        receiver.onReceive(ctx, it)
      }
    } catch (e: Exception) {
      battReceiver = null
      regCtx = null
    }
  }

  private fun unregisterBattery() {
    val r = battReceiver ?: return
    val c = regCtx
    battReceiver = null
    regCtx = null
    if (c != null) {
      try {
        c.unregisterReceiver(r)
      } catch (e: Exception) {
      }
    }
  }

  private fun animateOut() {
    val v = card ?: return
    main.removeCallbacks(autoHide)
    val density = v.resources.displayMetrics.density
    v.animate().setListener(null).cancel()
    v.animate()
        .translationY(-(100 * density).toFloat())
        .alpha(0f)
        .setDuration(200)
        .setListener(
            object : AnimatorListenerAdapter() {
              override fun onAnimationEnd(animation: Animator) {
                removeNow()
              }
            })
        .start()
  }

  private fun removeNow() {
    main.removeCallbacks(autoHide)
    val v = card
    card = null
    val window = wm
    wm = null
    statusView = null
    battView = null
    chip = null
    accentBg = null
    unregisterBattery()
    if (v != null && window != null) {
      try {
        window.removeView(v)
      } catch (e: Exception) {
      }
    }
  }

  private fun toggleIntent(context: Context): PendingIntent {
    val intent =
        Intent(context, ChargeActionReceiver::class.java).setAction(NotificationHelper.ACTION_TOGGLE)
    return PendingIntent.getBroadcast(
        context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun openApp(context: Context) {
    try {
      val launch =
          context.packageManager.getLaunchIntentForPackage(context.packageName)
              ?: Intent(context, MainActivity::class.java)
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      context.startActivity(launch)
    } catch (e: Exception) {
      // No launchable activity — dismissing still works.
    }
  }

  private fun WRAP(): Int = ViewGroup.LayoutParams.WRAP_CONTENT
}
