/*
I would credit original author but i legit cant find where i copied chunks from
I was drunk at 3am when writing this inside index.js and copying chunks of code from stackoverflow and reddit
best i can do is credit CQT research paper i was reading then: https://brendanjameslynskey.github.io/ConstantQ-Transform/
*/
export function createCQT({
	sampleRate = 48000,
	minFreq = 40,
	maxFreq = 20000,
	binsPerOctave = 63/Math.log2(20000/40) // for 64 bands
}={}) {
	const Q = 1 / (Math.pow(2, 1 / binsPerOctave) - 1);

	const bands = [];
	for (let k = 0; ; k++) {
		const freq = minFreq * Math.pow(2, k / binsPerOctave);
		if (freq >= maxFreq || freq >= sampleRate / 2) break;

		const length = Math.max(16, Math.ceil(Q * sampleRate / freq));
		const cos = new Float32Array(length);
		const sin = new Float32Array(length);
		const window = new Float32Array(length);
		let windowSum = 0;

		for (let n = 0; n < length; n++) {
		const w = 0.5 - 0.5 * Math.cos(
			(2 * Math.PI * n) / (length - 1)
		);
		const phase = (2 * Math.PI * freq * n) / sampleRate;

		window[n] = w;
		cos[n] = Math.cos(phase) * w;
		sin[n] = Math.sin(phase) * w;
		windowSum += w;
		}

		bands.push({ freq, length, cos, sin, scale: 2 / windowSum });
	}

	const maxWindow = Math.max(...bands.map(b => b.length));

	function process(samples) {
		if (samples.length < maxWindow) throw new Error(`CQT needs at least ${maxWindow} samples while only ${samples.length} provided`);

		const output = new Float32Array(bands.length);

		for (let k = 0; k < bands.length; k++) {
			const band = bands[k]
			const offset = samples.length - band.length;
			let re = 0, im = 0
			for (let n = 0; n < band.length; n++) {
				const x = samples[offset + n]
				re += x * band.cos[n]
				im -= x * band.sin[n]
			}

			output[k] = Math.hypot(re, im) * band.scale
		}

		return output;
	}

	return {
		frequencies: Float32Array.from(bands, b => b.freq),
		requiredSamples: maxWindow,
		process,
	};	
}