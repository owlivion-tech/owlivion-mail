package com.owlivion.mail.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
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
import com.owlivion.mail.core.AttachmentInfo
import com.owlivion.mail.core.ParsedEmail
import com.owlivion.mail.data.repository.AccountRepository
import com.owlivion.mail.data.repository.EmailRepository
import com.owlivion.mail.ui.component.HtmlRenderer
import com.owlivion.mail.ui.viewmodel.ComposeType
import com.owlivion.mail.ui.viewmodel.EmailDetailViewModel
import org.koin.compose.koinInject

class EmailDetailScreen(
    private val accountId: String,
    private val uid: Long,
    private val folder: String?,
) : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val emailRepo: EmailRepository = koinInject()
        val accountRepo: AccountRepository = koinInject()
        val viewModel = remember {
            EmailDetailViewModel(emailRepo, accountId, uid, folder)
        }
        val state by viewModel.state.collectAsState()
        val isDarkTheme = isSystemInDarkTheme()

        // Get account signature for compose
        var signature by remember { mutableStateOf("") }
        LaunchedEffect(accountId) {
            try {
                val accounts = accountRepo.listAccounts()
                val account = accounts.find { it.id.toString() == accountId }
                signature = account?.signature ?: ""
            } catch (_: Exception) {}
        }

        // Load email on first render
        LaunchedEffect(Unit) {
            viewModel.loadEmail()
        }

        // Navigate back if email was deleted/archived
        LaunchedEffect(state.isDeleted) {
            if (state.isDeleted) {
                navigator.pop()
            }
        }

        Scaffold(
            topBar = {
                TopAppBar(
                    title = {},
                    navigationIcon = {
                        IconButton(onClick = { navigator.pop() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                        }
                    },
                    actions = {
                        state.email?.let { email ->
                            // Star toggle
                            IconButton(onClick = { viewModel.toggleStarred() }) {
                                Icon(
                                    imageVector = if (email.isStarred) Icons.Filled.Star else Icons.Outlined.Star,
                                    contentDescription = if (email.isStarred) "Yildizi kaldir" else "Yildizla",
                                    tint = if (email.isStarred) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.onSurfaceVariant
                                    },
                                )
                            }

                            // Delete
                            IconButton(onClick = { viewModel.deleteEmail() }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Sil",
                                    tint = MaterialTheme.colorScheme.error,
                                )
                            }

                            // More menu
                            var showMenu by remember { mutableStateOf(false) }
                            Box {
                                IconButton(onClick = { showMenu = true }) {
                                    Icon(Icons.Default.MoreVert, contentDescription = "Daha fazla")
                                }
                                DropdownMenu(
                                    expanded = showMenu,
                                    onDismissRequest = { showMenu = false },
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("Okunmadi olarak isaretle") },
                                        onClick = {
                                            viewModel.markUnread()
                                            showMenu = false
                                            navigator.pop()
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Arsivle") },
                                        onClick = {
                                            viewModel.moveToArchive()
                                            showMenu = false
                                        },
                                    )
                                }
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                )
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
                                modifier = Modifier.padding(32.dp),
                            ) {
                                Text(
                                    text = state.errorMessage!!,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.error,
                                )
                                Button(onClick = { viewModel.loadEmail() }) {
                                    Text("Tekrar Dene")
                                }
                            }
                        }
                    }

                    state.email != null -> {
                        Column(modifier = Modifier.fillMaxSize()) {
                            EmailContent(
                                email = state.email!!,
                                isDarkTheme = isDarkTheme,
                                modifier = Modifier.weight(1f),
                            )

                            // Reply/Forward action bar
                            Surface(
                                color = MaterialTheme.colorScheme.surface,
                                tonalElevation = 2.dp,
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    OutlinedButton(
                                        onClick = {
                                            navigator.push(
                                                ComposeScreen(
                                                    accountId = accountId,
                                                    composeType = ComposeType.REPLY,
                                                    originalEmail = state.email,
                                                    signature = signature,
                                                )
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                    ) {
                                        Text("Yanitla")
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            navigator.push(
                                                ComposeScreen(
                                                    accountId = accountId,
                                                    composeType = ComposeType.REPLY_ALL,
                                                    originalEmail = state.email,
                                                    signature = signature,
                                                )
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                    ) {
                                        Text("Tum. Yan.")
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            navigator.push(
                                                ComposeScreen(
                                                    accountId = accountId,
                                                    composeType = ComposeType.FORWARD,
                                                    originalEmail = state.email,
                                                    signature = signature,
                                                )
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                    ) {
                                        Text("Ilet")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmailContent(
    email: ParsedEmail,
    isDarkTheme: Boolean,
    modifier: Modifier = Modifier,
) {
    var showDetails by remember { mutableStateOf(false) }

    Column(
        modifier = modifier,
    ) {
        // Header section (scrollable)
        Column(
            modifier = Modifier.padding(horizontal = 16.dp),
        ) {
            // Subject
            Text(
                text = email.subject,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 8.dp),
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Sender info
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
            ) {
                // Avatar
                Surface(
                    modifier = Modifier.size(40.dp),
                    shape = MaterialTheme.shapes.extraLarge,
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = (email.fromName ?: email.from).take(1).uppercase(),
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = email.fromName ?: email.from,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = formatEmailDate(email.date),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    Text(
                        text = email.from,
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )

                    // Show details toggle
                    TextButton(
                        onClick = { showDetails = !showDetails },
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier.height(28.dp),
                    ) {
                        Text(
                            text = if (showDetails) "Detaylari gizle" else "Detaylari goster",
                            fontSize = 12.sp,
                        )
                    }
                }
            }

            // Expanded details
            AnimatedVisibility(visible = showDetails) {
                Column(
                    modifier = Modifier.padding(start = 52.dp, top = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (email.to.isNotEmpty()) {
                        DetailRow("Kime:", email.to.joinToString(", "))
                    }
                    if (email.cc.isNotEmpty()) {
                        DetailRow("Cc:", email.cc.joinToString(", "))
                    }
                    DetailRow("Tarih:", email.date)
                }
            }

            // Attachments
            if (email.attachments.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                AttachmentBar(email.attachments)
            }

            HorizontalDivider(
                modifier = Modifier.padding(top = 12.dp),
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
            )
        }

        // Email body (HTML or text)
        val bodyHtml = email.bodyHtml
        val bodyText = email.bodyText

        if (!bodyHtml.isNullOrBlank()) {
            HtmlRenderer(
                html = bodyHtml,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                darkTheme = isDarkTheme,
            )
        } else if (!bodyText.isNullOrBlank()) {
            Text(
                text = bodyText,
                fontSize = 15.sp,
                lineHeight = 22.sp,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "E-posta icerigi yok",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(48.dp),
        )
        Text(
            text = value,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun AttachmentBar(attachments: List<AttachmentInfo>) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "${attachments.size} ek dosya",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            attachments.take(3).forEach { att ->
                AttachmentChip(att)
            }

            if (attachments.size > 3) {
                Text(
                    text = "+${attachments.size - 3}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
private fun AttachmentChip(attachment: AttachmentInfo) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.extraSmall,
    ) {
        Text(
            text = attachment.filename,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

private fun formatEmailDate(dateStr: String): String {
    return if (dateStr.length > 16) {
        dateStr.substring(0, 16)
    } else {
        dateStr
    }
}
