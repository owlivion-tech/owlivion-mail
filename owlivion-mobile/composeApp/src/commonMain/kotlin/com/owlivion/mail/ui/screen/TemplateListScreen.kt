package com.owlivion.mail.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cafe.adriel.voyager.core.screen.Screen
import cafe.adriel.voyager.navigator.LocalNavigator
import cafe.adriel.voyager.navigator.currentOrThrow
import com.owlivion.mail.core.EmailTemplate
import com.owlivion.mail.data.repository.TemplateRepository
import com.owlivion.mail.ui.viewmodel.TemplateViewModel
import org.koin.compose.koinInject

class TemplateListScreen(
    private val accountId: Long,
) : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val templateRepo: TemplateRepository = koinInject()
        val viewModel = remember { TemplateViewModel(templateRepo, accountId) }
        val state by viewModel.state.collectAsState()
        val editState by viewModel.editState.collectAsState()

        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Sablonlar", fontWeight = FontWeight.SemiBold) },
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
            floatingActionButton = {
                FloatingActionButton(
                    onClick = { viewModel.showCreateDialog() },
                    containerColor = MaterialTheme.colorScheme.primary,
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Yeni Sablon")
                }
            },
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
            ) {
                when {
                    state.isLoading -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator()
                        }
                    }

                    state.errorMessage != null -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Text(
                                    text = state.errorMessage!!,
                                    color = MaterialTheme.colorScheme.error,
                                    fontSize = 14.sp,
                                )
                                Button(onClick = { viewModel.loadTemplates() }) {
                                    Text("Tekrar Dene")
                                }
                            }
                        }
                    }

                    state.templates.isEmpty() -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(
                                    text = "Henuz sablon yok",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontSize = 16.sp,
                                )
                                Text(
                                    text = "Sik kullandiginiz e-postalar icin sablonlar olusturun",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                    fontSize = 14.sp,
                                )
                            }
                        }
                    }

                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(vertical = 8.dp),
                        ) {
                            items(state.templates, key = { it.id }) { template ->
                                TemplateItem(
                                    template = template,
                                    categoryLabel = viewModel.getCategoryLabel(template.category),
                                    onToggleFavorite = { viewModel.toggleFavorite(template.id) },
                                    onDelete = { viewModel.deleteTemplate(template.id) },
                                    onSelect = {
                                        navigator.push(
                                            ComposeScreen(
                                                accountId = accountId.toString(),
                                                templateSubject = template.subjectTemplate,
                                                templateBody = template.bodyTextTemplate ?: "",
                                            )
                                        )
                                    },
                                )
                            }
                        }
                    }
                }
            }

            // Create dialog
            if (state.showCreateDialog) {
                CreateTemplateDialog(
                    editState = editState,
                    categories = viewModel.categories,
                    onNameChanged = viewModel::updateEditName,
                    onDescriptionChanged = viewModel::updateEditDescription,
                    onCategoryChanged = viewModel::updateEditCategory,
                    onSubjectChanged = viewModel::updateEditSubject,
                    onBodyChanged = viewModel::updateEditBody,
                    onSave = viewModel::saveTemplate,
                    onDismiss = viewModel::hideCreateDialog,
                )
            }
        }
    }
}

@Composable
private fun TemplateItem(
    template: EmailTemplate,
    categoryLabel: String,
    onToggleFavorite: () -> Unit,
    onDelete: () -> Unit,
    onSelect: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        onClick = onSelect,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = template.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val desc = template.description
                if (!desc.isNullOrBlank()) {
                    Text(
                        text = desc,
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = MaterialTheme.shapes.extraSmall,
                    ) {
                        Text(
                            text = categoryLabel,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                    if (template.usageCount > 0) {
                        Text(
                            text = "${template.usageCount}x kullanildi",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        )
                    }
                }
            }

            IconButton(onClick = onToggleFavorite) {
                Icon(
                    imageVector = if (template.isFavorite) Icons.Filled.Star else Icons.Outlined.Star,
                    contentDescription = if (template.isFavorite) "Favoriden kaldir" else "Favorile",
                    tint = if (template.isFavorite) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.size(20.dp),
                )
            }

            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Sil",
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateTemplateDialog(
    editState: com.owlivion.mail.ui.viewmodel.TemplateEditState,
    categories: List<Pair<String, String>>,
    onNameChanged: (String) -> Unit,
    onDescriptionChanged: (String) -> Unit,
    onCategoryChanged: (String) -> Unit,
    onSubjectChanged: (String) -> Unit,
    onBodyChanged: (String) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Yeni Sablon") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = editState.name,
                    onValueChange = onNameChanged,
                    label = { Text("Sablon Adi") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                OutlinedTextField(
                    value = editState.description,
                    onValueChange = onDescriptionChanged,
                    label = { Text("Aciklama") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                // Category selector
                var expanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = it },
                ) {
                    OutlinedTextField(
                        value = categories.find { it.first == editState.category }?.second ?: editState.category,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Kategori") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false },
                    ) {
                        categories.forEach { (key, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onCategoryChanged(key)
                                    expanded = false
                                },
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = editState.subjectTemplate,
                    onValueChange = onSubjectChanged,
                    label = { Text("Konu") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                OutlinedTextField(
                    value = editState.bodyTextTemplate,
                    onValueChange = onBodyChanged,
                    label = { Text("Icerik") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth(),
                )

                if (editState.errorMessage != null) {
                    Text(
                        text = editState.errorMessage,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 12.sp,
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onSave,
                enabled = !editState.isSaving,
            ) {
                if (editState.isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Kaydet")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Iptal")
            }
        },
    )
}
