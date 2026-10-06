//! System-audio loopback spectrum for the visualizer widget.
//! On WASAPI, opening an *input* stream on the default *output* device gives
//! a loopback capture of whatever is playing.

use tauri::AppHandle;

pub const BANDS: usize = 64;

#[cfg(feature = "audio")]
pub fn spawn(app: AppHandle) {
    use crate::state::AppState;
    use std::sync::atomic::Ordering;
    use std::time::Duration;
    use tauri::Manager;

    std::thread::spawn(move || loop {
        let enabled = {
            let st = app.state::<AppState>();
            st.audio_enabled.load(Ordering::Relaxed) && !st.all_paused.load(Ordering::Relaxed)
        };
        if !enabled {
            std::thread::sleep(Duration::from_millis(500));
            continue;
        }
        if let Err(e) = capture::run(&app) {
            eprintln!("[aquawall] audio capture: {e}");
            std::thread::sleep(Duration::from_secs(3));
        }
    });
}

#[cfg(not(feature = "audio"))]
pub fn spawn(_app: AppHandle) {}

#[cfg(feature = "audio")]
mod capture {
    use super::BANDS;
    use crate::state::AppState;
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use rustfft::{num_complex::Complex, FftPlanner};
    use std::collections::VecDeque;
    use std::sync::atomic::Ordering;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use tauri::{AppHandle, Emitter, Manager};

    const N: usize = 2048;

    fn push(buf: &Mutex<VecDeque<f32>>, frames: impl Iterator<Item = f32>) {
        let mut b = buf.lock().unwrap();
        for s in frames {
            b.push_back(s);
        }
        while b.len() > N * 2 {
            b.pop_front();
        }
    }

    pub fn run(app: &AppHandle) -> Result<(), String> {
        let host = cpal::default_host();
        let device = host.default_output_device().ok_or("no output device")?;
        let supported = device.default_output_config().map_err(|e| e.to_string())?;
        let channels = supported.channels().max(1) as usize;
        let rate = supported.sample_rate().0 as f32;
        let format = supported.sample_format();
        let config: cpal::StreamConfig = supported.into();
        let buf = Arc::new(Mutex::new(VecDeque::with_capacity(N * 2)));

        let b = buf.clone();
        let stream = match format {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    push(&b, data.chunks(channels).map(|f| f.iter().sum::<f32>() / channels as f32))
                },
                |e| eprintln!("[aquawall] audio stream: {e}"),
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    push(
                        &b,
                        data.chunks(channels)
                            .map(|f| f.iter().map(|s| *s as f32 / 32768.0).sum::<f32>() / channels as f32),
                    )
                },
                |e| eprintln!("[aquawall] audio stream: {e}"),
                None,
            ),
            other => return Err(format!("unsupported sample format {other:?}")),
        }
        .map_err(|e| e.to_string())?;
        stream.play().map_err(|e| e.to_string())?;

        let fft = FftPlanner::<f32>::new().plan_fft_forward(N);
        let window: Vec<f32> = (0..N)
            .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (N - 1) as f32).cos())
            .collect();
        // Log-spaced band edges, 30 Hz .. 16 kHz.
        let (lo, hi) = (30.0f32, 16000.0f32.min(rate / 2.0));
        let edges: Vec<usize> = (0..=BANDS)
            .map(|i| {
                let f = lo * (hi / lo).powf(i as f32 / BANDS as f32);
                ((f / rate * N as f32) as usize).clamp(1, N / 2 - 1)
            })
            .collect();
        let mut smooth = vec![0f32; BANDS];
        let mut spectrum = vec![Complex::new(0f32, 0f32); N];

        loop {
            std::thread::sleep(Duration::from_millis(33));
            {
                let st = app.state::<AppState>();
                if !st.audio_enabled.load(Ordering::Relaxed) || st.all_paused.load(Ordering::Relaxed) {
                    break;
                }
            }
            {
                let b = buf.lock().unwrap();
                let start = b.len().saturating_sub(N);
                let pad = N - (b.len() - start);
                for i in 0..N {
                    let s = if i < pad { 0.0 } else { b[start + i - pad] };
                    spectrum[i] = Complex::new(s * window[i], 0.0);
                }
            }
            fft.process(&mut spectrum);
            for k in 0..BANDS {
                let (a, z) = (edges[k], edges[k + 1].max(edges[k] + 1));
                let mut m = 0f32;
                for c in &spectrum[a..z] {
                    m = m.max(c.norm());
                }
                let db = 20.0 * (m / (N as f32 / 4.0) + 1e-9).log10();
                let v = ((db + 70.0) / 60.0).clamp(0.0, 1.0);
                smooth[k] = if v > smooth[k] { v * 0.7 + smooth[k] * 0.3 } else { smooth[k] * 0.85 + v * 0.15 };
            }
            let _ = app.emit("audio-spectrum", &smooth);
        }
        drop(stream);
        Ok(())
    }
}
