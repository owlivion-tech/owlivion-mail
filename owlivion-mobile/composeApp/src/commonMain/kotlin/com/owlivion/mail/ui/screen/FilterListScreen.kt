package com.owlivion.mail.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
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
import com.owlivion.mail.core.EmailFilter
import com.owlivion.mail.data.repository.FilterRepository
import com.owlivion.mail.ui.viewmodel.FilterViewModel
import org.koin.compose.koinInject

class FilterListScreen(
    private val accountId: Long,
) : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val filterRepo: FilterRepository = koinInject()
        val viewModel = remember { FilterViewModel(filterRepo, accountId) }
        val state by viewModel.state.collectAsState()
        val editState by viewModel.editState.collectAsState()

        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Filtreler", fontWeight = FontWeight.SemiBold) },
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
                    Icon(Icons.Default.Add, contentDescription = "Yeni Filtre")
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
                                Button(onClick = { viewModel.loadFilters() }) {
                                    Text("Tekrar Dene")
                                }
                            }
                        }
                    }

                    state.filters.isEmpty() -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(
                                    text = "Henuz filtre yok",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontSize = 16.sp,
                                )
                                Text(
                                    text = "E-postalari otomatik organize etmek icin filtreler olusturun",
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
                            items(state.filters, key = { it.id }) { filter ->
                                FilterItem(
                                    filter = filter,
                                    onToggle = { viewModel.toggleFilter(filter.id) },
                                    onDelete = { viewModel.deleteFilter(filter.id) },
                                )
                            }
                        }
                    }
                }
            }

            // Create dialog
            if (state.showCreateDialog) {
                CreateFilterDialog(
                    editState = editState,
                    conditionFields = viewModel.conditionFields,
                    conditionOperators = viewModel.conditionOperators,
                    actionTypes = viewModel.actionTypes,
                    onNameChanged = viewModel::updateEditName,
                    onDescriptionChanged = viewModel::updateEditDescription,
                    onMatchLogicChanged = viewModel::updateEditMatchLogic,
                    onConditionFieldChanged = viewModel::updateEditConditionField,
                    onConditionOperatorChanged = viewModel::updateEditConditionOperator,
                    onConditionValueChanged = viewModel::updateEditConditionValue,
                    onActionTypeChanged = viewModel::updateEditActionType,
                    onSave = viewModel::saveFilter,
                    onDismiss = viewModel::hideCreateDialog,
                )
            }
        }
    }
}

@Composable
private fun FilterItem(
    filter: EmailFilter,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = filter.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val desc = filter.description
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
                        color = if (filter.isEnabled) {
                            MaterialTheme.colorScheme.primaryContainer
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant
                        },
                        shape = MaterialTheme.shapes.extraSmall,
                    ) {
                        Text(
                            text = if (filter.isEnabled) "Aktif" else "Pasif",
                            fontSize = 11.sp,
                            color = if (filter.isEnabled) {
                                MaterialTheme.colorScheme.onPrimaryContainer
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                    if (filter.matchedCount > 0) {
                        Text(
                            text = "${filter.matchedCount} eslesti",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        )
                    }
                }
            }

            Switch(
                checked = filter.isEnabled,
                onCheckedChange = { onToggle() },
                modifier = Modifier.padding(horizontal = 4.dp),
            )

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
private fun CreateFilterDialog(
    editState: com.owlivion.mail.ui.viewmodel.FilterEditState,
    conditionFields: List<Pair<String, String>>,
    conditionOperators: List<Pair<String, String>>,
    actionTypes: List<Pair<String, String>>,
    onNameChanged: (String) -> Unit,
    onDescriptionChanged: (String) -> Unit,
    onMatchLogicChanged: (String) -> Unit,
    onConditionFieldChanged: (String) -> Unit,
    onConditionOperatorChanged: (String) -> Unit,
    onConditionValueChanged: (String) -> Unit,
    onActionTypeChanged: (String) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Yeni Filtre") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = editState.name,
                    onValueChange = onNameChanged,
                    label = { Text("Filtre Adi") },
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

                Text(
                    text = "Kosul",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )

                // Condition field dropdown
                var fieldExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = fieldExpanded,
                    onExpandedChange = { fieldExpanded = it },
                ) {
                    OutlinedTextField(
                        value = conditionFields.find { it.first == editState.conditionField }?.second ?: editState.conditionField,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Alan") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(fieldExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                    )
                    ExposedDropdownMenu(
                        expanded = fieldExpanded,
                        onDismissRequest = { fieldExpanded = false },
                    ) {
                        conditionFields.forEach { (key, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onConditionFieldChanged(key)
                                    fieldExpanded = false
                                },
                            )
                        }
                    }
                }

                // Condition operator dropdown
                var opExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = opExpanded,
                    onExpandedChange = { opExpanded = it },
                ) {
                    OutlinedTextField(
                        value = conditionOperators.find { it.first == editState.conditionOperator }?.second ?: editState.conditionOperator,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Islem") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(opExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                    )
                    ExposedDropdownMenu(
                        expanded = opExpanded,
                        onDismissRequest = { opExpanded = false },
                    ) {
                        conditionOperators.forEach { (key, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onConditionOperatorChanged(key)
                                    opExpanded = false
                                },
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = editState.conditionValue,
                    onValueChange = onConditionValueChanged,
                    label = { Text("Deger") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(
                    text = "Eylem",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )

                // Action type dropdown
                var actionExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = actionExpanded,
                    onExpandedChange = { actionExpanded = it },
                ) {
                    OutlinedTextField(
                        value = actionTypes.find { it.first == editState.actionType }?.second ?: editState.actionType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Eylem Turu") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(actionExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                    )
                    ExposedDropdownMenu(
                        expanded = actionExpanded,
                        onDismissRequest = { actionExpanded = false },
                    ) {
                        actionTypes.forEach { (key, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onActionTypeChanged(key)
                                    actionExpanded = false
                                },
                            )
                        }
                    }
                }

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
