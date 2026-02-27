package com.owlivion.mail

import androidx.compose.runtime.Composable
import cafe.adriel.voyager.navigator.Navigator
import cafe.adriel.voyager.transitions.SlideTransition
import com.owlivion.mail.theme.OwlivionTheme
import com.owlivion.mail.ui.screen.WelcomeScreen

@Composable
fun App() {
    OwlivionTheme {
        Navigator(WelcomeScreen()) { navigator ->
            SlideTransition(navigator)
        }
    }
}
