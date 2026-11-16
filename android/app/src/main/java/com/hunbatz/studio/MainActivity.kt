package com.hunbatz.studio

import android.app.Activity
import android.os.Bundle
import android.view.MotionEvent
import android.view.SurfaceView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        System.loadLibrary("hunbatz_ffi") // Loads compiled Rust engine

        val canvasView = SurfaceView(this).apply {
            setOnTouchListener { _, event ->
                // Direct S-Pen / Stylus hardware coordinates -> Rust engine
                if (event.actionMasked == MotionEvent.ACTION_MOVE || event.actionMasked == MotionEvent.ACTION_DOWN) {
                    val pressure = event.pressure
                    val tilt = event.getAxisValue(MotionEvent.AXIS_TILT)
                    // Passes straight to UniFFI HunbatzEngine.onPenInput(...)
                }
                true
            }
        }
        setContentView(canvasView)
    }
}
