#!/system/bin/sh
# =================================================================
#  VOLTRIX — Main Apply Script v1.0
#
#  Applies the charging profile, releases Xiaomi throttles, runs the
#  thermal gate (hysteresis between THERMAL_COOL_C and THERMAL_HOT_C)
#  and writes state.json for the companion app. The idle path
#  explicitly forces thermal protection back on.
#
#  ALWAYS_FAST=true keeps the gate open up to THERMAL_HOT_C without
#  needing an app-triggered apply first.
#
#  Author: a2z
# =================================================================

CFGDIR=/data/adb/voltrix
CONFIG=$CFGDIR/config.sh
STATE=$CFGDIR/state.json
LOG=$CFGDIR/daemon.log
# Rotate once past 256KB — periodic state refreshes add lines every cycle.
if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 262144 ] 2>/dev/null; then
    mv "$LOG" "$LOG.1" 2>/dev/null
fi
BACKUP_DIR=$CFGDIR/backup

BATT=/sys/class/power_supply/battery
QB=/sys/class/qcom-battery
USB=/sys/class/power_supply/usb

UCSI=""
discover_ucsi_path() {
    for d in /sys/class/power_supply/ucsi-source-psy*; do
        [ -d "$d" ] && { UCSI="$d"; return; }
    done
}

mkdir -p "$BACKUP_DIR"
log() { echo "[$(date '+%T')] $*" >> "$LOG"; }

to_num() {
    local v="$1"
    case "$v" in
        ''|*[!0-9-]*) echo 0 ;;
        *) echo "$v" ;;
    esac
}

rd() { [ -r "$1" ] && cat "$1" 2>/dev/null || echo ""; }

path_key() {
    local p="$1" sum=0 i c len
    len=${#p}
    i=0
    while [ $i -lt "$len" ]; do
        c=$(printf '%d' "'$(echo "$p" | cut -c$((i+1)))" 2>/dev/null)
        [ -z "$c" ] && c=0
        sum=$((sum + c + i))
        i=$((i+1))
    done
    echo "k${sum}_${len}"
}

safe_write() {
    local file="$1" value="$2"
    [ ! -e "$file" ] && return 1
    [ ! -w "$file" ] && return 1

    local backup_file
    backup_file="$BACKUP_DIR/$(path_key "$file")"
    if [ ! -f "$backup_file" ]; then
        { echo "$file"; cat "$file" 2>/dev/null; } > "$backup_file"
    fi

    local before after attempt
    before=$(cat "$file" 2>/dev/null)
    attempt=1
    while [ "$attempt" -le 3 ]; do
        echo "$value" > "$file" 2>/dev/null
        after=$(cat "$file" 2>/dev/null)
        [ "$after" = "$value" ] && break
        attempt=$((attempt + 1))
        [ "$attempt" -le 3 ] && sleep 1
    done

    if [ "$after" = "$value" ]; then
        [ "$attempt" -gt 1 ] && log "OK   $file = $value (took $attempt attempts)"
        return 0
    else
        [ -n "$before" ] && echo "$before" > "$file" 2>/dev/null
        log "REJECTED $file wanted=$value got=$after after 3 attempts (reverted)"
        return 1
    fi
}

load_cfg() {
    PROFILE=performance
    BALANCED_LEVEL=12;    BALANCED_MA=5000
    PERFORMANCE_LEVEL=16; PERFORMANCE_MA=13400
    BATTERY_SAVER_LEVEL=5; BATTERY_SAVER_MA=1500
    DISABLE_NIGHT_CHARGING=true
    DISABLE_SMART_CHG=true
    DISABLE_RESTRICT=true
    DISABLE_THERMAL=true
    THERMAL_HOT_C=45
    THERMAL_COOL_C=40
    ALWAYS_FAST=false
    CHARGE_LIMIT=0
    # Night charge: slow-cruise toward NIGHT_TARGET so it is reached by NIGHT_BY.
    NIGHT_ENABLED=false
    NIGHT_TARGET=80
    NIGHT_BY=0700
    [ -f "$CONFIG" ] && . "$CONFIG"
}

AVAIL_CCC=0; AVAIL_LEVEL=0; AVAIL_NIGHT=0; AVAIL_SMARTCHG=0
AVAIL_RESTRICT=0; AVAIL_THERMAL=0; AVAIL_SUSPEND=0

discover() {
    discover_ucsi_path
    [ -w "$BATT/constant_charge_current" ] && AVAIL_CCC=1
    [ -w "$BATT/charge_control_limit" ]    && AVAIL_LEVEL=1
    [ -w "$QB/night_charging" ]            && AVAIL_NIGHT=1
    [ -w "$QB/smart_chg" ]                 && AVAIL_SMARTCHG=1
    [ -w "$QB/restrict_chg" ] && [ -w "$QB/restrict_cur" ] && AVAIL_RESTRICT=1
    [ -w "$QB/thermal_remove" ]            && AVAIL_THERMAL=1
    [ -w "$QB/input_suspend" ]             && AVAIL_SUSPEND=1
    log "avail: ccc=$AVAIL_CCC level=$AVAIL_LEVEL night=$AVAIL_NIGHT smartchg=$AVAIL_SMARTCHG restrict=$AVAIL_RESTRICT thermal=$AVAIL_THERMAL suspend=$AVAIL_SUSPEND"
}

get_status() { local v; v=$(rd "$BATT/status"); [ -n "$v" ] && echo "$v" || echo Unknown; }
get_cap()    { local v; v=$(rd "$BATT/capacity"); [ -n "$v" ] && echo "$v" || echo 0; }
get_temp()   { local t; t=$(to_num "$(rd "$BATT/temp")"); echo $((t/10)); }
get_volt()   { local v; v=$(to_num "$(rd "$BATT/voltage_now")"); echo $((v/1000)); }
get_curr()   { local c; c=$(to_num "$(rd "$BATT/current_now")"); echo "${c#-}"; }
get_health() { local v; v=$(rd "$BATT/health"); [ -n "$v" ] && echo "$v" || echo Unknown; }
get_level()  { local v; v=$(rd "$BATT/charge_control_limit"); [ -n "$v" ] && echo "$v" || echo 0; }

detect_charger_type() {
    local real_type qc_type
    real_type=$(rd "$QB/real_type")
    qc_type=$(rd "$QB/quick_charge_type")
    case "$real_type" in
        *PD*|*pd*) echo "pd"; return ;;
        *DCP*) echo "dcp"; return ;;
        *SDP*) echo "sdp"; return ;;
    esac
    case "$qc_type" in
        *[Ss]amsung*|*AFC*|*afc*) echo "samsung"; return ;;
        *QC*|*qc*) echo "qc"; return ;;
    esac
    echo "unknown"
}

CALIB_FILE="$CFGDIR/level_calibration"
CALIB_ATTEMPTS_FILE="$CFGDIR/level_calibration_attempts"

calibrate_level_direction() {
    if [ -f "$CALIB_FILE" ]; then
        cat "$CALIB_FILE"
        return
    fi
    if [ "${CALIBRATION_READONLY:-0}" = "1" ]; then
        echo "unknown"
        return
    fi
    [ "$AVAIL_LEVEL" != "1" ] && { echo "unknown"; return; }

    local sts
    sts=$(get_status)
    if [ "$sts" != "Charging" ] && [ "$sts" != "Full" ]; then
        echo "unknown"
        return
    fi

    log "CALIBRATION: measuring charge_control_limit scale direction"
    local original_level
    original_level=$(rd "$BATT/charge_control_limit")

    sample_current_at_level() {
        local lvl="$1" sum=0 count=0 i
        safe_write "$BATT/charge_control_limit" "$lvl"
        sleep 5
        i=0
        while [ "$i" -lt 3 ]; do
            local c
            c=$(to_num "$(rd "$BATT/current_now")")
            c=${c#-}
            sum=$((sum + c))
            count=$((count + 1))
            sleep 2
            i=$((i + 1))
        done
        echo $((sum / count))
    }

    local curr_at_0 curr_at_16
    curr_at_0=$(sample_current_at_level 0)
    curr_at_16=$(sample_current_at_level 16)
    log "CALIBRATION: avg current at level=0 was ${curr_at_0}uA, at level=16 was ${curr_at_16}uA"

    local diff larger direction
    if [ "$curr_at_0" -ge "$curr_at_16" ] 2>/dev/null; then
        diff=$((curr_at_0 - curr_at_16)); larger=$curr_at_0
    else
        diff=$((curr_at_16 - curr_at_0)); larger=$curr_at_16
    fi

    if [ "$larger" -gt 0 ] 2>/dev/null && [ $((diff * 100 / larger)) -ge 20 ] 2>/dev/null; then
        if [ "$curr_at_0" -gt "$curr_at_16" ]; then
            direction="zero_is_fast"
            log "CALIBRATION RESULT: level=0 is FASTER — inverted scale"
        else
            direction="sixteen_is_fast"
            log "CALIBRATION RESULT: level=16 is faster — normal scale"
        fi
        echo "$direction" > "$CALIB_FILE"
    else
        direction="unknown"
        local attempt_count
        attempt_count=$(cat "$CALIB_ATTEMPTS_FILE" 2>/dev/null || echo 0)
        attempt_count=$((attempt_count + 1))
        echo "$attempt_count" > "$CALIB_ATTEMPTS_FILE"
        if [ "$attempt_count" -ge 3 ]; then
            log "CALIBRATION: 3 inconclusive attempts — defaulting to sixteen_is_fast, caching"
            direction="sixteen_is_fast"
            echo "$direction" > "$CALIB_FILE"
        else
            log "CALIBRATION INCONCLUSIVE (attempt $attempt_count/3)"
        fi
    fi

    [ -n "$original_level" ] && safe_write "$BATT/charge_control_limit" "$original_level"
    echo "$direction"
}

resolve_level_for_speed() {
    local speed_intent=$1 direction=$2
    case "$direction" in
        zero_is_fast) echo $((16 - speed_intent)) ;;
        sixteen_is_fast|unknown|*) echo "$speed_intent" ;;
    esac
}

read_gate_state() { cat "$CFGDIR/thermal_gate_state" 2>/dev/null || echo 0; }
write_gate_state() { echo "$1" > "$CFGDIR/thermal_gate_state" 2>/dev/null; }

apply_thermal_gate() {
    local temp=$1
    [ "$AVAIL_THERMAL" != "1" ] && return
    [ "$DISABLE_THERMAL" != "true" ] && { safe_write "$QB/thermal_remove" "0"; write_gate_state 0; return; }

    local gate_state open_threshold
    gate_state=$(read_gate_state)
    open_threshold=$THERMAL_COOL_C
    if [ "$ALWAYS_FAST" = "true" ]; then
        open_threshold=$THERMAL_HOT_C
    fi

    if [ "$gate_state" = "0" ]; then
        if [ "$temp" -lt "$open_threshold" ] 2>/dev/null; then
            safe_write "$QB/thermal_remove" "1"
            write_gate_state 1
            log "THERMAL GATE: ${temp}C < ${open_threshold}C — removing limit"
        else
            safe_write "$QB/thermal_remove" "0"
        fi
    else
        if [ "$temp" -ge "$THERMAL_HOT_C" ] 2>/dev/null; then
            safe_write "$QB/thermal_remove" "0"
            write_gate_state 0
            log "THERMAL GATE: ${temp}C >= ${THERMAL_HOT_C}C — RESTORING protection"
        else
            safe_write "$QB/thermal_remove" "1"
        fi
    fi
}

restore_thermal_protection_idle() {
    [ "$AVAIL_THERMAL" != "1" ] && return
    local current
    current=$(rd "$QB/thermal_remove")
    if [ "$current" != "0" ]; then
        safe_write "$QB/thermal_remove" "0"
        log "IDLE: forcibly restored thermal protection (was not charging, thermal_remove was $current)"
    fi
    write_gate_state 0
}

release_throttles() {
    [ "$AVAIL_NIGHT" = "1" ]    && [ "$DISABLE_NIGHT_CHARGING" = "true" ] && safe_write "$QB/night_charging" "0"
    [ "$AVAIL_SMARTCHG" = "1" ] && [ "$DISABLE_SMART_CHG" = "true" ]      && safe_write "$QB/smart_chg" "0"
    if [ "$AVAIL_RESTRICT" = "1" ] && [ "$DISABLE_RESTRICT" = "true" ]; then
        safe_write "$QB/restrict_chg" "0"
        safe_write "$QB/restrict_cur" "0"
    fi
}

apply_settings() {
    log "=== Applying profile: $PROFILE ==="
    release_throttles

    local level ma
    case "$PROFILE" in
        performance)   level=$PERFORMANCE_LEVEL;   ma=$PERFORMANCE_MA ;;
        battery_saver) level=$BATTERY_SAVER_LEVEL;  ma=$BATTERY_SAVER_MA ;;
        balanced|*)    level=$BALANCED_LEVEL;       ma=$BALANCED_MA ;;
    esac

    # --- Night charge: land on NIGHT_TARGET by NIGHT_BY -----------------------
    # Plenty of time left  -> battery-saver pace (slow, cool, no early finish
    #                        beyond the target; CHARGE_LIMIT suspends at it).
    # Final hour          -> release to the selected profile so the target is
    #                        actually reached by the alarm.
    # Already there       -> hold at the target (suspend), normal after BY.
    if [ "$NIGHT_ENABLED" = "true" ] && [ "$NIGHT_TARGET" -gt 0 ] 2>/dev/null; then
        local night_cap now_hhmm by_hhmm mins_left night_phase
        night_cap=$(get_cap)
        now_hhmm=$(date +%H%M)
        by_hhmm=$(echo "$NIGHT_BY" | tr -cd '0-9')
        case "${#by_hhmm}" in
            4) ;;
            3) by_hhmm="0$by_hhmm" ;;
            2) by_hhmm="${by_hhmm}00" ;;
            *) by_hhmm=0700 ;;
        esac
        mins_left=$(( (10#$by_hhmm - 10#$now_hhmm + 1440) % 1440 ))
        night_phase="hold"
        if [ "$night_cap" -lt "$NIGHT_TARGET" ] 2>/dev/null; then
            if [ "$mins_left" -gt 60 ] 2>/dev/null; then
                night_phase="slow"
                level=$BATTERY_SAVER_LEVEL
                ma=$BATTERY_SAVER_MA
            elif [ "$mins_left" -gt 0 ] 2>/dev/null; then
                night_phase="final"
            else
                night_phase="past"
            fi
            CHARGE_LIMIT=$NIGHT_TARGET
        else
            CHARGE_LIMIT=$NIGHT_TARGET
        fi
        log "NIGHT: phase=$night_phase target=${NIGHT_TARGET}% by=$NIGHT_BY now=$now_hhmm left=${mins_left}m cap=$night_cap"
    fi

    if [ "$AVAIL_LEVEL" = "1" ]; then
        local resolved_level calib_result
        calib_result=$(calibrate_level_direction)
        resolved_level=$(resolve_level_for_speed "$level" "$calib_result")
        log "Level intent=$level -> resolved=$resolved_level (calibration: $calib_result)"
        safe_write "$BATT/charge_control_limit" "$resolved_level"
    fi

    CHARGER_TYPE=$(detect_charger_type)
    log "Charger type detected: $CHARGER_TYPE"

    case "$CHARGER_TYPE" in
        samsung|unknown)
            log "Skipping current override for $CHARGER_TYPE charger — native negotiation"
            ;;
        *)
            if [ "$AVAIL_CCC" = "1" ]; then
                local requested_ua=$((ma * 1000))
                if safe_write "$BATT/constant_charge_current" "$requested_ua"; then
                    log "Current accepted at ${ma}mA"
                else
                    local actual_ua
                    actual_ua=$(rd "$BATT/constant_charge_current")
                    actual_ua=$(to_num "$actual_ua")
                    log "Kernel ceiling: requested ${ma}mA, hardware allows $((actual_ua / 1000))mA"
                fi
            fi
            ;;
    esac

    if [ "$CHARGE_LIMIT" -gt 0 ] 2>/dev/null && [ "$AVAIL_SUSPEND" = "1" ]; then
        local cap
        cap=$(to_num "$(rd "$BATT/capacity")")
        if [ "$cap" -ge "$CHARGE_LIMIT" ] 2>/dev/null; then
            safe_write "$QB/input_suspend" "1"
        else
            safe_write "$QB/input_suspend" "0"
        fi
    fi

    log "=== Apply complete ==="
}

charger_info_json() {
    local usb_type online adapter_id apdo_max v_max v_min v_now current_max ucsi_present
    usb_type=$(rd "$USB/usb_type")
    [ -z "$usb_type" ] && [ -n "$UCSI" ] && usb_type=$(rd "$UCSI/usb_type")
    [ -z "$usb_type" ] && usb_type="N/A"
    online=$(rd "$USB/online")
    [ -z "$online" ] && [ -n "$UCSI" ] && online=$(rd "$UCSI/online")
    [ -z "$online" ] && online="N/A"
    adapter_id=$(rd "$QB/adapter_id"); [ -z "$adapter_id" ] && adapter_id="N/A"
    apdo_max=$(rd "$QB/apdo_max"); [ -z "$apdo_max" ] && apdo_max="N/A"
    v_max=$(rd "$USB/voltage_max")
    [ -z "$v_max" ] && [ -n "$UCSI" ] && v_max=$(rd "$UCSI/voltage_max")
    [ -z "$v_max" ] && v_max="N/A"
    v_min=$(rd "$USB/voltage_min")
    [ -z "$v_min" ] && [ -n "$UCSI" ] && v_min=$(rd "$UCSI/voltage_min")
    [ -z "$v_min" ] && v_min="N/A"
    v_now=""; [ -n "$UCSI" ] && v_now=$(rd "$UCSI/voltage_now"); [ -z "$v_now" ] && v_now="N/A"
    current_max=""; [ -n "$UCSI" ] && current_max=$(rd "$UCSI/current_max"); [ -z "$current_max" ] && current_max="N/A"
    ucsi_present=$([ -n "$UCSI" ] && echo "true" || echo "false")
    cat << CINFO
{"usb_type":"$usb_type","online":"$online","adapter_id":"$adapter_id","apdo_max":"$apdo_max","voltage_max_uv":"$v_max","voltage_min_uv":"$v_min","ucsi_voltage_now_uv":"$v_now","ucsi_current_max_ua":"$current_max","ucsi_available":$ucsi_present}
CINFO
}

diag_json() {
    local ccc lvl night smart rchg rcur therm susp
    ccc=$(rd "$BATT/constant_charge_current");   [ -z "$ccc" ] && ccc="null_or_missing"
    lvl=$(rd "$BATT/charge_control_limit");      [ -z "$lvl" ] && lvl="null_or_missing"
    night=$(rd "$QB/night_charging");            [ -z "$night" ] && night="null_or_missing"
    smart=$(rd "$QB/smart_chg");                 [ -z "$smart" ] && smart="null_or_missing"
    rchg=$(rd "$QB/restrict_chg");                [ -z "$rchg" ] && rchg="null_or_missing"
    rcur=$(rd "$QB/restrict_cur");                [ -z "$rcur" ] && rcur="null_or_missing"
    therm=$(rd "$QB/thermal_remove");             [ -z "$therm" ] && therm="null_or_missing"
    susp=$(rd "$QB/input_suspend");               [ -z "$susp" ] && susp="null_or_missing"
    cat << DIAG
{"constant_charge_current":"$ccc","charge_control_limit":"$lvl","night_charging":"$night","smart_chg":"$smart","restrict_chg":"$rchg","restrict_cur":"$rcur","thermal_remove":"$therm","input_suspend":"$susp"}
DIAG
}

write_state() {
    local cap sts temp volt curr_ua curr_ma pw active_state="$1"
    cap=$(get_cap); sts=$(get_status); temp=$(get_temp); volt=$(get_volt)
    curr_ua=$(to_num "$(get_curr)")
    curr_ma=$((curr_ua / 1000))
    pw=0
    if [ "$volt" -gt 0 ] 2>/dev/null && [ "$curr_ma" -gt 0 ] 2>/dev/null; then
        pw=$(awk "BEGIN{printf \"%.1f\", ($volt * $curr_ma) / 1000000}" 2>/dev/null)
    fi
    [ -z "$pw" ] && pw=0
    local avail_total=$((AVAIL_CCC + AVAIL_LEVEL + AVAIL_NIGHT + AVAIL_SMARTCHG + AVAIL_RESTRICT + AVAIL_THERMAL + AVAIL_SUSPEND))

    cat > "$STATE.tmp" << JSON
{
  "capacity": $cap,
  "status": "$sts",
  "profile": "$PROFILE",
  "active_state": "$active_state",
  "temp_c": $temp,
  "voltage_mv": $volt,
  "current_ma": $curr_ma,
  "power_w": $pw,
  "health": "$(get_health)",
  "charge_level": $(get_level),
  "charge_limit": $CHARGE_LIMIT,
  "balanced_level": $BALANCED_LEVEL, "balanced_ma": $BALANCED_MA,
  "performance_level": $PERFORMANCE_LEVEL, "performance_ma": $PERFORMANCE_MA,
  "battery_saver_level": $BATTERY_SAVER_LEVEL, "battery_saver_ma": $BATTERY_SAVER_MA,
  "disable_thermal": "$DISABLE_THERMAL",
  "always_fast": "$ALWAYS_FAST",
  "thermal_hot_c": $THERMAL_HOT_C,
  "thermal_cool_c": $THERMAL_COOL_C,
  "thermal_gate_active": $([ "$(read_gate_state)" = "1" ] && echo true || echo false),
  "charger_type_detected": "$(detect_charger_type)",
  "charger_info": $(charger_info_json),
  "level_calibration": "$(calibrate_level_direction)",
  "avail_ccc": $AVAIL_CCC, "avail_level": $AVAIL_LEVEL, "avail_night": $AVAIL_NIGHT,
  "avail_smartchg": $AVAIL_SMARTCHG, "avail_restrict": $AVAIL_RESTRICT,
  "avail_thermal": $AVAIL_THERMAL, "avail_suspend": $AVAIL_SUSPEND,
  "avail_total": $avail_total,
  "raw_nodes": $(diag_json),
  "mode": "full-apply",
  "ts": $(date +%s)
}
JSON
    mv "$STATE.tmp" "$STATE" 2>/dev/null
}

log "=== VOLTRIX run starting (PID $$, mode=${1:-full}) ==="
load_cfg
discover

if [ "$1" = "--state-only" ]; then
    CALIBRATION_READONLY=1
    write_state "$(get_status)"
    log "=== State-only refresh complete ==="
    exit 0
fi

CURRENT_STS=$(get_status)

if [ "$CURRENT_STS" = "Charging" ] || [ "$CURRENT_STS" = "Full" ]; then
    apply_settings
    apply_thermal_gate "$(get_temp)"
    write_state "$PROFILE"
else
    log "Not charging (status=$CURRENT_STS) — restoring thermal protection, skipping current writes"
    restore_thermal_protection_idle
    write_state "idle"
fi

log "=== Run finished ==="
