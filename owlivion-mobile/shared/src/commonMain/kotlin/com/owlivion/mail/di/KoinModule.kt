package com.owlivion.mail.di

import com.owlivion.mail.core.OwlivionBridge
import com.owlivion.mail.data.repository.AccountRepository
import com.owlivion.mail.data.repository.EmailRepository
import com.owlivion.mail.data.repository.FilterRepository
import com.owlivion.mail.data.repository.OAuthRepository
import com.owlivion.mail.data.repository.SyncRepository
import com.owlivion.mail.data.repository.TemplateRepository
import com.owlivion.mail.data.repository.LabelRepository
import com.owlivion.mail.data.repository.AliasRepository
import com.owlivion.mail.data.repository.AIRepository
import com.owlivion.mail.data.service.GeminiService
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.module

val sharedModule = module {
    single { OwlivionBridge() }
    singleOf(::AccountRepository)
    singleOf(::EmailRepository)
    singleOf(::FilterRepository)
    singleOf(::TemplateRepository)
    singleOf(::SyncRepository)
    singleOf(::OAuthRepository)
    singleOf(::LabelRepository)
    singleOf(::AliasRepository)
    singleOf(::GeminiService)
    singleOf(::AIRepository)
}
