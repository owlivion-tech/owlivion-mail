package com.owlivion.mail.data.repository

import com.owlivion.mail.core.*

class FilterRepository(private val bridge: OwlivionBridge) {

    suspend fun listFilters(accountId: Long): List<EmailFilter> {
        return bridge.filterList(accountId)
    }

    suspend fun getFilter(filterId: Long): EmailFilter {
        return bridge.filterGet(filterId)
    }

    suspend fun addFilter(
        accountId: Long,
        name: String,
        description: String? = null,
        isEnabled: Boolean = true,
        priority: Int = 0,
        matchLogic: String = "all",
        conditionsJson: String = "[]",
        actionsJson: String = "[]",
    ): Long {
        return bridge.filterAdd(accountId, name, description, isEnabled, priority, matchLogic, conditionsJson, actionsJson)
    }

    suspend fun updateFilter(
        filterId: Long,
        accountId: Long,
        name: String,
        description: String? = null,
        isEnabled: Boolean = true,
        priority: Int = 0,
        matchLogic: String = "all",
        conditionsJson: String = "[]",
        actionsJson: String = "[]",
    ) {
        bridge.filterUpdate(filterId, accountId, name, description, isEnabled, priority, matchLogic, conditionsJson, actionsJson)
    }

    suspend fun deleteFilter(filterId: Long) {
        bridge.filterDelete(filterId)
    }

    suspend fun toggleFilter(filterId: Long) {
        bridge.filterToggle(filterId)
    }
}
