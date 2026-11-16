import SwiftUI

@main
struct HunbatzApp: App {
    // Initializes the shared Rust HunbatzEngine via UniFFI bindings
    private let engine = HunbatzEngine(width: 2048, height: 2048)

    var body: some Scene {
        WindowGroup {
            MetalCanvasContainer(engine: engine)
                .ignoresSafeArea()
                .statusBarHidden(true)
        }
    }
}
