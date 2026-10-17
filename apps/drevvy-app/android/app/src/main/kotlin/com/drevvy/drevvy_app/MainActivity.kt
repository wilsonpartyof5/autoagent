package com.drevvy.drevvy_app

import android.os.Handler
import android.os.Looper
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "drevvy/install_referrer",
        ).setMethodCallHandler { call, result ->
            if (call.method != "get") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            val client = InstallReferrerClient.newBuilder(this).build()
            val main = Handler(Looper.getMainLooper())
            var finished = false
            fun finish(value: String?) {
                if (finished) return
                finished = true
                try {
                    client.endConnection()
                } catch (_: Exception) {
                }
                main.post { result.success(value) }
            }
            try {
                client.startConnection(object : InstallReferrerStateListener {
                    override fun onInstallReferrerSetupFinished(responseCode: Int) {
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            try {
                                finish(client.installReferrer.installReferrer)
                            } catch (_: Exception) {
                                finish(null)
                            }
                        } else {
                            finish(null)
                        }
                    }

                    override fun onInstallReferrerServiceDisconnected() {
                        finish(null)
                    }
                })
            } catch (_: Exception) {
                finish(null)
            }
        }
    }
}
