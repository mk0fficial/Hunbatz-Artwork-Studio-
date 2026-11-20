import SwiftUI
import WebKit

@main
struct HunbatzApp: App {
    var body: some Scene {
        WindowGroup {
            HunbatzWebView()
                .ignoresSafeArea()
                .statusBarHidden(true)
        }
    }
}

struct HunbatzWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false

        if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "dist") {
            webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
