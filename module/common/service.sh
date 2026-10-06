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

WAKELOCK_NAME="voltrix_watcher_lock"
if [ -w /sys/power/wake_lock ]; then
    echo "$WAKELOCK_NAME" > /sys/power/wake_lock 2>/dev/null
    echo "[$(date '+%F %T')] wakelock acquired: $WAKELOCK_NAME" >> "$LOG"
else
    echo "[$(date '+%F %T')] WARNING: /sys/power/wake_lock not writable" >> "$LOG"
fi

if [ -f "$MODDIR/script/charger_watch.sh" ]; then
    nohup sh "$MODDIR/script/charger_watch.sh" >> "$CFGDIR/watcher.log" 2>&1 &
    echo "[$(date '+%F %T')] charger watcher launched, PID=$!" >> "$LOG"
fi

exit 0
