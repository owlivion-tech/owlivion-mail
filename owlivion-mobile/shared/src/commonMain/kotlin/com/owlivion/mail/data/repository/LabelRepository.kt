package com.owlivion.mail.data.repository

import com.owlivion.mail.core.Label
import com.owlivion.mail.core.OwlivionBridge

class LabelRepository(private val bridge: OwlivionBridge) {

    fun create(accountId: Long?, name: String, color: String): Label {
        return bridge.labelCreate(accountId, name, color)
    }

    fun list(accountId: Long?): List<Label> {
        return bridge.labelList(accountId)
    }

    fun update(id: Long, name: String? = null, color: String? = null): Label {
        return bridge.labelUpdate(id, name, color)
    }

    fun delete(id: Long) {
        bridge.labelDelete(id)
    }

    fun addToEmail(emailId: Long, labelId: Long) {
        bridge.emailAddLabel(emailId, labelId)
    }

    fun removeFromEmail(emailId: Long, labelId: Long) {
        bridge.emailRemoveLabel(emailId, labelId)
    }

    fun getForEmail(emailId: Long): List<Label> {
        return bridge.emailGetLabels(emailId)
    }

    fun getEmailIds(labelId: Long): List<Long> {
        return bridge.labelGetEmailIds(labelId)
    }
}
