package com.owlivion.mail.data.repository

import com.owlivion.mail.core.EmailAlias
import com.owlivion.mail.core.OwlivionBridge

class AliasRepository(private val bridge: OwlivionBridge) {

    fun add(accountId: Long, aliasEmail: String, aliasName: String? = null): Long {
        return bridge.aliasAdd(accountId, aliasEmail, aliasName)
    }

    fun list(accountId: Long): List<EmailAlias> {
        return bridge.aliasList(accountId)
    }

    fun update(aliasId: Long, aliasEmail: String? = null, aliasName: String? = null) {
        bridge.aliasUpdate(aliasId, aliasEmail, aliasName)
    }

    fun delete(aliasId: Long) {
        bridge.aliasDelete(aliasId)
    }

    fun toggle(aliasId: Long) {
        bridge.aliasToggle(aliasId)
    }

    fun setDefault(aliasId: Long, accountId: Long) {
        bridge.aliasSetDefault(aliasId, accountId)
    }
}
