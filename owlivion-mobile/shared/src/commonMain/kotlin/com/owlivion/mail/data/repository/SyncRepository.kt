package com.owlivion.mail.data.repository

import com.owlivion.mail.core.*

class SyncRepository(private val bridge: OwlivionBridge) {

    // Auth
    suspend fun register(email: String, password: String, masterPassword: String) {
        bridge.syncRegister(email, password, masterPassword)
    }

    suspend fun login(email: String, password: String) {
        bridge.syncLogin(email, password)
    }

    suspend fun logout() {
        bridge.syncLogout()
    }

    // Sync
    suspend fun startSync(masterPassword: String): SyncResult {
        return bridge.syncStart(masterPassword)
    }

    suspend fun getConfig(): SyncConfig {
        return bridge.syncGetConfig()
    }

    suspend fun getStatus(): List<SyncStatus> {
        return bridge.syncGetStatus()
    }

    // Devices
    suspend fun listDevices(): List<DeviceInfo> {
        return bridge.syncListDevices()
    }

    suspend fun revokeDevice(deviceId: String) {
        bridge.syncRevokeDevice(deviceId)
    }

    // Queue
    fun getQueueStats(): QueueStats {
        return bridge.syncGetQueueStats()
    }

    fun retryFailed(): Int {
        return bridge.syncRetryFailed()
    }

    fun clearCompletedQueue(olderThanDays: Int = 7): Int {
        return bridge.syncClearCompletedQueue(olderThanDays)
    }

    fun clearFailedQueue(): Int {
        return bridge.syncClearFailedQueue()
    }

    // History
    suspend fun getHistory(dataType: String, limit: Int = 20): List<SyncSnapshot> {
        return bridge.syncGetHistory(dataType, limit)
    }

    // Scheduler
    suspend fun schedulerStart() {
        bridge.schedulerStart()
    }

    suspend fun schedulerStop() {
        bridge.schedulerStop()
    }

    suspend fun schedulerGetStatus(): SchedulerStatus {
        return bridge.schedulerGetStatus()
    }
}
