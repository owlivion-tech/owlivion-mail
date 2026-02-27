package com.owlivion.mail.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cafe.adriel.voyager.core.screen.Screen
import cafe.adriel.voyager.navigator.LocalNavigator
import cafe.adriel.voyager.navigator.currentOrThrow
import com.owlivion.mail.core.EmailAlias
import com.owlivion.mail.data.repository.AliasRepository
import com.owlivion.mail.ui.viewmodel.AliasViewModel
import org.koin.compose.koinInject

data class AliasSettingsScreen(val accountId: Long) : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val aliasRepo: AliasRepository = koinInject()
        val viewModel = remember { AliasViewModel(aliasRepo, accountId) }
        val state by viewModel.state.collectAsState()

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
                    title = { Text("E-posta Alias'lari", fontWeight = FontWeight.SemiBold) },
                    navigationIcon = {
                        IconButton(onClick = { navigator.pop() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                        }
                    },
                    actions = {
                        IconButton(onClick = { viewModel.showAddDialog() }) {
                            Icon(Icons.Default.Add, contentDescription = "Alias Ekle")
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
            } else if (state.aliases.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "Henuz alias yok",
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(onClick = { viewModel.showAddDialog() }) {
                            Text("Alias Ekle")
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(state.aliases, key = { it.id }) { alias ->
                        AliasItem(
                            alias = alias,
                            onToggle = { viewModel.toggleAlias(alias.id) },
                            onSetDefault = { viewModel.setDefault(alias.id) },
                            onDelete = { viewModel.deleteAlias(alias.id) },
                        )
                    }
                }
            }
        }

        // Add dialog
        if (state.showAddDialog) {
            AddAliasDialog(
                onDismiss = { viewModel.hideAddDialog() },
                onConfirm = { email, name -> viewModel.addAlias(email, name) },
            )
        }
    }
}

@Composable
private fun AliasItem(
    alias: EmailAlias,
    onToggle: () -> Unit,
    onSetDefault: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (alias.isDefault) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
        ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = alias.aliasEmail,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (alias.isEnabled) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        },
                    )
                    if (alias.isDefault) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            color = MaterialTheme.colorScheme.primary,
                            shape = MaterialTheme.shapes.extraSmall,
                        ) {
                            Text(
                                "Varsayilan",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                    }
                }
                alias.aliasName?.let { name ->
                    Text(
                        text = name,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Switch(
                checked = alias.isEnabled,
                onCheckedChange = { onToggle() },
                modifier = Modifier.padding(horizontal = 4.dp),
            )

            if (!alias.isDefault) {
                IconButton(onClick = onSetDefault, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.Star,
                        contentDescription = "Varsayilan Yap",
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Sil",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                )
            }
        }
    }
}

@Composable
private fun AddAliasDialog(
    onDismiss: () -> Unit,
    onConfirm: (email: String, name: String?) -> Unit,
) {
    var aliasEmail by remember { mutableStateOf("") }
    var aliasName by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Yeni Alias") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = aliasEmail,
                    onValueChange = { aliasEmail = it },
                    label = { Text("E-posta Adresi") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = aliasName,
                    onValueChange = { aliasName = it },
                    label = { Text("Gorunen Ad (Opsiyonel)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        aliasEmail.trim(),
                        aliasName.trim().ifBlank { null },
                    )
                },
                enabled = aliasEmail.isNotBlank(),
            ) {
                Text("Ekle")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Iptal")
            }
        },
    )
}
