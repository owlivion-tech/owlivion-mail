package com.owlivion.mail.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cafe.adriel.voyager.core.screen.Screen
import cafe.adriel.voyager.navigator.LocalNavigator
import cafe.adriel.voyager.navigator.currentOrThrow
import com.owlivion.mail.data.repository.AIRepository
import com.owlivion.mail.ui.viewmodel.AISettingsViewModel
import org.koin.compose.koinInject

class AISettingsScreen : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val aiRepo: AIRepository = koinInject()
        val viewModel = remember { AISettingsViewModel(aiRepo) }
        val state by viewModel.state.collectAsState()

        val snackbarHostState = remember { SnackbarHostState() }

        LaunchedEffect(state.errorMessage) {
            state.errorMessage?.let {
                snackbarHostState.showSnackbar(it)
                viewModel.clearError()
            }
        }

        LaunchedEffect(state.successMessage) {
            state.successMessage?.let {
                snackbarHostState.showSnackbar(it)
                viewModel.clearSuccess()
            }
        }

        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                TopAppBar(
                    title = { Text("Yapay Zeka Ayarlari", fontWeight = FontWeight.SemiBold) },
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
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // API Key
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text("Gemini API", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        Text(
                            "Google Gemini API anahtarinizi girerek AI ozelliklerini aktif edin.",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        OutlinedTextField(
                            value = state.apiKey,
                            onValueChange = viewModel::updateApiKey,
                            label = { Text("API Anahtari") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                        )

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Button(
                                onClick = { viewModel.testConnection() },
                                enabled = !state.isTesting && state.apiKey.isNotBlank(),
                            ) {
                                if (state.isTesting) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = MaterialTheme.colorScheme.onPrimary,
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                }
                                Text("Baglanti Testi")
                            }

                            state.testResult?.let { success ->
                                Text(
                                    text = if (success) "Basarili" else "Basarisiz",
                                    color = if (success) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.error
                                    },
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                        }
                    }
                }

                // Auto features
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text("Otomatik Ozellikler", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Otomatik Ozetleme", fontSize = 14.sp)
                                Text(
                                    "E-postalari otomatik ozetle",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Switch(
                                checked = state.autoSummarize,
                                onCheckedChange = viewModel::updateAutoSummarize,
                            )
                        }

                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Phishing Tespiti", fontSize = 14.sp)
                                Text(
                                    "E-postalari otomatik analiz et",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Switch(
                                checked = state.autoPhishingDetection,
                                onCheckedChange = viewModel::updateAutoPhishingDetection,
                            )
                        }
                    }
                }

                // Reply tone
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("Yanit Tonu", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)

                        val tones = listOf(
                            "professional" to "Profesyonel",
                            "friendly" to "Samimi",
                            "formal" to "Resmi",
                            "casual" to "Gundelik",
                        )

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            tones.forEach { (value, label) ->
                                FilterChip(
                                    selected = state.replyTone == value,
                                    onClick = { viewModel.updateReplyTone(value) },
                                    label = { Text(label, fontSize = 13.sp) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
