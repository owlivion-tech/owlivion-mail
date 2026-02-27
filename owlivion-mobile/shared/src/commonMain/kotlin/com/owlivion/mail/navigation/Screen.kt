package com.owlivion.mail.navigation

/**
 * Navigation routes for the app.
 */
sealed class AppRoute(val route: String) {
    data object Welcome : AppRoute("welcome")
    data object AccountSetup : AppRoute("account_setup")
    data object Inbox : AppRoute("inbox")
    data class EmailDetail(val accountId: String, val uid: Long) : AppRoute("email/$accountId/$uid")
    data object Compose : AppRoute("compose")
    data object Search : AppRoute("search")
    data object Settings : AppRoute("settings")
}
