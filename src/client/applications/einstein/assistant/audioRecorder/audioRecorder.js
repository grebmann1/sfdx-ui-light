import { LightningElement, track, api } from 'lwc';
import { isChromeExtension } from 'shared/utils';

export default class AudioCapture extends LightningElement {

    @api openaiKey;

    @track isRecording = false;
    @track secondsElapsed = 0;

    mediaRecorder;
    audioChunks = [];
    timer;
    stream;
    isLoading = false;



    startRecording = async () => {
        if(isChromeExtension()) return;
        navigator.mediaDevices.getUserMedia({ audio: true }).then(this.handleStreamRecording);
    }

    handleStreamRecording = (stream) => {
        this.stream = stream;
        this.mediaRecorder = new MediaRecorder(this.stream);
        this.mediaRecorder.start();
        this.isRecording = true;
        this.startTimer();

        this.mediaRecorder.addEventListener('dataavailable', event => {
            this.audioChunks.push(event.data);
        });

        this.mediaRecorder.addEventListener('stop', () => {
            this.stream?.getTracks().forEach((track) => track.stop());
            clearInterval(this.timer);
            this.isRecording = false;
            this.secondsElapsed = 0;

            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            this.audioChunks = [];
            this.sendAudioToOpenAI(audioBlob);
        });
    }

    stopRecording = async () => {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
        
    }

    startTimer() {
        this.secondsElapsed = 0;
        this.timer = setInterval(() => {
            this.secondsElapsed += 1;
        }, 1000);
    }

    resetTimer(){
        this.secondsElapsed = 0;
        clearInterval(this.timer);
    }

    sendAudioToOpenAI = async (audioBlob) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            // Convert base64 string to an ArrayBuffer
            const binaryString = atob(base64data);
            const length = binaryString.length;
            const audioBuffer = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                audioBuffer[i] = binaryString.charCodeAt(i);
            }

            // Prepare the FormData with the audio file
            const formData = new FormData();
            formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');
            formData.append('model', 'whisper-1'); // or the specific model you want to use
            formData.append('language', 'en'); // or the specific model you want to use
            formData.append('prompt','This audio will be used as the input of a prompt')


            try {
                this.isLoading = true;
                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.openaiKey}`,
                    },
                    body: formData,
                });
                this.isLoading = false;
                const data = await response.json();
                this.dispatchEvent(new CustomEvent("change", {detail:{value:data.text || ''},bubbles: true }));
            } catch (error) {
                this.isLoading = false;
                console.error('Error:', error);
            }
        };
    }

    /** Getters **/

    get secondsElapsedFormatted(){
        return this.secondsElapsed < 1 ? 'Starting': `${this.secondsElapsed} seconds`;
    }
}
