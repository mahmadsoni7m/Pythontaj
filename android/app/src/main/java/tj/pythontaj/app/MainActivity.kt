package tj.pythontaj.app

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

/**
 * Hosts the PythonТаҷ web UI (assets/www) inside a locked-down WebView.
 * The page is served from https://appassets.androidplatform.net/ so IndexedDB, crypto.subtle and
 * fetch() work exactly as on the web, without any file:// access.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var bridge: AppBridge
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val cb = fileCallback
        fileCallback = null
        cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            setBackgroundColor(0xFF090B14.toInt())
        }
        setContentView(webView)

        val debuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true            // required for IndexedDB / localStorage
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            textZoom = 100
            mediaPlaybackRequiresUserGesture = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        val loader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == HOST) return false
                if (url.scheme == "https") {
                    try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (_: Exception) { /* no browser */ }
                }
                return true // never navigate the app WebView away from our own origin
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                android.util.Log.d("PythonTaj", "${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                return true
            }

            override fun onShowFileChooser(
                view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    filePicker.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        bridge = AppBridge(this, webView)
        webView.addJavascriptInterface(bridge, "AndroidApp")
        bridge.preload() // start Python in the background so the first run is fast

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState == null) webView.loadUrl(START_URL) else webView.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() { super.onPause(); webView.onPause() }
    override fun onResume() { super.onResume(); webView.onResume() }

    override fun onDestroy() {
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val START_URL = "https://$HOST/assets/www/index.html"
    }
}
