import { startCapture, stopCapture } from "electron-native-screenshare";


function float32ToInt16PCM(floatBuffer) {
  if (floatBuffer.length % 4 !== 0) {
    throw new Error("Buffer length must be divisible by 4");
  }
  const sampleCount = floatBuffer.length / 4;
  const pcm16 = Buffer.allocUnsafe(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    let sample = floatBuffer.readFloatLE(i * 4);
    sample = Math.max(-1, Math.min(1, sample));
    const int16 = sample < 0
      ? Math.round(sample * 32768)
      : Math.round(sample * 32767);
    pcm16.writeInt16LE(int16, i * 2);
  }
  return pcm16;
}