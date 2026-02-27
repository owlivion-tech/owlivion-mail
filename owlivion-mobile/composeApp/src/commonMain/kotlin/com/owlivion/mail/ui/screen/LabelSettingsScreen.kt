package com.owlivion.mail.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cafe.adriel.voyager.core.screen.Screen
import cafe.adriel.voyager.navigator.LocalNavigator
import cafe.adriel.voyager.navigator.currentOrThrow
import com.owlivion.mail.data.repository.LabelRepository
import com.owlivion.mail.ui.viewmodel.LabelViewModel
import org.koin.compose.koinInject

data class LabelSettingsScreen(val accountId: Long? = null) : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val labelRepo: LabelRepository = koinInject()
        val viewModel = remember { LabelViewModel(labelRepo, accountId) }
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
                    title = { Text("Etiketler", fontWeight = FontWeight.SemiBold) },
                    navigationIcon = {
                        IconButton(onClick = { navigator.pop() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                        }
                    },
                    actions = {
                        IconButton(onClick = { viewModel.showAddDialog() }) {
                            Icon(Icons.Default.Add, contentDescription = "Etiket Ekle")
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
            } else if (state.labels.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "Henuz etiket yok",
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(onClick = { viewModel.showAddDialog() }) {
                            Text("Etiket Olustur")
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(state.labels, key = { it.id }) { label ->
                        LabelItem(
                            label = label,
                            onEdit = { viewModel.startEditing(label) },
                            onDelete = { viewModel.deleteLabel(label.id) },
                        )
                    }
                }
            }
        }

        // Add dialog
        if (state.showAddDialog) {
            LabelDialog(
                title = "Yeni Etiket",
                initialName = "",
                initialColor = "blue",
                onDismiss = { viewModel.hideAddDialog() },
                onConfirm = { name, color -> viewModel.createLabel(name, color) },
            )
        }

        // Edit dialog
        state.editingLabel?.let { label ->
            LabelDialog(
                title = "Etiketi Duzenle",
                initialName = label.name,
                initialColor = label.color,
                onDismiss = { viewModel.cancelEditing() },
                onConfirm = { name, color -> viewModel.updateLabel(label.id, name, color) },
            )
        }
    }
}

@Composable
private fun LabelItem(
    label: com.owlivion.mail.core.Label,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(labelColorToComposeColor(label.color)),
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = label.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                Icon(
                    Icons.Default.Edit,
                    contentDescription = "Duzenle",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
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
private fun LabelDialog(
    title: String,
    initialName: String,
    initialColor: String,
    onDismiss: () -> Unit,
    onConfirm: (name: String, color: String) -> Unit,
) {
    var name by remember { mutableStateOf(initialName) }
    var selectedColor by remember { mutableStateOf(initialColor) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Etiket Adi") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                Text("Renk", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(LABEL_COLORS) { (colorName, _) ->
                        val color = labelColorToComposeColor(colorName)
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(color)
                                .then(
                                    if (selectedColor == colorName) {
                                        Modifier.border(2.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                                    } else Modifier,
                                )
                                .clickable { selectedColor = colorName },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selectedColor == colorName) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                    tint = Color.White,
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name.trim(), selectedColor) },
                enabled = name.isNotBlank(),
            ) {
                Text("Kaydet")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Iptal")
            }
        },
    )
}

private val LABEL_COLORS = listOf(
    "red" to "#ef4444",
    "orange" to "#f97316",
    "amber" to "#f59e0b",
    "yellow" to "#eab308",
    "lime" to "#84cc16",
    "green" to "#22c55e",
    "teal" to "#14b8a6",
    "cyan" to "#06b6d4",
    "blue" to "#3b82f6",
    "indigo" to "#6366f1",
    "violet" to "#8b5cf6",
    "purple" to "#a855f7",
    "fuchsia" to "#d946ef",
    "pink" to "#ec4899",
    "rose" to "#f43f5e",
    "gray" to "#78716c",
)

internal fun labelColorToComposeColor(name: String): Color {
    val hex = LABEL_COLORS.firstOrNull { it.first == name }?.second ?: "#3b82f6"
    return Color(hex.removePrefix("#").toLong(16) or 0xFF000000)
}
