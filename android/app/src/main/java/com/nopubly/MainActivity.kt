package com.nopubly

import android.content.Intent
import android.net.VpnService
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Promise

class MainActivity : ReactActivity() {

  companion object {
    var vpnPermissionPromise: Promise? = null
  }

  private lateinit var vpnPermissionLauncher: ActivityResultLauncher<Intent>

  override fun onCreate(savedInstanceState: android.os.Bundle?) {
    super.onCreate(savedInstanceState)
    
    vpnPermissionLauncher = registerForActivityResult(
      ActivityResultContracts.StartActivityForResult()
    ) { result ->
      if (result.resultCode == RESULT_OK) {
        vpnPermissionPromise?.resolve("GRANTED")
      } else {
        vpnPermissionPromise?.reject("PERMISSION_DENIED", "User denied VPN permission")
      }
      vpnPermissionPromise = null
    }
  }

  fun launchVpnPermission(intent: Intent) {
    vpnPermissionLauncher.launch(intent)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "com.nopubly"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
