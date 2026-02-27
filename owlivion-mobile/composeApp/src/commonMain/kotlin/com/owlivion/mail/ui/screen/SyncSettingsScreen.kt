package com.owlivion.mail.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
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
import com.owlivion.mail.core.DeviceInfo
import com.owlivion.mail.data.repository.AccountRepository
import com.owlivion.mail.data.repository.SyncRepository
import com.owlivion.mail.ui.viewmodel.SyncViewModel
import org.koin.compose.koinInject

class SyncSettingsScreen(
    private val fromWelcome: Boolean = false,
) : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val syncRepo: SyncRepository = koinInject()
        val accountRepo: AccountRepository = koinInject()
        val viewModel = remember { SyncViewModel(syncRepo) }
        val state by viewModel.state.collectAsState()
        var hasAccounts by remember { mutableStateOf(false) }

        // After sync, check if accounts exist (for Welcome flow)
        LaunchedEffect(state.lastSyncResult) {
            if (fromWelcome && state.lastSyncResult != null) {
                try {
                    val accounts = accountRepo.listAccounts()
                    hasAccounts = accounts.isNotEmpty()
                } catch (_: Exception) { }
            }
        }

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
                    title = { Text("Senkronizasyon", fontWeight = FontWeight.SemiBold) },
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
            if (state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (!state.isLoggedIn) {
                        // Auth form
                        item { AuthSection(viewModel, state) }
                    } else {
                        // Sync controls
                        item { SyncControlSection(viewModel, state) }

                        // Go to Inbox button (after sync from Welcome)
                        if (fromWelcome && hasAccounts) {
                            item {
                                Button(
                                    onClick = { navigator.replaceAll(InboxScreen()) },
                                    modifier = Modifier.fillMaxWidth().height(52.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.tertiary,
                                    ),
                                ) {
                                    Text(
                                        "Gelen Kutusuna Git",
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                        }

                        // Sync status
                        if (state.statuses.isNotEmpty()) {
                            item { SyncStatusSection(state) }
                        }

                        // Scheduler
                        item { SchedulerSection(viewModel, state) }

                        // Devices
                        if (state.devices.isNotEmpty()) {
                            item {
                                Text(
                                    "Cihazlar",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 16.sp,
                                )
                            }
                            items(state.devices) { device ->
                                DeviceItem(
                                    device = device,
                                    isCurrent = device.deviceId == state.config?.deviceId,
                                    onRevoke = { viewModel.revokeDevice(device.deviceId) },
                                )
                            }
                        }

                        // Queue stats
                        state.queueStats?.let { stats ->
                            item { QueueSection(viewModel, stats) }
                        }

                        // Logout
                        item {
                            OutlinedButton(
                                onClick = { viewModel.logout() },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = MaterialTheme.colorScheme.error,
                                ),
                            ) {
                                Text("Cikis Yap")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthSection(
    viewModel: SyncViewModel,
    state: com.owlivion.mail.ui.viewmodel.SyncScreenState,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = if (state.showRegisterForm) "Hesap Olustur" else "Giris Yap",
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
            )

            Text(
                text = "Owlivion hesabinizla cihazlar arasi senkronizasyon yapin",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = state.authEmail,
                onValueChange = viewModel::updateAuthEmail,
                label = { Text("E-posta") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = state.authPassword,
                onValueChange = viewModel::updateAuthPassword,
                label = { Text("Sifre") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )

            if (state.showRegisterForm) {
                OutlinedTextField(
                    value = state.masterPassword,
                    onValueChange = viewModel::updateMasterPassword,
                    label = { Text("Master Sifre (sifreleme icin)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Button(
                onClick = {
                    if (state.showRegisterForm) viewModel.register() else viewModel.login()
                },
                enabled = !state.isLoggingIn && !state.isRegistering,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (state.isLoggingIn || state.isRegistering) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text(if (state.showRegisterForm) "Kayit Ol" else "Giris Yap")
                }
            }

            TextButton(
                onClick = { viewModel.toggleRegisterForm() },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (state.showRegisterForm) "Zaten hesabiniz var mi? Giris yapin"
                    else "Hesabiniz yok mu? Kayit olun",
                )
            }
        }
    }
}

@Composable
private fun SyncControlSection(
    viewModel: SyncViewModel,
    state: com.owlivion.mail.ui.viewmodel.SyncScreenState,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("Senkronizasyon", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    val lastSync = state.config?.lastSyncAt
                    if (lastSync != null) {
                        Text(
                            text = "Son: ${lastSync.take(19).replace("T", " ")}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            OutlinedTextField(
                value = state.masterPassword,
                onValueChange = viewModel::updateMasterPassword,
                label = { Text("Master Sifre") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )

            Button(
                onClick = { viewModel.startSync() },
                enabled = !state.isSyncing,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (state.isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Senkronize ediliyor...")
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Simdi Senkronize Et")
                }
            }

            // Last sync result
            state.lastSyncResult?.let { result ->
                if (result.errors.isNotEmpty()) {
                    result.errors.forEach { error ->
                        Text(
                            text = error,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SyncStatusSection(state: com.owlivion.mail.ui.viewmodel.SyncScreenState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Veri Turleri", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            state.statuses.forEach { status ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = when (status.dataType) {
                            "accounts" -> "Hesaplar"
                            "contacts" -> "Kisiler"
                            "preferences" -> "Tercihler"
                            "signatures" -> "Imzalar"
                            else -> status.dataType
                        },
                        fontSize = 14.sp,
                    )
                    Text(
                        text = "v${status.version}",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun SchedulerSection(
    viewModel: SyncViewModel,
    state: com.owlivion.mail.ui.viewmodel.SyncScreenState,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Otomatik Senkronizasyon", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                state.schedulerStatus?.let { status ->
                    Text(
                        text = if (status.running) "Her ${status.intervalMinutes} dakikada" else "Kapali",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Switch(
                checked = state.schedulerStatus?.running == true,
                onCheckedChange = { viewModel.toggleScheduler() },
            )
        }
    }
}

@Composable
private fun DeviceItem(
    device: DeviceInfo,
    isCurrent: Boolean,
    onRevoke: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isCurrent) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
        ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = device.deviceName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                    )
                    if (isCurrent) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            color = MaterialTheme.colorScheme.primary,
                            shape = MaterialTheme.shapes.extraSmall,
                        ) {
                            Text(
                                "Bu cihaz",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                    }
                }
                Text(
                    text = "${device.platform} - Son: ${device.lastSeenAt.take(10)}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (!isCurrent) {
                IconButton(onClick = onRevoke) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Cihazikal",
                        tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun QueueSection(
    viewModel: SyncViewModel,
    stats: com.owlivion.mail.core.QueueStats,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Kuyruk", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                QueueStatItem("Bekleyen", stats.pendingCount)
                QueueStatItem("Basarili", stats.completedCount)
                QueueStatItem("Basarisiz", stats.failedCount)
            }
            if (stats.failedCount > 0) {
                TextButton(
                    onClick = { viewModel.retryFailed() },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Basarisizlari Tekrar Dene")
                }
            }
        }
    }
}

@Composable
private fun QueueStatItem(label: String, count: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = count.toString(),
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = label,
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
