/*
I would credit original author but I legit cant find where I copied chunks from
I was drunk at 3am when writing this inside index.js and copying chunks of code from different places
best I can do is credit CQT page I was reading back then: https://brendanjameslynskey.github.io/ConstantQ-Transform/
-- GibbDev
*/

// /**@namespace CQT */

/**
 * Constant-Q Transform. 
 * Used to process ordered audio data into frequency, magnitude, decibels and their normalized versions
 * 
 * @property {number} [sampleRate=48000] Sample rate in HRz
 * @property {number} [minFreq=40] Minimum frequency in HRz
 * @property {number} [maxFreq=20000] Maximum frequency in HRz
 * @property {number} [binsPerOctave=63/Math.log2(20000/40)] Number of bins to split octaves into
 * @property {number} [bandsNumber=64] Number of bands to split all frequencies into
 */
export class CQT {
	sampleRate=48000
	minFreq=40
	maxFreq=20000
	binsPerOctave=63/Math.log2(20000/40) // for 64 bands
	bandsNumber=64

	Q=0
	bins=[]
	requiredSamples = 0

	/**
	 * @constructor
	 * @param {Object} [options] constructor options
	 * @param {number} [options.sampleRate=48000] Sample rate in HRz
	 * @param {number} [options.minFreq=40] Minimum frequency in HRz
	 * @param {number} [options.maxFreq=20000] Maximum frequency in HRz
	 * @param {number} [options.binsPerOctave=63/Math.log2(20000/40)] Number of bins to split octaves into. Default value represents 64 bands
	 * @param {number} [options.bandsNumber=64] Number of bands to split all frequencies into. if present overrides {@link binsPerOctave}
	 */
	constructor({
		sampleRate = 48000, 
		minFreq = 40,
		maxFreq = 20000,
		binsPerOctave = 63/Math.log2(20000/40),
		bandsNumber=64
	}={}) {
		this.sampleRate 	= sampleRate?sampleRate:48000
		this.minFreq 		= minFreq?minFreq:40
		this.maxFreq 		= maxFreq?maxFreq:20000
		this.binsPerOctave 	= binsPerOctave?binsPerOctave:63/Math.log2(this.maxFreq/this.minFreq)
		if (bandsNumber) this.binsPerOctave = (bandsNumber-1)/Math.log2(this.maxFreq/this.minFreq)
		this.bandsNumber 			= bandsNumber?bandsNumber:64
		this.update()
	}

	/**
	 * @summary Updates CQT object based on params
	 * Updates CQT object so its bins and 
	 */
	update() {
		let ratio = Math.pow(2,1/this.binsPerOctave)
		this.Q = 1/(ratio-1)
		this.bins = []
		//frequency filter for each frequency
		for (let freq=this.minFreq;freq<=this.maxFreq;freq*=ratio) {
			/**Hanning {@link https://en.wikipedia.org/wiki/Hann_function}*/
			const windowLength = Math.ceil(this.Q*this.sampleRate/freq)
			const cos = new Float32Array(windowLength)
			const sin = new Float32Array(windowLength)
			let windowSum = 0
			this.requiredSamples = Math.max(this.requiredSamples, windowLength)
			for (let i=0;i<windowLength;i++) {
				const hWindow = 0.5-0.5*Math.cos(2*Math.PI*i/(windowLength-1))
				const phase = 2*Math.PI*freq*i/this.sampleRate
				cos[i]=Math.cos(phase)*hWindow
				sin[i]=Math.sin(phase)*hWindow
				windowSum+=hWindow
			}
			this.bins.push({freq,cos,sin,windowSum})
		}
	}
	
	process(samples) {
		const magnitudes = new Float32Array(this.bins.length)
		for (let i=0;i<this.bins.length;i++) {
			const bin = this.bins[i]
			let real = 0
			let imaginary = 0
			for (let k=0;k<bin.cos.length;k++) {
				const sample = samples[samples.length-bin.cos.length+k]
				real += sample*bin.cos[k]
				imaginary += sample*bin.sin[k]
			}
			const mag = Math.sqrt(real**2+imaginary**2)
			magnitudes[i]=mag*2/bin.windowSum
		}
		return magnitudes
	}
	getFrequencies() {
		return Float32Array.from(this.bins, b=>b.freq)
	}
}

// export function createCQT({
// }={}) {
// 	const maxWindow = Math.max(...bands.map(b => b.length));

// 	function process(samples) {
// 		if (samples.length < maxWindow) throw new Error(`CQT needs at least ${maxWindow} samples while only ${samples.length} provided`);

// 		const output = new Float32Array(bands.length);

// 		for (let k = 0; k < bands.length; k++) {
// 			const band = bands[k]
// 			const offset = samples.length - band.length;
// 			let re = 0, im = 0
// 			for (let n = 0; n < band.length; n++) {
// 				const x = samples[offset + n]
// 				re += x * band.cos[n]
// 				im -= x * band.sin[n]
// 			}

// 			output[k] = Math.hypot(re, im) * band.scale
// 		}

// 		return output;
// 	}

// 	return {
// 		frequencies: Float32Array.from(bands, b => b.freq),
// 		requiredSamples: maxWindow,
// 		process,
// 	};	
// }