plugins {
    id("com.android.application") version "8.7.0"
    id("org.jetbrains.kotlin.android") version "2.0.20"
}

android {
    namespace = "com.hunbatz.studio"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.hunbatz.studio"
        minSdk = 28 // Android 9+ (supports Fire OS & Galaxy Tabs)
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        ndk {
            abiFilters += listOf("arm64-v8a", "x86_64")
        }
    }
}
