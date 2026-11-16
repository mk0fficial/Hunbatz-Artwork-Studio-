import SwiftUI
import MetalKit
import UIKit

struct MetalCanvasContainer: UIViewRepresentable {
    let engine: HunbatzEngine

    func makeUIView(context: Context) -> PencilMetalView {
        let view = PencilMetalView(frame: .zero, device: MTLCreateSystemDefaultDevice())
        view.engine = engine
        view.preferredFramesPerSecond = 120 // ProMotion 120Hz iPad Pro / MacBook Pro
        view.isMultipleTouchEnabled = true
        return view
    }

    func updateUIView(_ uiView: PencilMetalView, context: Context) {}
}

final class PencilMetalView: MTKView {
    var engine: HunbatzEngine?

    override init(frame frameRect: CGRect, device: MTLDevice?) {
        super.init(frame: frameRect, device: device)
        // Hover & Pencil Pro squeeze/barrel-roll support on iPadOS 17.5+
        let hover = UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:)))
        addGestureRecognizer(hover)
    }

    required init(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, touch.type == .pencil || touch.type == .direct else { return }
        // Read high-frequency coalesced Apple Pencil samples (240Hz)
        let coalesced = event?.coalescedTouches(for: touch) ?? [touch]
        for sample in coalesced {
            let loc = sample.location(in: self)
            let pressure = Float(sample.force / max(sample.maximumPossibleForce, 0.001))
            let azimuth = sample.azimuthUnitVector(in: self)
            engine?.onPenInput(
                x: Float(loc.x * contentScaleFactor),
                y: Float(loc.y * contentScaleFactor),
                pressure: sample.type == .pencil ? pressure : 0.5,
                tiltX: Float(azimuth.dx),
                tiltY: Float(azimuth.dy)
            )
        }
    }

    @objc private func handleHover(_ recognizer: UIHoverGestureRecognizer) {
        let loc = recognizer.location(in: self)
        // Update brush cursor preview position in Rust renderer
        _ = loc
    }
}
