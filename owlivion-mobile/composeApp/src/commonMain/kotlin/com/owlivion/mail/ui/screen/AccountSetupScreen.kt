package com.owlivion.mail.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cafe.adriel.voyager.core.screen.Screen
import cafe.adriel.voyager.navigator.LocalNavigator
import cafe.adriel.voyager.navigator.currentOrThrow
import com.owlivion.mail.ui.viewmodel.AccountSetupViewModel
import com.owlivion.mail.ui.viewmodel.ManualConfig
import com.owlivion.mail.ui.viewmodel.SetupStep
import com.owlivion.mail.data.repository.AccountRepository
import org.koin.compose.koinInject

class AccountSetupScreen : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val accountRepo: AccountRepository = koinInject()
        val viewModel = remember { AccountSetupViewModel(accountRepo) }
        val state by viewModel.state.collectAsState()

        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var displayName by remember { mutableStateOf("") }
        var showManualConfig by remember { mutableStateOf(false) }

        // Manual config fields
        var imapHost by remember { mutableStateOf("") }
        var imapPort by remember { mutableStateOf("993") }
        var imapSecurity by remember { mutableStateOf("SSL") }
        var smtpHost by remember { mutableStateOf("") }
        var smtpPort by remember { mutableStateOf("465") }
        var smtpSecurity by remember { mutableStateOf("SSL") }

        // Navigate to inbox on success
        LaunchedEffect(state.addedAccountId) {
            if (state.addedAccountId != null) {
                navigator.replaceAll(InboxScreen())
            }
        }

        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Hesap Ekle") },
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
                    .padding(horizontal = 24.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                // OAuth login buttons
                OutlinedButton(
                    onClick = { navigator.push(OAuthScreen()) },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Text("Google / Microsoft ile Giris")
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f))
                    Text(
                        "veya",
                        modifier = Modifier.padding(horizontal = 16.dp),
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    HorizontalDivider(modifier = Modifier.weight(1f))
                }

                // Email field
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; viewModel.clearError() },
                    label = { Text("E-posta Adresi") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true,
                    enabled = !state.isLoading,
                )

                // Password field
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; viewModel.clearError() },
                    label = { Text("Sifre") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    singleLine = true,
                    enabled = !state.isLoading,
                )

                // Display name
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("Gorunen Ad (Opsiyonel)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    enabled = !state.isLoading,
                )

                // Manual config toggle
                TextButton(
                    onClick = { showManualConfig = !showManualConfig },
                    enabled = !state.isLoading,
                ) {
                    Text(
                        text = if (showManualConfig) "Otomatik Yapilandirma" else "Manuel Yapilandirma",
                        color = MaterialTheme.colorScheme.primary,
                    )
                }

                // Manual config section
                AnimatedVisibility(visible = showManualConfig) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = "IMAP Ayarlari",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedTextField(
                                value = imapHost,
                                onValueChange = { imapHost = it },
                                label = { Text("Sunucu") },
                                modifier = Modifier.weight(2f),
                                singleLine = true,
                                enabled = !state.isLoading,
                            )
                            OutlinedTextField(
                                value = imapPort,
                                onValueChange = { imapPort = it },
                                label = { Text("Port") },
                                modifier = Modifier.weight(1f),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                enabled = !state.isLoading,
                            )
                        }

                        // IMAP Security selector
                        SecuritySelector(
                            selected = imapSecurity,
                            onSelect = { imapSecurity = it },
                            enabled = !state.isLoading,
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = "SMTP Ayarlari",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedTextField(
                                value = smtpHost,
                                onValueChange = { smtpHost = it },
                                label = { Text("Sunucu") },
                                modifier = Modifier.weight(2f),
                                singleLine = true,
                                enabled = !state.isLoading,
                            )
                            OutlinedTextField(
                                value = smtpPort,
                                onValueChange = { smtpPort = it },
                                label = { Text("Port") },
                                modifier = Modifier.weight(1f),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                enabled = !state.isLoading,
                            )
                        }

                        // SMTP Security selector
                        SecuritySelector(
                            selected = smtpSecurity,
                            onSelect = { smtpSecurity = it },
                            enabled = !state.isLoading,
                        )
                    }
                }

                // Status message
                state.statusMessage?.let { status ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                        )
                        Text(
                            text = status,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                // Error message
                state.errorMessage?.let { error ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = error,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(12.dp),
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Add account button
                Button(
                    onClick = {
                        val manual = if (showManualConfig && imapHost.isNotBlank()) {
                            ManualConfig(
                                imapHost = imapHost,
                                imapPort = imapPort.toIntOrNull() ?: 993,
                                imapSecurity = imapSecurity,
                                smtpHost = smtpHost,
                                smtpPort = smtpPort.toIntOrNull() ?: 465,
                                smtpSecurity = smtpSecurity,
                            )
                        } else null

                        viewModel.addAccount(email.trim(), password, displayName.trim(), manual)
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    enabled = email.isNotBlank() && password.isNotBlank() && !state.isLoading,
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    } else {
                        Text(
                            text = "Hesabi Ekle",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun SecuritySelector(
    selected: String,
    onSelect: (String) -> Unit,
    enabled: Boolean,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf("SSL", "STARTTLS").forEach { option ->
            FilterChip(
                selected = selected == option,
                onClick = { onSelect(option) },
                label = { Text(option, fontSize = 13.sp) },
                enabled = enabled,
            )
        }
    }
}
