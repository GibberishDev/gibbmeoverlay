
// #region audio spectrum
const MIN_BUF_SIZE = 512
const FFT_SIZE = 8192
const cqt = new CQT({bandsNumber:128});
/** Cyclic Buffer for audio chunk processing */
const CB = new Float32Array(cqt.requiredSamples,FFT_SIZE)
/** current CB cyclic buffer write position */
let cbWritePos    = 0
let totalSamples  = 0
let cqtAwaitedSamples	= cqt.requiredSamples
const FRAME_INTERVAL = 1000/144
let lastTimeProcessed = 0

function processChunk(chunk) {
	/** Bytes per chunk frame. for 16bit interleaved stream its 16bit left+ 16bit right for total of 4 bytes*/
	const BPF   = 4
	const BYTES = chunk.length-(chunk.length%BPF)

	for (let offset=0;offset<BYTES;offset+=BPF) {
		const left  =chunk.readInt16LE(offset)/32768
		const right =chunk.readInt16LE(offset)/32768
		const mono  =(left+right)/2.0

		CB[cbWritePos]=mono
		cbWritePos = (cbWritePos+1)%cqt.requiredSamples
		totalSamples++

		if (totalSamples>=cqt.requiredSamples) {
			cqtAwaitedSamples--
			if (cqtAwaitedSamples<=0) {
				cqtAwaitedSamples = MIN_BUF_SIZE
				processSamples()
			}
		}
	}
}
function processSamples() {
	if (performance.now() - lastTimeProcessed >= FRAME_INTERVAL) {
		lastTimeProcessed = performance.now()
		const samples = getOrderedSamples()
		const magnitudes = Array.from(cqt.process(samples))
		const spectrum = {
			freq: Array.from(cqt.getFrequencies()),
			mag: magnitudes,
			db: getDecibels(magnitudes),
			nm: getNormalizedMagnitudes(magnitudes),
			ndb: getDecibels(getNormalizedMagnitudes(magnitudes))
		}
		sendSpectrum(spectrum)
		
	}
}
function getDecibels(mags) {
	let db = []
	for (let mag of mags) db.push(Math.max(0,Math.min(1, ((20*Math.log10(Math.max(mag,1e-8)))+80)/80)))
	return db
}
function getNormalizedMagnitudes(mags) {
	let nm = []
	for (let mag of mags) nm.push(mag * Math.pow(20000/1000,0.9))
	return nm
}
function getOrderedSamples() {
	const ordered = new Float32Array(cqt.requiredSamples)
	const cyclicBufferStart = cqt.requiredSamples - cbWritePos

	ordered.set(CB.subarray(cbWritePos),0)
	ordered.set(CB.subarray(0,cbWritePos), cyclicBufferStart)

	return ordered
}
function sendSpectrum(spectrum) {
	console.log(spectrum)
	// WINDOW.webContents.send('spectrum', spectrum)
}

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

// #endregion