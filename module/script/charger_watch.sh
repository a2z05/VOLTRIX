#!/system/bin/sh
# =================================================================
#  VOLTRIX — Charger Connect Watcher v1.0
#  Adaptive-interval, change-detection design. Uses MODDIR (a
#  known-stable path resolved once at startup) for self-relaunch
#  rather than $0.
#
#  Author: a2z
# =================================================================

CFGDIR=/data/adb/voltrix
CONFIG=$CFGDIR/config.sh
LOG=$CFGDIR/watcher.log
MODDIR=$(dirname "$0")
APPLY_SCRIPT="$MODDIR/charge.sh"

BATT=/sys/class/power_supply/battery

log() { echo "[$(date '+%T')] $*" >> "$LOG"; }

PKG=com.vnerxy.voltrix
# Surface the VOLTRIX card when the charger state changes. Root reaches the
# app's exported ShowCardReceiver; the app posts the notification itself, so
# a denied notification permission just means no card (silent, no error).
notify_card() {
    # Re-assert the overlay appop right before the card draws — root grant
    # replaces the manual "display over other apps" toggle entirely.
    /system/bin/appops set "$PKG" SYSTEM_ALERT_WINDOW allow >/dev/null 2>&1 || true
    if [ "$1" = "cancel" ]; then
        /system/bin/am broadcast -n "$PKG/.ShowCardReceiver" -a "$PKG.SHOW_CARD" --ez cancel true >/dev/null 2>&1
    else
        /system/bin/am broadcast -n "$PKG/.ShowCardReceiver" -a "$PKG.SHOW_CARD" --ez fast "$1" >/dev/null 2>&1
    fi
}

get_status() {
    [ -r "$BATT/status" ] && cat "$BATT/status" 2>/dev/null || echo "Unknown"
}

get_temp_raw() {
    [ -r "$BATT/temp" ] && cat "$BATT/temp" 2>/dev/null || echo ""
}

get_cap() {
    [ -r "$BATT/capacity" ] && cat "$BATT/capacity" 2>/dev/null || echo 0
}

CHARGING_POLL_SECONDS=60
TEMP_CHANGE_THRESHOLD_TENTHS=5
IDLE_POLL_SECONDS=300
AUTO_TRIGGER_ENABLED=true
[ -f "$CONFIG" ] && . "$CONFIG"
[ -n "$AUTO_TRIGGER_POLL_SECONDS" ] && CHARGING_POLL_SECONDS=$AUTO_TRIGGER_POLL_SECONDS
[ -n "$AUTO_TRIGGER_IDLE_POLL_SECONDS" ] && IDLE_POLL_SECONDS=$AUTO_TRIGGER_IDLE_POLL_SECONDS

if [ "$AUTO_TRIGGER_ENABLED" != "true" ]; then
    log "Auto-trigger disabled in config, watcher exiting immediately"
    exit 0
fi

log "Charger watcher starting (adaptive: ${CHARGING_POLL_SECONDS}s charging / ${IDLE_POLL_SECONDS}s idle)"

last_status=$(get_status)
last_temp_raw=$(get_temp_raw)
last_full_apply_ts=0
night_target_hit=0
night_suspended=0
checks=0
MAX_CHECKS=4000

while [ "$checks" -lt "$MAX_CHECKS" ]; do
    if [ "$last_status" = "Charging" ] || [ "$last_status" = "Full" ]; then
        sleep "$CHARGING_POLL_SECONDS"
    else
        sleep "$IDLE_POLL_SECONDS"
    fi

    AUTO_TRIGGER_ENABLED=true
    CHARGING_POLL_SECONDS=60
    IDLE_POLL_SECONDS=300
    [ -f "$CONFIG" ] && . "$CONFIG"
    [ -n "$AUTO_TRIGGER_POLL_SECONDS" ] && CHARGING_POLL_SECONDS=$AUTO_TRIGGER_POLL_SECONDS
    [ -n "$AUTO_TRIGGER_IDLE_POLL_SECONDS" ] && IDLE_POLL_SECONDS=$AUTO_TRIGGER_IDLE_POLL_SECONDS

    if [ "$AUTO_TRIGGER_ENABLED" != "true" ]; then
        log "Auto-trigger disabled mid-run, watcher exiting"
        exit 0
    fi

    current_status=$(get_status)
    now_ts=$(date +%s)

    case "$current_status" in
        Charging|Full)
            if [ "$last_status" != "Charging" ] && [ "$last_status" != "Full" ]; then
                log "Charger connected (was: $last_status) — full apply"
                sh "$APPLY_SCRIPT" >> "$LOG" 2>&1
                last_full_apply_ts=$now_ts
                if [ "$(cat /data/adb/voltrix/thermal_gate_state 2>/dev/null)" = "1" ]; then
                    notify_card true
                else
                    notify_card false
                fi
            else
                current_temp_raw=$(get_temp_raw)
                temp_changed=0
                if [ -n "$current_temp_raw" ] && [ -n "$last_temp_raw" ]; then
                    diff=$((current_temp_raw - last_temp_raw))
                    [ "$diff" -lt 0 ] && diff=$((0 - diff))
                    [ "$diff" -ge "$TEMP_CHANGE_THRESHOLD_TENTHS" ] && temp_changed=1
                fi
                time_since_last=$((now_ts - last_full_apply_ts))
                recheck_after=600
                if [ "$NIGHT_ENABLED" = "true" ] 2>/dev/null; then
                    # Night schedule active: recheck twice as often so phase
                    # flips (slow -> final hour) land within 5 minutes, and
                    # fire ONE apply the moment the target is reached so the
                    # module suspends there instead of coasting past it.
                    recheck_after=300
                    ncap=$(get_cap)
                    if [ "$ncap" -lt "$NIGHT_TARGET" ] 2>/dev/null; then
                        night_suspended=0
                    elif [ "$night_suspended" = "0" ]; then
                        night_target_hit=1
                    fi
                fi
                if [ "$temp_changed" = "1" ] || [ "$night_target_hit" = "1" ] || [ "$time_since_last" -ge "$recheck_after" ]; then
                    log "Re-check (temp=$temp_changed hit=${night_target_hit}x, ${time_since_last}s since last) — full apply"
                    sh "$APPLY_SCRIPT" >> "$LOG" 2>&1
                    last_full_apply_ts=$now_ts
                    last_temp_raw=$current_temp_raw
                    night_target_hit=0
                    [ "${ncap:-0}" -ge "${NIGHT_TARGET:-999}" ] 2>/dev/null && night_suspended=1
                fi
            fi
            ;;
        *)
            if [ "$last_status" = "Charging" ] || [ "$last_status" = "Full" ]; then
                log "Charger disconnected — restoring thermal protection"
                sh "$APPLY_SCRIPT" >> "$LOG" 2>&1
                notify_card cancel
            fi
            ;;
    esac

    # Refresh state.json each cycle — the app polls it for live numbers
    # (edge applies already rewrite it; this keeps idle + steady phases fresh).
    sh "$APPLY_SCRIPT" --state-only >> "$LOG" 2>&1

    last_status="$current_status"
    checks=$((checks + 1))
    [ $((checks % 200)) -eq 0 ] && { tail -300 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"; }
done

log "Watcher reached check limit, relaunching fresh instance"
WATCHER_SELF_PATH="$MODDIR/charger_watch.sh"
if [ -f "$WATCHER_SELF_PATH" ]; then
    nohup sh "$WATCHER_SELF_PATH" >> "$LOG" 2>&1 &
    log "Relaunched via stable path (PID $!)"
else
    nohup sh "$0" >> "$LOG" 2>&1 &
fi
exit 0
