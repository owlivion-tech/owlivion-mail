# ============================================================================
# Owlivion Mail - ProGuard/R8 Rules
# ============================================================================

# --- General ---
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# --- UniFFI / JNA (CRITICAL - DO NOT REMOVE) ---
# UniFFI generated bindings use JNA for FFI calls
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-dontwarn com.sun.jna.**

# Keep all UniFFI generated code
-keep class uniffi.owlivion_core.** { *; }
-keepclassmembers class uniffi.owlivion_core.** { *; }

# --- Kotlin Serialization ---
-keepattributes RuntimeVisibleAnnotations
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}
# Keep serializers
-keepclassmembers class ** {
    *** Companion;
}
-keepclasseswithmembers class ** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.owlivion.mail.**$$serializer { *; }
-keepclassmembers class com.owlivion.mail.** {
    *** Companion;
}
-keepclasseswithmembers class com.owlivion.mail.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep data service serializable classes
-keep class com.owlivion.mail.data.service.GeminiRequest { *; }
-keep class com.owlivion.mail.data.service.GeminiResponse { *; }
-keep class com.owlivion.mail.data.service.GeminiContent { *; }
-keep class com.owlivion.mail.data.service.GeminiPart { *; }
-keep class com.owlivion.mail.data.service.GeminiCandidate { *; }
-keep class com.owlivion.mail.data.service.SafetySetting { *; }
-keep class com.owlivion.mail.data.service.PhishingAnalysis { *; }

# --- Ktor ---
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**
-keep class io.netty.** { *; }
-dontwarn io.netty.**

# --- Koin ---
-keep class org.koin.** { *; }
-dontwarn org.koin.**

# --- Voyager ---
-keep class cafe.adriel.voyager.** { *; }
-dontwarn cafe.adriel.voyager.**

# --- Compose ---
-dontwarn androidx.compose.**

# --- OkHttp (Ktor engine) ---
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# --- Coroutines ---
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}

# --- R8 full mode compatibility ---
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
