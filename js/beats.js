'use strict';

const Beats = {
    options: {
        parent: null,
    },
    replayBlocks: [],
    mic: null,

    init: function (options) {
        options = options || {};

        Beats.options = Object.assign(Beats.options, options);
        Beats.options.parent.innerHTML += Beats.getHtml();
        Beats.mic = new Mic().initFeedback();

        [0, 1, 2].forEach((i) => {
            let rp =  new ReplayBlock({
                id: i,
                parent: document.querySelector('#replay-block-col' + i),
            });
            Beats.replayBlocks.push(rp);
        });
    },
    getHtml: function () {
        return `
            <div class="container" id="beats">
                <div class="row"></div>
                <div class="row" id="replay-blocks">
                    <div class="col-sm" id="replay-block-col0">
                    </div>
                    <div class="col-sm" id="replay-block-col1">
                    </div>
                    <div class="col-sm" id="replay-block-col2">
                    </div>
                </div>
            </div>
        `;
    },
    
};

class ReplayBlock {
    constructor(options) {
        options = options || {};

        let defaults = {
            parent: null,
            id: null,
        };
        this.options = Object.assign(defaults, options);
        this.options.parent.innerHTML += this.getHtml();

        this.state = 'standby';
        this.wasPaused = false;
        this.sounds = [];

        this.el = document.querySelector(`#replay-block-${this.options.id}`);

        this.loadElements();
        this.initEvents();
    }

    loadElements(){
        this.play = this.el.querySelector('.play');
        this.edit = this.el.querySelector('.edit');
        this.stop = this.el.querySelector('.stop');
        this.range = this.el.querySelector('.range');
    }

    initEvents(){
        this.play.onclick = this.onPlayClick;
        this.stop.onmousedown = this.onStopMouseDown;
        this.stop.onmouseup = this.onStopMouseUp;
        this.range.oninput = this.onRangeInput;
    }

    onPlayClick = (e) => {
        e.preventDefault();

        if(this.state === 'standby'){
            this.state = 'record';
        } else if(this.state === 'record'){
            this.state = 'play';
            this.recordStop = (new Date()).getTime();
        } else if(this.state === 'play'){
            this.state = 'overdub';
        } else if(this.state === 'overdub'){
            this.state = 'play';
            this.recordStop = (new Date()).getTime();
        }

        this.computeState();
    }

    onStopMouseDown = (e) => {
        e.preventDefault();
        let that = this;
        this.clearTimeout = setTimeout(function(){
            that.state = 'standby';
            that.computeState();
        }, 2000)
        this.clearStart = (new Date()).getTime();
    }

    onStopMouseUp = (e) => {
        e.preventDefault();
        let diff = (new Date()).getTime() - this.clearStart;
        if(diff < 2000){
            clearTimeout(this.clearTimeout);
            this.wasPaused = this.state === 'pause';
            this.state = this.state === 'pause' ? 'play' : 'pause';
            this.computeState();    
        }
    }

    onRangeInput = (e) => {
        e.preventDefault();
        let mixValue = this.range.value;
        // this.debug('mixValue', mixValue / 100);
        this.sounds.forEach((sound) => {
            sound.volume = mixValue / 100;
        });
    }

    computeState(){
        let that = this;
        this.el.querySelector('.state').innerHTML = 'state: ' + this.state;
        switch (this.state){
            case 'record':
                utils.setButtonClass(this.play, 'btn-danger');
                this.play.querySelector('i').classList.replace('fa-play', 'fa-circle');
                this.startRecording();
                break;
            case 'play':
                utils.setButtonClass(this.play, 'btn-success');
                this.play.querySelector('i').classList.replace('fa-circle', 'fa-play');
    
                utils.setButtonClass(this.stop, 'btn-danger');
                this.stop.querySelector('i').classList.replace('fa-pause', 'fa-stop');
                if(this.wasPaused){
                    this.unPauseAudio();
                    this.wasPaused = false;
                }
                else {
                    this.stopRecording(function(){
                        that.playAudio();
                    });
                }
                break;
            case 'overdub':
                utils.setButtonClass(this.play, 'btn-warning');
                this.play.querySelector('i').classList.replace('fa-play', 'fa-circle');
                this.startRecording();
                break;
            case 'standby':
                utils.setButtonClass(this.play, 'btn-info');
                this.play.querySelector('i').classList.replace('fa-circle', 'fa-play');
    
                utils.setButtonClass(this.stop, 'btn-info');
                this.stop.querySelector('i').classList.replace('fa-pause', 'fa-stop');
                this.stopRecording();
                this.stopAudio();
                break;
            case 'pause':
                utils.setButtonClass(this.play, 'btn-success');
                this.play.querySelector('i').classList.replace('fa-circle', 'fa-play');
    
                utils.setButtonClass(this.stop, 'btn-warning');
                this.stop.querySelector('i').classList.replace('fa-stop', 'fa-pause');
                this.stopRecording();
                this.pauseAudio();
                break;
        }        
    }

    startRecording(){
        this.debug('startRecording');
        let that = this;
        Beats.mic.record();
    }

    stopRecording(next){
        let that = this;
        this.debug('stopRecording');
        Beats.mic.stopRecording((blob) => {
            utils.getBlobDuration(blob).then(function (duration) {
                that.debug('duration', duration + ' seconds');
                var sound = new Pizzicato.Sound(
                    {
                        source: 'file',
                        options: {
                            path: URL.createObjectURL(blob),
                            loop: true
                        }
                    },
                    next
                );
                that.debug('push sound', sound);
                that.sounds.push(sound);
            });
        });
    }

    playAudio(){
        this.debug('playAudio');
        let sound = this.sounds[this.sounds.length - 1];
        sound.volume = 1;
        sound.play();
        this.recordDiff = (new Date()).getTime() - this.recordStop;
        this.debug('recordDiff', this.recordDiff);
    }

    pauseAudio(){
        this.debug('pauseAudio');
        this.sounds.forEach((sound) => sound.pause());
    }

    unPauseAudio(){
        this.debug('unPauseAudio');
        this.sounds.forEach((sound) => sound.play());
    }

    stopAudio(){
        this.debug('stopAudio');
        this.sounds.forEach((sound) => sound.stop());
        this.sounds = [];
    }
    
    debug(...args){
        console.log('ID: ' + this.options.id, ...args);
    }

    getHtml() {
        return `
            <div class="card" id="replay-block-${this.options.id}">
                <h5 class="card-header">Replay block ${this.options.id}</h5>
                <div class="card-body">
                    <h5 class="card-title state">state: standby</h5>                 
                    <button type="button" class="btn btn-dark btn-lg btn-block edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button type="button" class="btn btn-info btn-lg btn-block stop">
                        <i class="fas fa-stop"></i>
                    </button>
                    <input type="range" class="form-control-range mt-3 mb-3 range">
                    <button type="button" class="btn btn-info btn-lg btn-block play">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
        `;
    }
}

const utils = {
    setButtonClass(el, cls){
        let classes = ['btn-danger', 'btn-info', 'btn-warning', 'btn-success', 'btn-dark'];
        el.classList.remove(...classes);
        el.classList.add(cls);
    },

    getBlobDuration(blob){
        const tempVideoEl = document.createElement('video')

        const durationP = new Promise(resolve =>
          tempVideoEl.addEventListener('loadedmetadata', () => {
            // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=642012
            if(tempVideoEl.duration === Infinity) {
              tempVideoEl.currentTime = Number.MAX_SAFE_INTEGER
              tempVideoEl.ontimeupdate = () => {
                tempVideoEl.ontimeupdate = null
                resolve(tempVideoEl.duration)
                tempVideoEl.currentTime = 0
              }
            }
            // Normal behavior
            else
              resolve(tempVideoEl.duration)
          }),
        )
      
        tempVideoEl.src = typeof blob === 'string' || blob instanceof String
          ? blob
          : window.URL.createObjectURL(blob)
      
        return durationP      
    }
}
