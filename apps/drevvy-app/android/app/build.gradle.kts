import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // TODO: After replacing android/app/google-services.json.example with a real
    // google-services.json, apply id("com.google.gms.google-services").
}

// Play upload key. Release builds (bundleRelease / assembleRelease) require
// gitignored android/key.properties. Debug and profile builds do not.
// See https://flutter.dev/to/reference-keystore
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    FileInputStream(keystorePropertiesFile).use { keystoreProperties.load(it) }
}

val releaseSigningPropertyNames = listOf("storePassword", "keyPassword", "keyAlias", "storeFile")

fun collectReleaseSigningProblems(): List<String> {
    if (!keystorePropertiesFile.exists()) {
        return listOf("android/key.properties is missing")
    }
    val problems = mutableListOf<String>()
    for (name in releaseSigningPropertyNames) {
        if (keystoreProperties.getProperty(name).isNullOrBlank()) {
            problems += "android/key.properties is missing $name"
        }
    }
    val storePath = keystoreProperties.getProperty("storeFile")
    if (!storePath.isNullOrBlank()) {
        val store = file(storePath)
        if (!store.isFile) {
            problems += "upload keystore not found at ${store.absolutePath}"
        }
    }
    return problems
}

val releaseSigningProblems = collectReleaseSigningProblems()
val releaseSigningReady = releaseSigningProblems.isEmpty()

fun releaseSigningError(): String = buildString {
    appendLine("Cannot sign the Android release build.")
    releaseSigningProblems.forEach { appendLine("- $it") }
    appendLine(
        "Create gitignored android/key.properties with storePassword, keyPassword, keyAlias, and storeFile.",
    )
    appendLine("Debug and profile builds do not read this file.")
    append("See https://flutter.dev/to/reference-keystore")
}

android {
    namespace = "com.drevvy.drevvy_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Google's Android OAuth client must use this package name plus the
        // app signing SHA-1. iOS uses com.drevvy.drevvyApp. See docs/drevvy/SHOPPER_SIGN_IN.md.
        applicationId = "com.drevvy.drevvy_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // Superwall requires 26. RevenueCat requires 21.
        minSdk = maxOf(flutter.minSdkVersion, 26)
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (releaseSigningReady) {
            val storePath = keystoreProperties.getProperty("storeFile")
                ?: error("storeFile missing from android/key.properties")
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(storePath)
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            // Unsigned unless android/key.properties is complete. checkReleaseSigning
            // fails bundleRelease and assembleRelease in that case. Do not fall back
            // to the debug keystore.
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("com.android.installreferrer:installreferrer:2.2")
}

// Gate every release task so `flutter build appbundle --release` and
// `flutter build apk --release` stop here instead of signing with the debug key.
val checkReleaseSigning = tasks.register("checkReleaseSigning") {
    group = "verification"
    description = "Fails release builds when the Play upload keystore is missing or incomplete."
    doLast {
        if (releaseSigningProblems.isNotEmpty()) {
            throw GradleException(releaseSigningError())
        }
    }
}

tasks.configureEach {
    if (name != "checkReleaseSigning" && "Release" in name) {
        dependsOn(checkReleaseSigning)
    }
}
