package com.vnerxy.voltrix

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.service.quicksettings.TileService
import android.widget.Toast

/**
 * Quick Settings tile: "VOLTRIX 67W".
 *
 * onClick -> detects charging from the sticky ACTION_BATTERY_CHANGED broadcast (no root):
 *   charging  -> posts the VOLTRIX card immediately (toggle lives in it)
 *   otherwise -> toast "Connect the charger first"
 */
class VoltrixTileService : TileService() {

  override fun onClick() {
    if (!isCharging()) {
      Toast.makeText(this, "Connect the charger first", Toast.LENGTH_SHORT).show()
      return
    }
    val posted = NotificationHelper.show(this, NotificationHelper.State.QUESTION)
    if (!posted) {
      Toast.makeText(this, "Allow notifications for VOLTRIX first", Toast.LENGTH_SHORT).show()
    }
  }

  /** Reads the sticky battery broadcast that Android keeps for every app. No root needed. */
  private fun isCharging(): Boolean {
    val sticky: Intent? =
        try {
          registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        } catch (e: Exception) {
          null
        }
    if (sticky == null) return false
    val status =
        sticky.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
    return status == BatteryManager.BATTERY_STATUS_CHARGING ||
        status == BatteryManager.BATTERY_STATUS_FULL
  }
}
