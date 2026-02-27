package com.owlivion.mail.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Dark Theme Colors (from CSS variables)
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF6366F1),           // accent: #6366f1
    onPrimary = Color.White,
    primaryContainer = Color(0xFF4338CA),
    secondary = Color(0xFF818CF8),
    background = Color(0xFF0F0F17),        // bg: #0f0f17
    onBackground = Color(0xFFE2E8F0),
    surface = Color(0xFF1A1A24),           // surface: #1a1a24
    onSurface = Color(0xFFE2E8F0),
    surfaceVariant = Color(0xFF252530),
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF334155),
    error = Color(0xFFEF4444),
    onError = Color.White,
    errorContainer = Color(0xFF3B1212),
    onErrorContainer = Color(0xFFFCA5A5),
)

// Light Theme Colors (from CSS variables)
private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF4F46E5),           // accent: #4F46E5
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0E7FF),
    secondary = Color(0xFF6366F1),
    background = Color(0xFFF8FAFC),        // bg: #F8FAFC
    onBackground = Color(0xFF1E293B),
    surface = Color(0xFFFFFFFF),           // surface: #FFFFFF
    onSurface = Color(0xFF1E293B),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF64748B),
    outline = Color(0xFFCBD5E1),
    error = Color(0xFFDC2626),
    onError = Color.White,
    errorContainer = Color(0xFFFEE2E2),
    onErrorContainer = Color(0xFF991B1B),
)

@Composable
fun OwlivionTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        shapes = Shapes(
            small = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
            medium = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
            large = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        ),
        content = content,
    )
}
