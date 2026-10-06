#!/system/bin/sh
# VOLTRIX — Service script
# Applies charging settings directly and unconditionally at boot,
# BEFORE the watcher is launched, so there is always a guaranteed
# first application independent of the watcher's health.

MODDIR=${0%/*}
CFGDIR=/data/adb/voltrix
LOG=$CFGDIR/daemon.log
mkdir -p "$CFGDIR" "$CFGDIR/backup"

while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 3
done
sleep 10

echo "[$(date '+%F %T')] === BOOT: guaranteed direct apply starting ===" >> "$LOG"
sh "$MODDIR/script/charge.sh" >> "$LOG" 2>&1
echo "[$(date '+%F %T')] === BOOT: direct apply finished, exit=$? ===" >> "$LOG"

# No wakelock: the watcher must never keep the SoC awake in standby.
# It only runs while the system is already awake — plugging the charger in
# wakes the device, so plug-in detection still fires within its sleep window.
echo "[$(date '+%F %T')] standby-safe: watcher launched without wakelock" >> "$LOG"

if [ -f "$MODDIR/script/charger_watch.sh" ]; then
    nohup sh "$MODDIR/script/charger_watch.sh" >> "$CFGDIR/watcher.log" 2>&1 &
    echo "[$(date '+%F %T')] charger watcher launched, PID=$!" >> "$LOG"
fi

exit 0
