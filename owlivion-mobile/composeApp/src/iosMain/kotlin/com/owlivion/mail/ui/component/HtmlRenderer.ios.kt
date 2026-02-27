package com.owlivion.mail.ui.component

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
actual fun HtmlRenderer(
    html: String,
    modifier: Modifier,
    darkTheme: Boolean,
) {
    // TODO: Faz 7 - WKWebView via UIKitView
    Text(
        text = html.replace(Regex("<[^>]*>"), "").take(500),
        modifier = modifier.fillMaxWidth().padding(12.dp),
    )
}
