#!/system/bin/sh
# VOLTRIX — Service script (module ROOT, official Magisk layout)
# Magisk runs $MODPATH/service.sh in late_start service mode.
#   1) wait until Android is fully up
#   2) first apply ONLY while actually charging — never poke charging
#      sysfs on battery (standby untouched, no boot-time writes when
#      there is nothing to apply)
#   3) launch the charger watcher (idles until a plug-in event)

MODDIR=${0%/*}
CFGDIR=/data/adb/voltrix
LOG=$CFGDIR/daemon.log
mkdir -p "$CFGDIR" "$CFGDIR/backup"

while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 3
done
sleep 10

STATUS=$(cat /sys/class/power_supply/battery/status 2>/dev/null)
case "$STATUS" in
    Charging|Full)
        echo "[$(date '+%F %T')] === BOOT: charger connected ($STATUS) -> direct apply ===" >> "$LOG"
        sh "$MODDIR/script/charge.sh" >> "$LOG" 2>&1
        echo "[$(date '+%F %T')] === BOOT: direct apply finished, exit=$? ===" >> "$LOG"
        ;;
    *)
        echo "[$(date '+%F %T')] === BOOT: on battery ('$STATUS') -> skip first apply; watcher will apply on plug-in ===" >> "$LOG"
        ;;
esac

# No wakelock: never keep the SoC awake in standby. Charger plug-in is a
# wake source, so the watcher still reacts to connect events.
if [ -f "$MODDIR/script/charger_watch.sh" ]; then
    nohup sh "$MODDIR/script/charger_watch.sh" >> "$CFGDIR/watcher.log" 2>&1 &
    echo "[$(date '+%F %T')] === BOOT: charger watcher launched, PID=$! ===" >> "$LOG"
fi

exit 0
