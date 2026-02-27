package com.owlivion.mail.ui.component

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Platform-specific HTML renderer for email body.
 * Android: WebView, iOS: WKWebView (Faz 7)
 */
@Composable
expect fun HtmlRenderer(
    html: String,
    modifier: Modifier = Modifier,
    darkTheme: Boolean = false,
)
