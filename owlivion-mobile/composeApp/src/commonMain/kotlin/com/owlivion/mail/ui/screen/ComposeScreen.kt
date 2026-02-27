package com.owlivion.mail.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cafe.adriel.voyager.core.screen.Screen
import cafe.adriel.voyager.navigator.LocalNavigator
import cafe.adriel.voyager.navigator.currentOrThrow
import com.owlivion.mail.core.ParsedEmail
import com.owlivion.mail.data.repository.EmailRepository
import com.owlivion.mail.ui.viewmodel.ComposeState
import com.owlivion.mail.ui.viewmodel.ComposeType
import com.owlivion.mail.ui.viewmodel.ComposeViewModel
import org.koin.compose.koinInject

class ComposeScreen(
    private val accountId: String,
    private val composeType: ComposeType = ComposeType.NEW,
    private val originalEmail: ParsedEmail? = null,
    private val signature: String = "",
    private val templateSubject: String? = null,
    private val templateBody: String? = null,
) : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val emailRepo: EmailRepository = koinInject()
        val viewModel = remember {
            ComposeViewModel(emailRepo, accountId, composeType, originalEmail, signature)
        }

        // Apply template if provided
        LaunchedEffect(templateSubject, templateBody) {
            if (templateSubject != null) viewModel.updateSubject(templateSubject)
            if (templateBody != null) viewModel.updateBody(templateBody)
        }
        val state by viewModel.state.collectAsState()

        // Navigate back on send success
        LaunchedEffect(state.isSent) {
            if (state.isSent) {
                navigator.pop()
            }
        }

        // Snackbar for errors
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
                    title = {
                        Text(
                            text = when (state.composeType) {
                                ComposeType.NEW -> "Yeni E-posta"
                                ComposeType.REPLY -> "Yanitla"
                                ComposeType.REPLY_ALL -> "Tumunu Yanitla"
                                ComposeType.FORWARD -> "Ilet"
                            },
                            fontWeight = FontWeight.SemiBold,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { navigator.pop() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                        }
                    },
                    actions = {
                        // Send button
                        IconButton(
                            onClick = { viewModel.send() },
                            enabled = !state.isSending,
                        ) {
                            if (state.isSending) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                Icon(
                                    Icons.AutoMirrored.Filled.Send,
                                    contentDescription = "Gonder",
                                    tint = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                )
            },
        ) { paddingValues ->
            ComposeBody(
                state = state,
                onToChanged = viewModel::updateTo,
                onCcChanged = viewModel::updateCc,
                onBccChanged = viewModel::updateBcc,
                onSubjectChanged = viewModel::updateSubject,
                onBodyChanged = viewModel::updateBody,
                onToggleCcBcc = viewModel::toggleCcBcc,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
            )
        }
    }
}

@Composable
private fun ComposeBody(
    state: ComposeState,
    onToChanged: (List<String>) -> Unit,
    onCcChanged: (List<String>) -> Unit,
    onBccChanged: (List<String>) -> Unit,
    onSubjectChanged: (String) -> Unit,
    onBodyChanged: (String) -> Unit,
    onToggleCcBcc: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()),
    ) {
        // To field
        RecipientField(
            label = "Kime",
            recipients = state.toRecipients,
            onRecipientsChanged = onToChanged,
            trailingContent = {
                // Cc/Bcc toggle
                TextButton(
                    onClick = onToggleCcBcc,
                    contentPadding = PaddingValues(horizontal = 8.dp),
                    modifier = Modifier.height(32.dp),
                ) {
                    Text(
                        text = if (state.showCcBcc) "Gizle" else "Cc/Bcc",
                        fontSize = 12.sp,
                    )
                }
            },
        )

        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

        // Cc & Bcc fields
        AnimatedVisibility(visible = state.showCcBcc) {
            Column {
                RecipientField(
                    label = "Cc",
                    recipients = state.ccRecipients,
                    onRecipientsChanged = onCcChanged,
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                RecipientField(
                    label = "Bcc",
                    recipients = state.bccRecipients,
                    onRecipientsChanged = onBccChanged,
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
            }
        }

        // Subject field
        OutlinedTextField(
            value = state.subject,
            onValueChange = onSubjectChanged,
            placeholder = { Text("Konu") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0f),
                focusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0f),
            ),
        )

        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

        // Body
        OutlinedTextField(
            value = state.bodyText,
            onValueChange = onBodyChanged,
            placeholder = { Text("E-posta icerigi...") },
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 300.dp)
                .padding(horizontal = 16.dp, vertical = 4.dp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0f),
                focusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0f),
            ),
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecipientField(
    label: String,
    recipients: List<String>,
    onRecipientsChanged: (List<String>) -> Unit,
    trailingContent: @Composable (() -> Unit)? = null,
) {
    var inputText by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "$label:",
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(40.dp),
        )

        FlowRow(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            recipients.forEach { email ->
                InputChip(
                    selected = false,
                    onClick = {
                        onRecipientsChanged(recipients - email)
                    },
                    label = {
                        Text(email, fontSize = 13.sp, maxLines = 1)
                    },
                    trailingIcon = {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Kaldir",
                            modifier = Modifier.size(14.dp),
                        )
                    },
                    modifier = Modifier.height(28.dp),
                )
            }

            OutlinedTextField(
                value = inputText,
                onValueChange = { value ->
                    // Add recipient on comma, semicolon, or space after valid email
                    if (value.endsWith(",") || value.endsWith(";") || value.endsWith(" ")) {
                        val trimmed = value.dropLast(1).trim()
                        if (trimmed.contains("@") && trimmed.contains(".")) {
                            onRecipientsChanged(recipients + trimmed)
                            inputText = ""
                        }
                    } else {
                        inputText = value
                    }
                },
                placeholder = {
                    if (recipients.isEmpty()) {
                        Text("E-posta adresi", fontSize = 14.sp)
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                ),
                keyboardActions = KeyboardActions(
                    onNext = {
                        val trimmed = inputText.trim()
                        if (trimmed.contains("@") && trimmed.contains(".")) {
                            onRecipientsChanged(recipients + trimmed)
                            inputText = ""
                        }
                    },
                ),
                modifier = Modifier
                    .widthIn(min = 120.dp)
                    .weight(1f)
                    .focusRequester(focusRequester),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0f),
                    focusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0f),
                ),
                textStyle = LocalTextStyle.current.copy(fontSize = 14.sp),
            )
        }

        trailingContent?.invoke()
    }
}
