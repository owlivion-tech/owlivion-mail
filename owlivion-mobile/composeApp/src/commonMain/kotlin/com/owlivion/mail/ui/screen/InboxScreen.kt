package com.owlivion.mail.ui.screen

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Create
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import com.owlivion.mail.core.Account
import com.owlivion.mail.core.EmailSummary
import com.owlivion.mail.core.Folder
import com.owlivion.mail.ui.viewmodel.ComposeType
import com.owlivion.mail.ui.viewmodel.InboxViewModel
import com.owlivion.mail.data.repository.AccountRepository
import com.owlivion.mail.data.repository.EmailRepository
import kotlinx.coroutines.launch
import org.koin.compose.koinInject

class InboxScreen : Screen {

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Content() {
        val navigator = LocalNavigator.currentOrThrow
        val accountRepo: AccountRepository = koinInject()
        val emailRepo: EmailRepository = koinInject()
        val viewModel = remember { InboxViewModel(accountRepo, emailRepo) }
        val state by viewModel.state.collectAsState()
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        val scope = rememberCoroutineScope()

        // Load initial data
        LaunchedEffect(Unit) {
            viewModel.loadInitial()
        }

        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(modifier = Modifier.fillMaxWidth(0.8f)) {
                    DrawerContent(
                        accounts = state.accounts,
                        currentAccountId = state.currentAccountId,
                        folders = state.folders,
                        currentFolder = state.currentFolder,
                        onAccountSelect = { accountId ->
                            viewModel.switchAccount(accountId)
                            scope.launch { drawerState.close() }
                        },
                        onFolderSelect = { folder ->
                            viewModel.selectFolder(folder)
                            scope.launch { drawerState.close() }
                        },
                        onAddAccount = {
                            scope.launch { drawerState.close() }
                            navigator.push(AccountSetupScreen())
                        },
                        onFilters = {
                            scope.launch { drawerState.close() }
                            val accountId = state.currentAccountId?.toLongOrNull()
                            if (accountId != null) {
                                navigator.push(FilterListScreen(accountId = accountId))
                            }
                        },
                        onTemplates = {
                            scope.launch { drawerState.close() }
                            val accountId = state.currentAccountId?.toLongOrNull()
                            if (accountId != null) {
                                navigator.push(TemplateListScreen(accountId = accountId))
                            }
                        },
                        onSync = {
                            scope.launch { drawerState.close() }
                            navigator.push(SyncSettingsScreen())
                        },
                        onLabels = {
                            scope.launch { drawerState.close() }
                            val accountId = state.currentAccountId?.toLongOrNull()
                            navigator.push(LabelSettingsScreen(accountId = accountId))
                        },
                        onAliases = {
                            scope.launch { drawerState.close() }
                            val accountId = state.currentAccountId?.toLongOrNull()
                            if (accountId != null) {
                                navigator.push(AliasSettingsScreen(accountId = accountId))
                            }
                        },
                        onAISettings = {
                            scope.launch { drawerState.close() }
                            navigator.push(AISettingsScreen())
                        },
                    )
                }
            },
        ) {
            Scaffold(
                topBar = {
                    TopAppBar(
                        title = {
                            Column {
                                Text(
                                    text = folderDisplayName(state.currentFolder),
                                    fontSize = 18.sp,
                                )
                                state.accounts.find { it.id.toString() == state.currentAccountId }?.let { account ->
                                    Text(
                                        text = account.email,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        },
                        navigationIcon = {
                            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                Icon(Icons.Default.Menu, contentDescription = "Menu")
                            }
                        },
                        actions = {
                            IconButton(onClick = {
                                val accountId = state.currentAccountId
                                if (accountId != null) {
                                    navigator.push(SearchScreen(accountId = accountId))
                                }
                            }) {
                                Icon(Icons.Default.Search, contentDescription = "Ara")
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                    )
                },
                floatingActionButton = {
                    FloatingActionButton(
                        onClick = {
                            val accountId = state.currentAccountId
                            if (accountId != null) {
                                val account = state.accounts.find { it.id.toString() == accountId }
                                navigator.push(
                                    ComposeScreen(
                                        accountId = accountId,
                                        signature = account?.signature ?: "",
                                    )
                                )
                            }
                        },
                        containerColor = MaterialTheme.colorScheme.primary,
                    ) {
                        Icon(Icons.Default.Create, contentDescription = "Yeni E-posta")
                    }
                },
            ) { paddingValues ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                ) {
                    when {
                        state.isLoading || state.isConnecting -> {
                            LoadingState(
                                message = if (state.isConnecting) "Sunucuya baglaniliyor..." else "E-postalar yukleniyor...",
                            )
                        }

                        state.errorMessage != null -> {
                            ErrorState(
                                message = state.errorMessage!!,
                                onRetry = { viewModel.loadInitial() },
                                onDismiss = { viewModel.clearError() },
                            )
                        }

                        state.emails.isEmpty() -> {
                            EmptyState()
                        }

                        else -> {
                            PullToRefreshBox(
                                isRefreshing = state.isRefreshing,
                                onRefresh = { viewModel.refresh() },
                                modifier = Modifier.fillMaxSize(),
                            ) {
                                EmailList(
                                    emails = state.emails,
                                    hasMore = state.hasMore,
                                    onEmailClick = { email ->
                                        viewModel.markRead(email.uid, true)
                                        navigator.push(
                                            EmailDetailScreen(
                                                accountId = state.currentAccountId!!,
                                                uid = email.uid,
                                                folder = state.currentFolder,
                                            )
                                        )
                                    },
                                    onDeleteEmail = { email ->
                                        viewModel.deleteEmail(email.uid)
                                    },
                                    onArchiveEmail = { email ->
                                        viewModel.archiveEmail(email.uid)
                                    },
                                    onLoadMore = { viewModel.loadMoreEmails() },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadingState(message: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            CircularProgressIndicator()
            Text(
                text = message,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit, onDismiss: () -> Unit) {
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
                text = "Hata",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.error,
            )
            Text(
                text = message,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onDismiss) {
                    Text("Kapat")
                }
                Button(onClick = onRetry) {
                    Text("Tekrar Dene")
                }
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "Gelen kutunuz bos",
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "Yeni e-postalar burada gorunecek",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.outline,
            )
        }
    }
}

@Composable
private fun EmailList(
    emails: List<EmailSummary>,
    hasMore: Boolean,
    onEmailClick: (EmailSummary) -> Unit,
    onDeleteEmail: (EmailSummary) -> Unit,
    onArchiveEmail: (EmailSummary) -> Unit,
    onLoadMore: () -> Unit,
) {
    val listState = rememberLazyListState()

    // Trigger load more when near bottom
    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisibleItem = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisibleItem >= emails.size - 5 && hasMore
        }
    }

    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) onLoadMore()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
    ) {
        items(emails, key = { it.uid }) { email ->
            SwipeableEmailItem(
                email = email,
                onClick = { onEmailClick(email) },
                onDelete = { onDeleteEmail(email) },
                onArchive = { onArchiveEmail(email) },
            )
            HorizontalDivider(
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.12f),
            )
        }

        if (hasMore) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeableEmailItem(
    email: EmailSummary,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onArchive: () -> Unit,
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            when (dismissValue) {
                SwipeToDismissBoxValue.EndToStart -> {
                    onDelete()
                    true
                }
                SwipeToDismissBoxValue.StartToEnd -> {
                    onArchive()
                    true
                }
                SwipeToDismissBoxValue.Settled -> false
            }
        },
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            val direction = dismissState.dismissDirection
            val color by animateColorAsState(
                when (dismissState.targetValue) {
                    SwipeToDismissBoxValue.EndToStart -> MaterialTheme.colorScheme.error
                    SwipeToDismissBoxValue.StartToEnd -> MaterialTheme.colorScheme.primary
                    SwipeToDismissBoxValue.Settled -> MaterialTheme.colorScheme.surface
                },
                label = "swipe_bg",
            )
            val alignment = when (direction) {
                SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
                else -> Alignment.CenterStart
            }
            val icon = when (direction) {
                SwipeToDismissBoxValue.EndToStart -> Icons.Default.Delete
                else -> Icons.Default.Star
            }

            Box(
                Modifier
                    .fillMaxSize()
                    .background(color)
                    .padding(horizontal = 20.dp),
                contentAlignment = alignment,
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                )
            }
        },
    ) {
        Surface(color = MaterialTheme.colorScheme.surface) {
            EmailListItem(email = email, onClick = onClick)
        }
    }
}

@Composable
private fun EmailListItem(
    email: EmailSummary,
    onClick: () -> Unit,
) {
    val textColor = if (email.isRead) {
        MaterialTheme.colorScheme.onSurfaceVariant
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    val fontWeight = if (email.isRead) FontWeight.Normal else FontWeight.SemiBold

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        // Avatar circle
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
            // Sender + date
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = email.fromName ?: email.from,
                    fontWeight = fontWeight,
                    color = textColor,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (email.isStarred) {
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                    Text(
                        text = formatDate(email.date),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(2.dp))

            // Subject
            Text(
                text = email.subject,
                fontWeight = fontWeight,
                color = textColor,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )

            // Preview
            Text(
                text = email.preview,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun DrawerContent(
    accounts: List<Account>,
    currentAccountId: String?,
    folders: List<Folder>,
    currentFolder: String,
    onAccountSelect: (String) -> Unit,
    onFolderSelect: (String) -> Unit,
    onAddAccount: () -> Unit,
    onFilters: () -> Unit = {},
    onTemplates: () -> Unit = {},
    onSync: () -> Unit = {},
    onLabels: () -> Unit = {},
    onAliases: () -> Unit = {},
    onAISettings: () -> Unit = {},
) {
    Column(modifier = Modifier.padding(vertical = 12.dp)) {
        // Account switcher section
        if (accounts.size > 1) {
            Text(
                text = "Hesaplar",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            accounts.forEach { account ->
                NavigationDrawerItem(
                    label = {
                        Column {
                            Text(
                                text = account.displayName.ifBlank { account.email },
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                            )
                            Text(
                                text = account.email,
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                    selected = currentAccountId == account.id.toString(),
                    onClick = { onAccountSelect(account.id.toString()) },
                    modifier = Modifier.padding(horizontal = 8.dp),
                )
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp, horizontal = 16.dp),
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
            )
        }

        // Folders section
        Text(
            text = "Klasorler",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (folders.isEmpty()) {
            listOf(
                "INBOX" to "Gelen Kutusu",
                "Sent" to "Gonderilenler",
                "Drafts" to "Taslaklar",
                "Trash" to "Cop Kutusu",
            ).forEach { (path, name) ->
                NavigationDrawerItem(
                    label = { Text(name) },
                    selected = currentFolder == path,
                    onClick = { onFolderSelect(path) },
                    modifier = Modifier.padding(horizontal = 8.dp),
                )
            }
        } else {
            folders.forEach { folder ->
                NavigationDrawerItem(
                    label = {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(folderDisplayName(folder.path))
                            if (folder.unreadCount > 0) {
                                Text(
                                    text = folder.unreadCount.toString(),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    },
                    selected = currentFolder == folder.path,
                    onClick = { onFolderSelect(folder.path) },
                    modifier = Modifier.padding(horizontal = 8.dp),
                )
            }
        }

        // Add account button at bottom
        HorizontalDivider(
            modifier = Modifier.padding(vertical = 8.dp, horizontal = 16.dp),
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
        )

        NavigationDrawerItem(
            label = { Text("Filtreler") },
            selected = false,
            onClick = onFilters,
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        NavigationDrawerItem(
            label = { Text("Sablonlar") },
            selected = false,
            onClick = onTemplates,
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        NavigationDrawerItem(
            label = { Text("Etiketler") },
            selected = false,
            onClick = onLabels,
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        NavigationDrawerItem(
            label = { Text("Alias'lar") },
            selected = false,
            onClick = onAliases,
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        NavigationDrawerItem(
            label = { Text("Senkronizasyon") },
            selected = false,
            onClick = onSync,
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        NavigationDrawerItem(
            label = { Text("Yapay Zeka") },
            selected = false,
            onClick = onAISettings,
            modifier = Modifier.padding(horizontal = 8.dp),
        )

        HorizontalDivider(
            modifier = Modifier.padding(vertical = 8.dp, horizontal = 16.dp),
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
        )

        NavigationDrawerItem(
            label = { Text("Hesap Ekle", color = MaterialTheme.colorScheme.primary) },
            selected = false,
            onClick = onAddAccount,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
    }
}

private fun folderDisplayName(folder: String): String {
    return when (folder.uppercase()) {
        "INBOX" -> "Gelen Kutusu"
        "SENT", "SENT ITEMS", "[GMAIL]/SENT MAIL" -> "Gonderilenler"
        "DRAFTS", "[GMAIL]/DRAFTS" -> "Taslaklar"
        "TRASH", "DELETED", "[GMAIL]/TRASH" -> "Cop Kutusu"
        "SPAM", "JUNK", "[GMAIL]/SPAM" -> "Spam"
        "ARCHIVE", "[GMAIL]/ALL MAIL" -> "Arsiv"
        else -> folder
    }
}

private fun formatDate(dateStr: String): String {
    return if (dateStr.length > 10) {
        dateStr.substring(0, 10)
    } else {
        dateStr
    }
}
