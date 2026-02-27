package com.owlivion.mail

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.owlivion.mail.core.OwlivionBridge
import com.owlivion.mail.di.sharedModule
import kotlinx.coroutines.runBlocking
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.GlobalContext
import org.koin.core.context.startKoin

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Initialize Koin DI (only once)
        if (GlobalContext.getOrNull() == null) {
            startKoin {
                androidContext(applicationContext)
                modules(sharedModule)
            }
        }

        // Initialize the Rust core bridge
        val bridge = GlobalContext.get().get<OwlivionBridge>()
        val dataDir = applicationContext.filesDir.absolutePath
        val cacheDir = applicationContext.cacheDir.absolutePath
        try {
            runBlocking {
                bridge.initialize(dataDir, cacheDir)
            }
            Log.i("OwlivionMail", "Rust core initialized: dataDir=$dataDir")
        } catch (e: Exception) {
            Log.e("OwlivionMail", "Failed to initialize Rust core", e)
        }

        setContent {
            App()
        }
    }
}
