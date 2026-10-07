#!/system/bin/sh
SKIPUNZIP=0

ui_print ""
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ui_print "  ⚡ VOLTRIX  v1.0.6 ⚡"
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ui_print "  67W full-charge unlock"
ui_print "  Companion app auto-install"
ui_print "  Thermal gate control"
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ui_print "► Extracting..."
unzip -o "$ZIPFILE" 'script/*' -d "$MODPATH" >&2
unzip -o "$ZIPFILE" 'app/*'   -d "$MODPATH" >&2

ui_print "► Migrating from previous versions..."
OLDDIR=/data/adb/vnerxy_charge
CFGDIR=/data/adb/voltrix
mkdir -p "$CFGDIR" "$CFGDIR/backup"
if [ -d "$OLDDIR" ] && [ ! -f "$CFGDIR/config.sh" ] && [ -f "$OLDDIR/config.sh" ]; then
    cp "$OLDDIR/config.sh" "$CFGDIR/config.sh" 2>/dev/null
    [ -f "$OLDDIR/level_calibration" ] && cp "$OLDDIR/level_calibration" "$CFGDIR/level_calibration" 2>/dev/null
    ui_print "  · old config migrated to $CFGDIR"
fi
# NOTE: never auto-remove the old HyperCharge module here — uninstalling
# another module from an installer is the user's call (its on-device
# content may differ from any zip we hold).

if [ ! -f "$CFGDIR/config.sh" ]; then
cat > "$CFGDIR/config.sh" << 'CFG'
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

AUTO_TRIGGER_ENABLED=true
AUTO_TRIGGER_POLL_SECONDS=60
AUTO_TRIGGER_IDLE_POLL_SECONDS=300
TEMP_CHANGE_THRESHOLD_TENTHS=5
CFG
fi

ui_print "► Permissions..."
set_perm_recursive "$MODPATH"                  root root 0755 0644
set_perm "$MODPATH/service.sh"                 root root 0755
set_perm "$MODPATH/script/charge.sh"           root root 0755
set_perm "$MODPATH/script/charger_watch.sh"    root root 0755
chmod 0600 "$CFGDIR/config.sh"

ui_print "► Installing companion app..."
if command -v pm >/dev/null 2>&1 && [ "$(getprop sys.boot_completed)" = "1" ]; then
    if pm install -r "$MODPATH/app/VOLTRIX.apk" >/dev/null 2>&1; then
        ui_print "  · VOLTRIX app installed"
    else
        ui_print "  · auto-install failed — install manually:"
        ui_print "    $MODPATH/app/VOLTRIX.apk"
    fi
else
    ui_print "  · pm unavailable — install manually after reboot:"
    ui_print "    $MODPATH/app/VOLTRIX.apk"
fi

ui_print ""
ui_print "✓ Done — reboot required"
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
