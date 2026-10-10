package tj.pythontaj.app

import android.content.Intent
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/**
 * JavaScript bridge exposed to the web UI as `window.AndroidApp`.
 * Only pages of our own origin can reach it (the WebView never navigates elsewhere).
 * Every argument coming from JavaScript is size-checked before use.
 */
class AppBridge(private val activity: MainActivity, private val webView: WebView) {

    private val executor = Executors.newSingleThreadExecutor()

    private fun py(): Python {
        if (!Python.isStarted()) Python.start(AndroidPlatform(activity.applicationContext))
        return Python.getInstance()
    }

    private fun runner() = py().getModule("runner")

    private fun workspace(): String {
        val dir = File(activity.filesDir, "pyws")
        dir.mkdirs()
        return dir.absolutePath
    }

    fun preload() {
        executor.execute { try { runner() } catch (_: Throwable) { /* reported on first run */ } }
    }

    private fun js(code: String) = activity.runOnUiThread { webView.evaluateJavascript(code, null) }

    private fun deliver(id: String, json: String) =
        js("window.__ptNative.onPyResult(${JSONObject.quote(id)},${JSONObject.quote(json)})")

    private fun errorJson(id: String, message: String): String = JSONObject().apply {
        put("id", id); put("ok", false); put("stdout", ""); put("stderr", "")
        put("error", JSONObject().apply {
            put("type", "RuntimeError"); put("message", message); put("line", JSONObject.NULL); put("traceback", message)
        })
        put("timedOut", false); put("stopped", false); put("truncated", false); put("durationMs", 0)
    }.toString()

    private fun tooBig(code: String, stdin: String) = code.length > MAX_CODE || stdin.length > MAX_STDIN

    @JavascriptInterface
    fun pyRun(id: String, code: String, stdin: String, timeoutSec: Int) {
        if (tooBig(code, stdin)) { deliver(id, errorJson(id, "Code or input is too large")); return }
        val timeout = timeoutSec.coerceIn(1, 30).toDouble()
        executor.execute {
            val json = try {
                runner().callAttr("run", id, code, stdin, workspace(), timeout).toString()
            } catch (e: Throwable) {
                errorJson(id, e.message ?: e.javaClass.simpleName)
            }
            deliver(id, json)
        }
    }

    @JavascriptInterface
    fun pyRepl(id: String, session: String, source: String, timeoutSec: Int) {
        if (tooBig(source, "")) { deliver(id, errorJson(id, "Code is too large")); return }
        val timeout = timeoutSec.coerceIn(1, 30).toDouble()
        executor.execute {
            val json = try {
                runner().callAttr("repl", id, session.take(40), source, workspace(), timeout).toString()
            } catch (e: Throwable) {
                errorJson(id, e.message ?: e.javaClass.simpleName)
            }
            deliver(id, json)
        }
    }

    @JavascriptInterface
    fun pyReplReset(session: String) {
        executor.execute { try { runner().callAttr("repl_reset", session.take(40)) } catch (_: Throwable) { } }
    }

    /** Called from another thread than the one running the code, so it can interrupt it. */
    @JavascriptInterface
    fun pyStop(id: String) {
        try { runner().callAttr("stop", id) } catch (_: Throwable) { }
    }

    @JavascriptInterface
    fun pyVersion(): String = try { runner().callAttr("version").toString() } catch (_: Throwable) { "" }

    @JavascriptInterface
    fun shareText(name: String, text: String) {
        activity.runOnUiThread {
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, name.take(80))
                putExtra(Intent.EXTRA_TEXT, text.take(MAX_SHARE))
            }
            activity.startActivity(Intent.createChooser(send, null))
        }
    }

    @JavascriptInterface
    fun freeBytes(): String = activity.filesDir.usableSpace.toString()

    @JavascriptInterface
    fun installUpdate(apkUrl: String, shaUrl: String, repo: String) {
        UpdateInstaller(activity) { json -> js("window.__ptNative.onUpdate(${JSONObject.quote(json)})") }
            .start(apkUrl, shaUrl, repo)
    }

    companion object {
        private const val MAX_CODE = 200_000
        private const val MAX_STDIN = 50_000
        private const val MAX_SHARE = 500_000
    }
}
