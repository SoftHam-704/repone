/**
 * AudioHandler (Migrado de SalesMasters V1 - Iris)
 * Gerencia a reprodução de áudio em formato PCM (usado pela IRIS)
 */
export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStream | null = null;
  private nextStartTime: number = 0;

  async startCapture(onAudioData: (base64: string) => void) {
    if (!this.audioContext) this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.source = await navigator.mediaDevices.getUserMedia({ audio: true });
    const input = this.audioContext.createMediaStreamSource(this.source);
    
    // Using ScriptProcessor for compatibility
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
      }
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      onAudioData(base64);
    };

    input.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stopCapture() {
    this.source?.getTracks().forEach(t => t.stop());
    this.processor?.disconnect();
    this.audioContext?.close();
    this.audioContext = null;
  }

  playChunk(base64: string) {
    if (!this.audioContext) this.audioContext = new AudioContext({ sampleRate: 24000 });
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    const pcm = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 0x7FFF;

    const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    if (this.nextStartTime < now) this.nextStartTime = now;
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  /**
   * Converte texto em áudio usando a API de síntese de voz nativa do navegador
   * como fallback ou método principal para o briefing.
   */
  speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1; // Um pouco mais rápido para parecer inteligente
    window.speechSynthesis.speak(utterance);
  }
}

export const irisAudio = new AudioHandler();
