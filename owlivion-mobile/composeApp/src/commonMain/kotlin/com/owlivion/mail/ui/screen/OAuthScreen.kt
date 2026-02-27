package com.owlivion.mail.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.owlivion.mail.data.repository.OAuthRepository
import com.owlivion.mail.ui.viewmodel.OAuthViewModel
import org.koin.compose.koinInject

class OAuthScreen : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val oauthRepo: OAuthRepository = koinInject()
        val viewModel = remember { OAuthViewModel(oauthRepo) }
        val state by viewModel.state.collectAsState()

        // Navigate back on success
        LaunchedEffect(state.isAccountAdded) {
            if (state.isAccountAdded) {
                navigator.popUntilRoot()
            }
        }

        val snackbarHostState = remember { SnackbarHostState() }

        LaunchedEffect(state.errorMessage) {
            state.errorMessage?.let {
                snackbarHostState.showSnackbar(it)
                viewModel.clearError()
            }
        }

        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                TopAppBar(
                    title = { Text("OAuth ile Giris", fontWeight = FontWeight.SemiBold) },
                    navigationIcon = {
                        IconButton(onClick = { navigator.pop() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                )
            },
        ) { paddingValues ->
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    state.isStarting || state.isHandlingCallback -> {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            CircularProgressIndicator()
                            Text(
                                text = if (state.isStarting) "OAuth hazirlaniyor..." else "Hesap ekleniyor...",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    state.authUrl != null -> {
                        // Auth URL ready - user needs to open browser
                        Column(
                            modifier = Modifier.padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Text(
                                text = "Tarayici acildi",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 20.sp,
                            )
                            Text(
                                text = "Tarayicida ${state.provider ?: ""} hesabinizla giris yapin. Giris tamamlandiginda uygulama otomatik olarak devam edecek.",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                            )
                            CircularProgressIndicator(
                                modifier = Modifier.size(32.dp),
                                strokeWidth = 3.dp,
                            )
                            TextButton(onClick = { viewModel.reset() }) {
                                Text("Iptal")
                            }
                        }
                    }

                    else -> {
                        // Provider selection
                        Column(
                            modifier = Modifier.padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(24.dp),
                        ) {
                            Text(
                                text = "Hesap Saglayici Secin",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 20.sp,
                            )

                            Text(
                                text = "Gmail veya Microsoft hesabinizi OAuth ile guvenli sekilde ekleyin",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                            )

                            // Google
                            Button(
                                onClick = { viewModel.startFlow("google") },
                                modifier = Modifier.fillMaxWidth().height(56.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface,
                                ),
                            ) {
                                Text("Google ile Devam Et", fontSize = 16.sp)
                            }

                            // Microsoft
                            Button(
                                onClick = { viewModel.startFlow("microsoft") },
                                modifier = Modifier.fillMaxWidth().height(56.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface,
                                ),
                            ) {
                                Text("Microsoft ile Devam Et", fontSize = 16.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
