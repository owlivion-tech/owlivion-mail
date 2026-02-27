package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.ParsedEmail
import com.owlivion.mail.data.repository.EmailRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class ComposeType {
    NEW, REPLY, REPLY_ALL, FORWARD
}

data class ComposeState(
    val toRecipients: List<String> = emptyList(),
    val ccRecipients: List<String> = emptyList(),
    val bccRecipients: List<String> = emptyList(),
    val subject: String = "",
    val bodyText: String = "",
    val showCcBcc: Boolean = false,
    val isSending: Boolean = false,
    val isSent: Boolean = false,
    val errorMessage: String? = null,
    val composeType: ComposeType = ComposeType.NEW,
    val signature: String = "",
)

class ComposeViewModel(
    private val emailRepo: EmailRepository,
    private val accountId: String,
    composeType: ComposeType = ComposeType.NEW,
    private val originalEmail: ParsedEmail? = null,
    signature: String = "",
) : ScreenModel {

    private val _state = MutableStateFlow(ComposeState(composeType = composeType))
    val state: StateFlow<ComposeState> = _state.asStateFlow()

    init {
        val initial = buildInitialState(composeType, originalEmail, signature)
        _state.value = initial
    }

    private fun buildInitialState(
        type: ComposeType,
        email: ParsedEmail?,
        signature: String,
    ): ComposeState {
        if (email == null) {
            return ComposeState(
                composeType = type,
                signature = signature,
                bodyText = if (signature.isNotBlank()) "\n\n$signature" else "",
            )
        }

        val quotedBody = buildQuotedBody(email)

        return when (type) {
            ComposeType.NEW -> ComposeState(
                composeType = type,
                signature = signature,
                bodyText = if (signature.isNotBlank()) "\n\n$signature" else "",
            )

            ComposeType.REPLY -> ComposeState(
                composeType = type,
                toRecipients = listOf(email.from),
                subject = if (email.subject.startsWith("Re:", ignoreCase = true)) {
                    email.subject
                } else {
                    "Re: ${email.subject}"
                },
                bodyText = "${if (signature.isNotBlank()) "\n\n$signature" else ""}\n\n$quotedBody",
                signature = signature,
            )

            ComposeType.REPLY_ALL -> {
                val allTo = (listOf(email.from) + email.to).distinct()
                ComposeState(
                    composeType = type,
                    toRecipients = allTo,
                    ccRecipients = email.cc,
                    subject = if (email.subject.startsWith("Re:", ignoreCase = true)) {
                        email.subject
                    } else {
                        "Re: ${email.subject}"
                    },
                    bodyText = "${if (signature.isNotBlank()) "\n\n$signature" else ""}\n\n$quotedBody",
                    showCcBcc = email.cc.isNotEmpty(),
                    signature = signature,
                )
            }

            ComposeType.FORWARD -> ComposeState(
                composeType = type,
                subject = if (email.subject.startsWith("Fwd:", ignoreCase = true)) {
                    email.subject
                } else {
                    "Fwd: ${email.subject}"
                },
                bodyText = "${if (signature.isNotBlank()) "\n\n$signature" else ""}\n\n$quotedBody",
                signature = signature,
            )
        }
    }

    private fun buildQuotedBody(email: ParsedEmail): String {
        val header = "---------- ${email.date} tarihinde ${email.fromName ?: email.from} yazdı ----------"
        val body = email.bodyText ?: email.bodyHtml?.replace(Regex("<[^>]*>"), "") ?: ""
        val quoted = body.lines().joinToString("\n") { "> $it" }
        return "$header\n$quoted"
    }

    fun updateTo(recipients: List<String>) {
        _state.value = _state.value.copy(toRecipients = recipients)
    }

    fun updateCc(recipients: List<String>) {
        _state.value = _state.value.copy(ccRecipients = recipients)
    }

    fun updateBcc(recipients: List<String>) {
        _state.value = _state.value.copy(bccRecipients = recipients)
    }

    fun updateSubject(subject: String) {
        _state.value = _state.value.copy(subject = subject)
    }

    fun updateBody(body: String) {
        _state.value = _state.value.copy(bodyText = body)
    }

    fun toggleCcBcc() {
        _state.value = _state.value.copy(showCcBcc = !_state.value.showCcBcc)
    }

    fun clearError() {
        _state.value = _state.value.copy(errorMessage = null)
    }

    fun send() {
        val s = _state.value
        if (s.toRecipients.isEmpty() && s.ccRecipients.isEmpty() && s.bccRecipients.isEmpty()) {
            _state.value = s.copy(errorMessage = "En az bir alici gerekli")
            return
        }
        if (s.subject.isBlank()) {
            _state.value = s.copy(errorMessage = "Konu boş olamaz")
            return
        }

        screenModelScope.launch {
            _state.value = _state.value.copy(isSending = true, errorMessage = null)
            try {
                emailRepo.sendEmail(
                    accountId = accountId,
                    to = s.toRecipients,
                    cc = s.ccRecipients,
                    bcc = s.bccRecipients,
                    subject = s.subject,
                    bodyText = s.bodyText,
                )
                _state.value = _state.value.copy(isSending = false, isSent = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isSending = false,
                    errorMessage = "Gonderme basarisiz: ${e.message}",
                )
            }
        }
    }
}
