plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.chaquo.python")
}

// CI passes these through environment variables (see .github/workflows/build-apk.yml)
val appVersionName = System.getenv("VERSION_NAME") ?: "1.0.0"
val appVersionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
val keystorePath: String? = System.getenv("KEYSTORE_PATH")

android {
    namespace = "tj.pythontaj.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "tj.pythontaj.app"
        minSdk = 26
        targetSdk = 34
        versionCode = appVersionCode
        versionName = appVersionName
        // Chaquopy needs explicit ABIs. Real phones: arm64-v8a / armeabi-v7a; x86_64 for emulators.
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}

chaquopy {
    defaultConfig {
        version = "3.11"
    }
    sourceSets {
        // python/runner.py lives at the repository root so it can be unit-tested on a desktop
        getByName("main") { srcDir("../../python") }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
