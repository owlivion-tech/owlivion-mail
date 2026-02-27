package com.owlivion.mail.ui.viewmodel

import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import com.owlivion.mail.core.DbEmailSummary
import com.owlivion.mail.data.repository.EmailRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SearchState(
    val query: String = "",
    val results: List<DbEmailSummary> = emptyList(),
    val isSearching: Boolean = false,
    val hasSearched: Boolean = false,
    val errorMessage: String? = null,
)

class SearchViewModel(
    private val emailRepo: EmailRepository,
    private val accountId: String,
) : ScreenModel {

    private val _state = MutableStateFlow(SearchState())
    val state: StateFlow<SearchState> = _state.asStateFlow()

    private var searchJob: Job? = null

    fun updateQuery(query: String) {
        _state.value = _state.value.copy(query = query)
        // Debounced search
        searchJob?.cancel()
        if (query.length >= 2) {
            searchJob = screenModelScope.launch {
                delay(300)
                performSearch(query)
            }
        } else if (query.isEmpty()) {
            _state.value = _state.value.copy(results = emptyList(), hasSearched = false)
        }
    }

    fun search() {
        val query = _state.value.query.trim()
        if (query.isNotEmpty()) {
            searchJob?.cancel()
            searchJob = screenModelScope.launch {
                performSearch(query)
            }
        }
    }

    private suspend fun performSearch(query: String) {
        _state.value = _state.value.copy(isSearching = true, errorMessage = null)
        try {
            val results = emailRepo.searchEmails(accountId, query)
            _state.value = _state.value.copy(
                results = results,
                isSearching = false,
                hasSearched = true,
            )
        } catch (e: Exception) {
            _state.value = _state.value.copy(
                isSearching = false,
                hasSearched = true,
                errorMessage = "Arama basarisiz: ${e.message}",
            )
        }
    }

    fun clearSearch() {
        searchJob?.cancel()
        _state.value = SearchState()
    }
}
