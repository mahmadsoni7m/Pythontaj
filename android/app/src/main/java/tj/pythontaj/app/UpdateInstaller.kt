package tj.pythontaj.app

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Downloads a new APK from this project's GitHub Releases, verifies its SHA-256 (published next to the
 * APK) and package name / version, then hands it to the system installer. The system installer
 * additionally refuses any APK that is not signed with the same key as the installed app.
 */
class UpdateInstaller(
    private val activity: MainActivity,
    private val emit: (String) -> Unit,
) {
    fun start(apkUrl: String, shaUrl: String, repo: String) {
        Thread { run(apkUrl, shaUrl, repo) }.start()
    }

    private fun event(stage: String, percent: Int = 0, message: String = "") =
        emit(JSONObject().put("stage", stage).put("percent", percent).put("message", message).toString())

    private fun run(apkUrl: String, shaUrl: String, repo: String) {
        val out = File(File(activity.cacheDir, "updates"), "PythonTaj.apk")
        try {
            require(Regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$").matches(repo)) { "Invalid repository" }
            val prefix = "https://github.com/$repo/releases/download/"
            require(apkUrl.startsWith(prefix) && shaUrl.startsWith(prefix)) { "Untrusted download address" }

            val expected = readSmall(shaUrl).trim().split(Regex("\\s+")).firstOrNull()?.lowercase().orEmpty()
            require(Regex("^[0-9a-f]{64}$").matches(expected)) { "Invalid checksum file" }

            out.parentFile?.deleteRecursively()
            out.parentFile?.mkdirs()
            val actual = download(apkUrl, out)
            check(actual == expected) { "Checksum mismatch — the file was not installed" }

            val pm = activity.packageManager
            val info = pm.getPackageArchiveInfo(out.absolutePath, 0) ?: error("Not a valid APK")
            check(info.packageName == activity.packageName) { "APK belongs to another app" }
            val current = PackageInfoCompat.getLongVersionCode(pm.getPackageInfo(activity.packageName, 0))
            check(PackageInfoCompat.getLongVersionCode(info) > current) { "The downloaded APK is not newer" }
            event("verified")

            if (!pm.canRequestPackageInstalls()) {
                activity.runOnUiThread {
                    activity.startActivity(
                        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
                    )
                }
                event("error", message = "Иҷозати насбро фаъол кунед ва бори дигар кӯшиш кунед")
                return
            }
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", out)
            val install = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.runOnUiThread { activity.startActivity(install) }
            event("install")
        } catch (e: Exception) {
            out.delete()
            event("error", message = e.message ?: e.javaClass.simpleName)
        }
    }

    private fun open(url: String): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000
        c.readTimeout = 30_000
        c.instanceFollowRedirects = true
        c.connect()
        check(c.responseCode == 200) { "HTTP ${c.responseCode}" }
        check(c.url.protocol == "https") { "Redirected to a non-HTTPS address" }
        return c
    }

    private fun readSmall(url: String): String {
        val c = open(url)
        try {
            val buf = ByteArray(4096)
            val n = c.inputStream.use { it.read(buf) }
            return if (n <= 0) "" else String(buf, 0, n, Charsets.UTF_8)
        } finally { c.disconnect() }
    }

    private fun download(url: String, target: File): String {
        val c = open(url)
        try {
            val total = c.contentLengthLong
            val md = MessageDigest.getInstance("SHA-256")
            var done = 0L
            var lastPct = -1
            c.inputStream.use { input ->
                target.outputStream().use { output ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        output.write(buf, 0, n)
                        md.update(buf, 0, n)
                        done += n
                        check(done <= MAX_BYTES) { "File is too large" }
                        if (total > 0) {
                            val pct = (done * 100 / total).toInt()
                            if (pct != lastPct && pct % 5 == 0) { lastPct = pct; event("progress", pct) }
                        }
                    }
                }
            }
            return md.digest().joinToString("") { "%02x".format(it) }
        } finally { c.disconnect() }
    }

    companion object { private const val MAX_BYTES = 250L * 1024 * 1024 }
}
