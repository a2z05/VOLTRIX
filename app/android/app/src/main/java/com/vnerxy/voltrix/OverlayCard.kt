package com.vnerxy.voltrix

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

// ---- palette (mirrors app/src/theme.ts — Linear-style precision dark UI) ----
private val C_BG_TOP = 0xFF1B1D22.toInt() // surface, luminance-stacked
private val C_BG_BOTTOM = 0xFF101114.toInt() // panel — deeper = darker
private val C_RIM_A = 0x2EFFFFFF // hairline rim, 18% white at the leading edge
private val C_RIM_B = 0x0AFFFFFF // fading to 4% toward the trailing edge
private val C_TEXT = 0xFFF7F8F8.toInt() // primary
private val C_TEXT2 = 0xFFD0D6E0.toInt() // secondary
private val C_TEXT3 = 0xFF8A8F98.toInt() // muted
private val C_TEXT4 = 0xFF62666D.toInt() // micro labels
private val C_BORDER = 0x14FFFFFF // rgba(255,255,255,0.08) — separators
private val C_SURFACE2 = 0xFF28282C.toInt() // pressed / inert fill
private val C_ACCENT = 0xFF5E6AD2.toInt() // brand indigo
private val C_ACCENT_BRIGHT = 0xFF7170FF.toInt() // interactive accent
private val C_ACCENT_SOFT = 0x247170FF.toInt() // accentSoft — tinted fill
private val C_OK = 0xFF10B981.toInt() // emerald — active / success
private val C_BAD = 0xFFEB5757.toInt() // failure / danger
private val C_RIPPLE_LIGHT = 0x33FFFFFF // ripple on filled surfaces
private val C_RIPPLE_DARK = 0x1AFFFFFF // ripple on outlined surfaces

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
 *   - When it returns true the card is (or will be) drawn. On the main
 *     thread the answer is exact: addView runs before we answer. Off the
 *     main thread the draw is posted, so the answer is the best synchronous
 *     truth available — and if that deferred draw later throws, showNow
 *     falls back to [NotificationHelper.show] itself under a re-entrancy
 *     guard, which makes the re-entrant OverlayCard.show return false
 *     immediately so the caller posts to the audible heads-up channel
 *     instead of recursing back into the overlay. The user sees the card
 *     (overlay or heads-up), never nothing.
 *
 * Lock screen: a charger is usually plugged in while the screen is off, so
 * the window carries FLAG_SHOW_WHEN_LOCKED — without it the card is simply
 * invisible until the user unlocks, which reads as "it never showed".
 * FLAG_KEEP_SCREEN_ON is deliberately NOT set: the card must not keep the
 * screen alive.
 *
 * Lifetime: created on charger connect, updated on every state change,
 * removed on cancel broadcast, tap, close button, or a 45-minute safety
 * timeout (a dead watcher must never leave a stuck window). Battery percent
 * and temperature update live from ACTION_BATTERY_CHANGED while visible.
 * Window work is main-thread only; show()/hide() marshal as needed.
 *
 * Look: one horizontal composition on a luminance-stacked dark surface —
 * accent bolt chip, tracked uppercase micro-label, one strong status line
 * with a state marker (dot / spinner), a right-aligned monospace readout
 * row (percent · °C · watts, tabular so digits never dance), and a single
 * 67W action pill (filled when actionable, outlined while engaged).
 * Colour discipline: accent and status colours carry meaning only — the
 * state marker, the status line, and the pill; everything else is greyscale.
 */
object OverlayCard {

  private const val AUTO_HIDE_MS = 45L * 60L * 1000L
  private const val TEMP_UNKNOWN = Int.MIN_VALUE

  private val main = Handler(Looper.getMainLooper())
  private var wm: WindowManager? = null
  private var card: FrameLayout? = null
  private var statusView: TextView? = null
  private var battView: TextView? = null
  private var pill: TextView? = null
  private var marker: StateMarker? = null
  private var battReceiver: BroadcastReceiver? = null
  private var regCtx: Context? = null
  private val autoHide = Runnable { animateOut() }

  private var battPct = -1
  private var battTempC = TEMP_UNKNOWN
  private var wattLabel = "–"
  private var lastState: NotificationHelper.State? = null

  /** Density captured when the card is built; dp() must never need a Context. */
  private var density = 1f

  /**
   * Re-entrancy guard for the failure fallback: while we are inside our own
   * [NotificationHelper.show] call, a nested OverlayCard.show must answer
   * false at once — never draw again — so the caller picks the heads-up
   * channel instead of looping. Volatile: show() is called from workers.
   */
  @Volatile private var inFallback = false

  /**
   * True when the overlay will (or already does) cover the card. Answers
   * synchronously so [NotificationHelper.show] can pick the notification
   * channel in the same call.
   */
  fun show(context: Context, state: NotificationHelper.State): Boolean {
    if (inFallback) return false // re-entrant call from our own fallback
    if (!Settings.canDrawOverlays(context)) return false
    val app = context.applicationContext
    return if (Looper.myLooper() == Looper.getMainLooper()) {
      showNow(app, state, selfFallback = false)
    } else {
      // The caller already chose the silent shade channel based on `true`;
      // post the draw to the main thread. If it fails there, showNow posts
      // the heads-up notification itself (guarded, so no recursion) — the
      // returned `true` is backed by a real fallback, not a hope.
      main.post { showNow(app, state, selfFallback = true) }
      true
    }
  }

  fun hide(context: Context) {
    if (Looper.myLooper() == Looper.getMainLooper()) animateOut()
    else main.post { animateOut() }
  }

  // ---- main thread ---------------------------------------------------------

  private fun showNow(
      ctx: Context,
      state: NotificationHelper.State,
      selfFallback: Boolean
  ): Boolean {
    val fresh = card == null
    if (fresh) {
      val drew =
          try {
            addCard(ctx)
            true
          } catch (e: Exception) {
            false
          }
      if (!drew || card == null) {
        removeNow()
        // Synchronous path: returning false makes the caller post the
        // heads-up itself. Async path: the caller already got `true`, so we
        // post it ourselves — under the guard, so this cannot recurse.
        if (selfFallback) fallbackToNotification(ctx, state)
        return false
      }
    }
    try {
      applyState(state)
      registerBattery(ctx)
    } catch (e: Exception) {
      // Presentation-only failure (e.g. a resource quirk): the window is
      // attached, keep it up rather than blanking a working card.
    }
    val v = card ?: run {
      if (selfFallback) fallbackToNotification(ctx, state)
      return false
    }
    if (!fresh) {
      // Re-show: cancel any pending exit, then pulse so a state change
      // (question -> active) reads as reactive instead of a hard cut.
      v.animate().setListener(null).cancel()
      v.translationY = 0f
      v.alpha = 0.84f
      v.animate().alpha(1f).setDuration(160).setInterpolator(DecelerateInterpolator()).start()
    }
    main.removeCallbacks(autoHide)
    main.postDelayed(autoHide, AUTO_HIDE_MS)
    return true
  }

  /**
   * The caller believed us (`true` -> silent shade channel) and the deferred
   * draw then failed. Post the notification ourselves: the re-entrant
   * [show] hits [inFallback] and returns false at once, so
   * [NotificationHelper.show] picks the audible heads-up channel instead of
   * drawing the overlay again.
   */
  private fun fallbackToNotification(ctx: Context, state: NotificationHelper.State) {
    if (inFallback) return
    inFallback = true
    try {
      NotificationHelper.show(ctx, state)
    } catch (e: Exception) {
      // Nothing left to fall back to; the card is gone and so is the toast.
    } finally {
      inFallback = false
    }
  }

  private fun addCard(ctx: Context) {
    val dm = ctx.resources.displayMetrics
    density = dm.density

    // Deliberately inset: full screen width minus a gutter, capped so the
    // card stays glanceable instead of stretching edge to edge on tablets.
    val winW = (dm.widthPixels - dp(20f) * 2).coerceAtMost(dp(420f)).coerceAtLeast(dp(240f))

    val root = FrameLayout(ctx)
    val radius = dp(22f).toFloat()
    root.addView(
        CardSurface(ctx, radius, dp(1f).toFloat()),
        FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    // Elevation shadow comes from the container's rounded-rect outline, so
    // it lifts off whatever app is underneath.
    root.outlineProvider =
        object : ViewOutlineProvider() {
          override fun getOutline(view: View, outline: Outline) {
            outline.setRoundRect(0, 0, view.width, view.height, radius)
            outline.alpha = 1f
          }
        }
    root.elevation = dp(14f).toFloat()
    root.setOnClickListener {
      openApp(it.context)
      animateOut()
    }

    val content = LinearLayout(ctx)
    content.orientation = LinearLayout.HORIZONTAL
    content.gravity = Gravity.CENTER_VERTICAL
    content.setPadding(dp(14f), dp(11f), dp(10f), dp(11f))
    root.addView(
        content,
        FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    // The one accent moment: brand bolt in a soft accent-tinted chip.
    val icon = ImageView(ctx)
    icon.setImageResource(R.drawable.voltrix_bolt)
    icon.scaleType = ImageView.ScaleType.CENTER_INSIDE
    icon.imageTintList = ColorStateList.valueOf(C_ACCENT_BRIGHT)
    icon.background =
        GradientDrawable().apply {
          cornerRadius = dp(9f).toFloat()
          setColor(C_ACCENT_SOFT)
        }
    content.addView(
        icon,
        LinearLayout.LayoutParams(dp(28f), dp(28f)).apply { rightMargin = dp(12f) })

    val col = LinearLayout(ctx)
    col.orientation = LinearLayout.VERTICAL
    val label =
        TextView(ctx).apply {
          text = "VOLTRIX · FAST CHARGE"
          textSize = 10f
          letterSpacing = 0.09f // tracked micro-label
          setTextColor(C_TEXT4)
          typeface = Typeface.DEFAULT_BOLD
          maxLines = 1
          ellipsize = TextUtils.TruncateAt.END
        }
    val statusRow = LinearLayout(ctx)
    statusRow.orientation = LinearLayout.HORIZONTAL
    statusRow.gravity = Gravity.CENTER_VERTICAL
    val stateMarker = StateMarker(ctx, dp(4.5f).toFloat(), C_ACCENT_BRIGHT)
    val status =
        TextView(ctx).apply {
          textSize = 15f
          typeface = Typeface.DEFAULT_BOLD
          setTextColor(C_TEXT)
          setSingleLine(true)
          ellipsize = TextUtils.TruncateAt.END
        }
    statusRow.addView(
        stateMarker, LinearLayout.LayoutParams(dp(11f), dp(11f)).apply { rightMargin = dp(7f) })
    statusRow.addView(
        status, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    col.addView(label)
    col.addView(
        statusRow, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(3f) })
    content.addView(
        col, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

    // Right-aligned tabular readouts — monospace digits with padded fields,
    // so percent / °C / watts never shift the layout when they change.
    val readout =
        TextView(ctx).apply {
          textSize = 12f
          typeface = Typeface.MONOSPACE
          setTextColor(C_TEXT2)
          gravity = Gravity.END
          setSingleLine(true)
          minWidth = dp(92f)
        }
    val group = LinearLayout(ctx)
    group.orientation = LinearLayout.HORIZONTAL
    group.gravity = Gravity.CENTER_VERTICAL
    group.addView(
        View(ctx).apply { setBackgroundColor(C_BORDER) },
        LinearLayout.LayoutParams(dp(1f), dp(18f)).apply {
          leftMargin = dp(10f)
          rightMargin = dp(10f)
        })
    group.addView(readout, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    content.addView(group)

    // Single primary action: the 67W pill. Filled while it can do something,
    // outlined while fast charge is already engaged (ripple = real press).
    val toggle =
        TextView(ctx).apply {
          text = "67W"
          textSize = 12f
          typeface = Typeface.DEFAULT_BOLD
          gravity = Gravity.CENTER
          setPadding(dp(13f), dp(6f), dp(13f), dp(6f))
          setOnClickListener {
            try {
              toggleIntent(it.context).send()
            } catch (e: Exception) {
              // PendingIntent cancelled — nothing to toggle.
            }
          }
        }
    content.addView(
        toggle,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(10f) })

    val close =
        TextView(ctx).apply {
          text = "✕"
          textSize = 14f
          setTextColor(C_TEXT3)
          gravity = Gravity.CENTER
          setPadding(dp(8f), dp(6f), dp(6f), dp(6f))
          foreground =
              RippleDrawable(
                  ColorStateList.valueOf(C_RIPPLE_DARK),
                  null,
                  GradientDrawable().apply {
                    cornerRadius = dp(10f).toFloat()
                    setColor(Color.WHITE)
                  })
          setOnClickListener { animateOut() }
        }
    content.addView(
        close, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    val windowManager = ctx.getSystemService(WindowManager::class.java)
    val lp =
        WindowManager.LayoutParams(
            winW,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                // Visible over the keyguard: the charger usually lands while
                // the screen is off, and a card that waits for unlock reads
                // as "it never showed". Deprecated since API 27 but still
                // honoured everywhere and the only spelling that compiles
                // against minSdk 24. FLAG_KEEP_SCREEN_ON is intentionally
                // absent — the card must never keep the screen awake.
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
            PixelFormat.TRANSLUCENT)
    lp.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
    lp.y = dp(52f) // clear the status bar
    windowManager.addView(root, lp)

    // Only after the window is actually attached.
    wm = windowManager
    card = root
    statusView = status
    battView = readout
    pill = toggle
    marker = stateMarker
    lastState = null
    battPct = -1
    battTempC = TEMP_UNKNOWN

    // Entrance: fade + a small rise, short and decelerating. No overshoot —
    // system UI does not bounce.
    root.translationY = dp(10f).toFloat()
    root.alpha = 0f
    root.animate()
        .translationY(0f)
        .alpha(1f)
        .setDuration(220)
        .setInterpolator(DecelerateInterpolator())
        .start()
  }

  private fun applyState(state: NotificationHelper.State) {
    val (text, color) =
        when (state) {
          NotificationHelper.State.ACTIVE -> "67W fast charging" to C_OK
          NotificationHelper.State.QUESTION -> "Ready — tap 67W" to C_ACCENT_BRIGHT
          NotificationHelper.State.ACTIVATING -> "Applying 67W…" to C_ACCENT_BRIGHT
          NotificationHelper.State.NOT_CHARGING -> "Connect the charger" to C_TEXT2
          NotificationHelper.State.FAILED -> "Couldn't enable — open app" to C_BAD
        }
    val s = statusView
    s?.setTextColor(color)
    s?.text = text
    wattLabel =
        when (state) {
          NotificationHelper.State.ACTIVE -> "67W"
          NotificationHelper.State.ACTIVATING -> " …"
          else -> " –"
        }
    refreshReadout()
    marker?.setColor(color)
    marker?.setSpinning(state == NotificationHelper.State.ACTIVATING)
    stylePill(state)
    if (lastState != state && s != null) {
      // Brief pulse on an actual state change only — a silent in-place morph.
      s.animate().cancel()
      s.alpha = 0.3f
      s.animate().alpha(1f).setDuration(170).setInterpolator(DecelerateInterpolator()).start()
    }
    lastState = state
  }

  /** Pill styling per state — filled when actionable, outlined when engaged. */
  private fun stylePill(state: NotificationHelper.State) {
    val p = pill ?: return
    p.visibility = if (state == NotificationHelper.State.ACTIVATING) View.GONE else View.VISIBLE
    if (p.visibility != View.VISIBLE) return
    val d = p.resources.displayMetrics.density
    fun dpv(v: Float): Int = (v * d + 0.5f).toInt()
    val radius = dpv(15f).toFloat()
    val fill: Int
    val strokeCol: Int
    val strokeW: Int
    val textColor: Int
    val ripple: Int
    when (state) {
      NotificationHelper.State.ACTIVE -> {
        fill = Color.TRANSPARENT
        strokeCol = C_OK
        strokeW = dpv(1f)
        textColor = C_OK
        ripple = C_RIPPLE_DARK
      }
      NotificationHelper.State.NOT_CHARGING,
      NotificationHelper.State.FAILED -> {
        fill = C_SURFACE2
        strokeCol = Color.TRANSPARENT
        strokeW = 0
        textColor = C_TEXT3
        ripple = C_RIPPLE_DARK
      }
      else -> {
        fill = C_ACCENT
        strokeCol = Color.TRANSPARENT
        strokeW = 0
        textColor = C_TEXT
        ripple = C_RIPPLE_LIGHT
      }
    }
    val base =
        GradientDrawable().apply {
          cornerRadius = radius
          setColor(fill)
          if (strokeW > 0) setStroke(strokeW, strokeCol)
        }
    val mask =
        GradientDrawable().apply {
          cornerRadius = radius
          setColor(Color.WHITE)
        }
    p.background =
        RippleDrawable(ColorStateList.valueOf(ripple), base, mask)
    p.setTextColor(textColor)
  }

  /** Percent · °C · watts — monospace, fixed field widths, right-aligned. */
  private fun refreshReadout() {
    val v = battView ?: return
    val pct = if (battPct >= 0) String.format(Locale.US, "%2d%%", battPct) else "  —"
    val temp = if (battTempC != TEMP_UNKNOWN) String.format(Locale.US, "%2d°C", battTempC) else "  —"
    v.text = "$pct · $temp · $wattLabel"
  }

  private fun registerBattery(ctx: Context) {
    if (battReceiver != null) return
    val receiver =
        object : BroadcastReceiver() {
          override fun onReceive(c: Context, i: Intent) {
            val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
            if (level >= 0 && scale > 0) battPct = level * 100 / scale
            val tenths = i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, TEMP_UNKNOWN)
            if (tenths != TEMP_UNKNOWN) battTempC = (tenths + 5) / 10
            refreshReadout()
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
    v.animate().setListener(null).cancel()
    v.animate()
        .translationY(-dp(8f).toFloat())
        .alpha(0f)
        .setDuration(200)
        .setInterpolator(DecelerateInterpolator())
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
    pill = null
    marker = null
    lastState = null
    battPct = -1
    battTempC = TEMP_UNKNOWN
    wattLabel = "–"
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

  private fun dp(v: Float): Int = (v * density + 0.5f).toInt()

  // ---- views ---------------------------------------------------------------

  /** Card background: luminance-stacked fill + hairline rim fading to one side. */
  private class CardSurface(ctx: Context, private val radius: Float, rimWidth: Float) :
      View(ctx) {
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rim =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
          style = Paint.Style.STROKE
          strokeWidth = rimWidth
        }
    private val rect = RectF()

    override fun onDraw(canvas: Canvas) {
      if (width <= 0 || height <= 0) return
      rect.set(rim.strokeWidth / 2f, rim.strokeWidth / 2f,
          width - rim.strokeWidth / 2f, height - rim.strokeWidth / 2f)
      fill.shader =
          LinearGradient(
              0f, 0f, 0f, height.toFloat(), C_BG_TOP, C_BG_BOTTOM, Shader.TileMode.CLAMP)
      canvas.drawRoundRect(rect, radius, radius, fill)
      rim.shader =
          LinearGradient(
              0f, 0f, width.toFloat(), 0f, C_RIM_A, C_RIM_B, Shader.TileMode.CLAMP)
      canvas.drawRoundRect(rect, radius, radius, rim)
    }
  }

  /**
   * State marker: a filled dot in the state colour; while the apply runs it
   * becomes a small indeterminate arc. Pulses briefly whenever the colour
   * actually changes.
   */
  private class StateMarker(ctx: Context, private val r: Float, startColor: Int) : View(ctx) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var color = startColor
    private var spinning = false
    private var rotation = 0f
    private var spinAnim: ValueAnimator? = null

    fun setColor(c: Int) {
      if (c == color) return
      color = c
      pulse()
      invalidate()
    }

    fun setSpinning(on: Boolean) {
      if (on == spinning) return
      spinning = on
      if (on) {
        spinAnim =
            ValueAnimator.ofFloat(0f, 360f).apply {
              duration = 900
              repeatCount = ValueAnimator.INFINITE
              repeatMode = ValueAnimator.RESTART
              interpolator = LinearInterpolator()
              addUpdateListener {
                rotation = it.animatedValue as Float
                invalidate()
              }
              start()
            }
      } else {
        spinAnim?.cancel()
        spinAnim = null
        rotation = 0f
        pulse()
        invalidate()
      }
    }

    private fun pulse() {
      animate().cancel()
      alpha = 0.25f
      animate().alpha(1f).setDuration(320).setInterpolator(DecelerateInterpolator()).start()
    }

    override fun onDraw(canvas: Canvas) {
      val cx = width / 2f
      val cy = height / 2f
      paint.color = color
      if (spinning) {
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = r * 0.85f
        paint.strokeCap = Paint.Cap.ROUND
        canvas.drawArc(cx - r, cy - r, cx + r, cy + r, rotation, 250f, true, paint)
      } else {
        paint.style = Paint.Style.FILL
        canvas.drawCircle(cx, cy, r * 0.62f, paint)
      }
    }

    override fun onDetachedFromWindow() {
      super.onDetachedFromWindow()
      spinAnim?.cancel()
      spinAnim = null
    }
  }
}
