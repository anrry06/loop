class Mic {
    constructor() {
        this.shouldStop = false;
        this.stopped = false;
        this.context = null;
        this.mediaRecorder = null;
        this.stream = null;
        this.recordedChunks = [];

        return this;
    }

    initFeedback() {
        let that = this;
        const handleSuccess = function (stream) {
            that.stream = stream;
            that.context = new AudioContext();
            const options = { mimeType: 'audio/webm' };
            that.mediaRecorder = new MediaRecorder(stream, options);
        };

        navigator.mediaDevices
            .getUserMedia({ audio: true, video: false })
            .then(handleSuccess)
            .catch(function (err) {
                console.log(err);
            });
        
        return this;
    }

    record() {
        let that = this;
        this.recordedChunks = [];
        let dataavailable = function (e) {
            if (e.data.size > 0) {
                that.recordedChunks.push(e.data);
            }
        };

        this.mediaRecorder.ondataavailable = dataavailable;

        this.mediaRecorder.addEventListener('error', (err) => {
            console.log(error);
        });

        console.log('this.mediaRecorder.start()');
        if (this.mediaRecorder.state === 'paused') this.mediaRecorder.resume();
        else this.mediaRecorder.start();
    }

    stopRecording(next) {
        let that = this;
        let stop = function (e) {
            let file = new Blob(that.recordedChunks);
            next(file);
        };
        this.mediaRecorder.onstop = stop;

        if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    }

    stop() {
        this.stream.getAudioTracks().forEach(function (track) {
            track.stop();
        });
        try {
            this.context.close();
        } catch (e) {
            console.log(e);
        }
    }
}
