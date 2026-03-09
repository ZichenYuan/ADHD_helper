/**
 * AudioWorklet processor that captures microphone audio,
 * downsamples to 16kHz 16-bit PCM, and sends chunks to the main thread.
 *
 * Key detail: `process()` is called ~375 times/sec with 128 samples each
 * (at 48 kHz). We must track the fractional resampling position across
 * calls so the output waveform is continuous — otherwise each block
 * restarts from sample 0 and the audio gets garbled.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buffer = []
    this._bufferSize = 2048 // ~128ms at 16kHz — good chunk size

    // Fractional sample offset carried over between process() calls.
    // Without this, non-integer ratios (e.g. 44100/16000 = 2.756)
    // cause phase jumps at every 128-sample boundary → noise/distortion.
    this._resampleOffset = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const inputData = input[0] // mono channel, Float32 at sampleRate

    // Downsample from sampleRate (44.1k or 48k) to 16kHz.
    // ratio = how many input samples correspond to one output sample.
    //   48000 / 16000 = 3.0    (integer — easy case)
    //   44100 / 16000 = 2.756  (fractional — needs interpolation)
    const ratio = sampleRate / 16000

    // Walk through input samples at `ratio`-sized steps, starting from
    // where we left off last call (_resampleOffset).
    let i = this._resampleOffset
    while (i < inputData.length) {
      const idx = Math.floor(i)
      const frac = i - idx // fractional part for interpolation

      // Linear interpolation between adjacent samples for smooth resampling.
      // Without this, nearest-neighbor picking at non-integer ratios
      // creates irregular spacing that distorts the waveform.
      const s0 = inputData[idx]
      const s1 = idx + 1 < inputData.length ? inputData[idx + 1] : s0
      const sample = Math.max(-1, Math.min(1, s0 + frac * (s1 - s0)))

      // Convert Float32 [-1, 1] → Int16 [-32768, 32767]
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      this._buffer.push(int16)

      i += ratio
    }

    // Save how far past the end of inputData we've stepped,
    // so the next call picks up at the correct fractional position.
    this._resampleOffset = i - inputData.length

    // Once we've accumulated enough samples, send a chunk to the main thread
    if (this._buffer.length >= this._bufferSize) {
      const chunk = this._buffer.splice(0, this._bufferSize)
      const int16Array = new Int16Array(chunk)
      this.port.postMessage(int16Array.buffer, [int16Array.buffer])
    }

    return true
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor)
