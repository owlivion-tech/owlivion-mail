package com.owlivion.mail.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cafe.adriel.voyager.core.screen.Screen
import cafe.adriel.voyager.navigator.LocalNavigator
import cafe.adriel.voyager.navigator.currentOrThrow
import com.owlivion.mail.data.repository.AccountRepository
import org.koin.compose.koinInject

class WelcomeScreen : Screen {

    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val accountRepo: AccountRepository = koinInject()
        var isChecking by remember { mutableStateOf(true) }
        var showContent by remember { mutableStateOf(false) }

        // Check if accounts exist - if so, skip to inbox
        LaunchedEffect(Unit) {
            try {
                val accounts = accountRepo.listAccounts()
                if (accounts.isNotEmpty()) {
                    navigator.replaceAll(InboxScreen())
                    return@LaunchedEffect
                }
            } catch (_: Exception) {
                // Bridge not initialized yet or error - show welcome
            }
            isChecking = false
            showContent = true
        }

        if (isChecking) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
            return
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp)
                .systemBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            AnimatedVisibility(
                visible = showContent,
                enter = fadeIn(tween(600)) + slideInVertically(tween(600)) { -40 },
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // Logo
                    Text(
                        text = "O",
                        fontSize = 64.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Owlivion Mail",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground,
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Gizliliginize deger veren, guvenli e-posta istemcisi",
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            Spacer(modifier = Modifier.height(48.dp))

            AnimatedVisibility(
                visible = showContent,
                enter = fadeIn(tween(600, delayMillis = 300)) + slideInVertically(tween(600, delayMillis = 300)) { 40 },
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // Sync with Owlivion Account Button
                    Button(
                        onClick = { navigator.push(SyncSettingsScreen(fromWelcome = true)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                        ),
                    ) {
                        Text(
                            text = "Owlivion Hesabi ile Giris Yap",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Add Account Button
                    OutlinedButton(
                        onClick = { navigator.push(AccountSetupScreen()) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                    ) {
                        Text(
                            text = "Manuel Hesap Ekle",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Features list
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        FeatureItem("AI Tabanli Phishing Tespiti")
                        FeatureItem("AES-256-GCM Yerel Sifreleme")
                        FeatureItem("Tracking Piksel Engelleyici")
                        FeatureItem("Cihazlar Arasi Senkronizasyon")
                    }
                }
            }
        }
    }
}

@Composable
private fun FeatureItem(text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = "•",
            color = MaterialTheme.colorScheme.primary,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = text,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 14.sp,
        )
    }
}
