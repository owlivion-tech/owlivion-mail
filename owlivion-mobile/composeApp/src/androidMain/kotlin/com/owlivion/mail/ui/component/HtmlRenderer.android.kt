package com.owlivion.mail.ui.component

import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

@Composable
actual fun HtmlRenderer(
    html: String,
    modifier: Modifier,
    darkTheme: Boolean,
) {
    val bgColor = if (darkTheme) "#1A1A24" else "#FFFFFF"
    val textColor = if (darkTheme) "#E2E8F0" else "#1E293B"
    val linkColor = if (darkTheme) "#818CF8" else "#4F46E5"

    val wrappedHtml = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 15px;
                    line-height: 1.6;
                    color: $textColor;
                    background-color: $bgColor;
                    margin: 0;
                    padding: 12px;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                a { color: $linkColor; }
                img { max-width: 100%; height: auto; }
                pre, code {
                    overflow-x: auto;
                    max-width: 100%;
                    font-size: 13px;
                }
                table { max-width: 100%; border-collapse: collapse; }
                td, th { padding: 4px 8px; }
                blockquote {
                    border-left: 3px solid $linkColor;
                    margin-left: 0;
                    padding-left: 12px;
                    opacity: 0.8;
                }
            </style>
        </head>
        <body>$html</body>
        </html>
    """.trimIndent()

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                webViewClient = WebViewClient()
                settings.apply {
                    javaScriptEnabled = false
                    loadWithOverviewMode = true
                    useWideViewPort = true
                    builtInZoomControls = true
                    displayZoomControls = false
                    setSupportZoom(true)
                    blockNetworkImage = true
                    blockNetworkLoads = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                }
                setBackgroundColor(android.graphics.Color.parseColor(bgColor))
                loadDataWithBaseURL(null, wrappedHtml, "text/html", "UTF-8", null)
            }
        },
        update = { webView ->
            webView.loadDataWithBaseURL(null, wrappedHtml, "text/html", "UTF-8", null)
        },
        modifier = modifier,
    )
}
