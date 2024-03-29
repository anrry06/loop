'use strict';

const Loops = {
    options: {
        parent: null,
        replaysCount: 3
    },
    replayBlocks: [],
    mic: null,

    init: function (options) {
        options = options || {};

        Loops.options = Object.assign(Loops.options, options);
        Loops.options.parent.innerHTML += Loops.getHtml();
        Loops.mic = new Mic().initFeedback();

        for(let i = 0; i < Loops.options.replaysCount; i++){
            let rp =  new ReplayBlock({
                id: i,
                parent: document.querySelector('#replay-block-col' + i),
            });
            Loops.replayBlocks.push(rp);
        }
    },

    getHtml: function () {
        let replayBlocks = '';
        for(let i = 0; i < Loops.options.replaysCount; i++){
            replayBlocks += `<div class="col-sm" id="replay-block-col${i}"></div>`;
        }

        return `
            <div class="container" id="loops">
                <div class="row edit-container"></div>
                <div class="row" id="replay-blocks">
                    ${replayBlocks}
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
        this.edit.onclick = this.onEditClick;
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
        this.debug('mixValue', mixValue- 50);
        this.sounds.forEach((sound) => {
            sound.volume.value = mixValue - 50;
        });
    }

    onEditClick = (e) => {
        e.preventDefault();
        this.edit.classList.toggle('btn-danger');
        let active = this.edit.classList.contains('btn-danger');
        if(active){
            new EditBlock({
                parent: document.querySelector('.edit-container'),
                replayBlockId: this.options.id
            });
        }
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
        Loops.mic.record();
    }

    stopRecording(next){
        let that = this;
        this.debug('stopRecording');
        Loops.mic.stopRecording((blob) => {
            utils.getBlobDuration(blob).then(function (duration) {
                that.debug('duration', duration + ' seconds');

                let sound = new Tone.Player({
                    url: URL.createObjectURL(blob),
                    loop: true,
                    // autostart: true
                    // loopStart: 0.5,
                    // loopEnd: 0.7,
                }).toDestination();
                Tone.loaded().then(next);
                that.debug('push sound', sound);
                that.sounds.push(sound);
                that.displaySounds();
            });
        });
    }

    playAudio(){
        this.debug('playAudio');
        let sound = this.sounds[this.sounds.length - 1];
        sound.volume.value = 1;
        sound.start();
        this.recordDiff = (new Date()).getTime() - this.recordStop;
        this.debug('recordDiff', this.recordDiff);
    }

    pauseAudio(){
        this.debug('pauseAudio');
        this.sounds.forEach((sound) => sound.stop());
    }

    unPauseAudio(){
        this.debug('unPauseAudio');
        this.sounds.forEach((sound) => sound.start());
    }

    stopAudio(){
        this.debug('stopAudio');
        this.sounds.forEach((sound) => sound.stop());
        this.sounds = [];
    }
    
    debug(...args){
        console.log('ID: ' + this.options.id, ...args);
    }

    displaySounds(){
        let soundsList = this.el.querySelector('.sounds-list');
        soundsList.innerHTML = '';
        this.sounds.forEach((sound, i) => {
            soundsList.innerHTML += `<li class="list-group-item" data-index="${i}">Sound #${i}</li>`;
        });
    }

    getHtml() {
        return `
            <div class="card" id="replay-block-${this.options.id}">
                <h5 class="card-header">Replay block ${this.options.id}</h5>
                <ul class="list-group list-group-flush sounds-list">
                </ul>
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

class EditBlock {
    constructor(options) {
        options = options || {};

        let defaults = {
            parent: null,
            replayBlockId: null
        };
        this.options = Object.assign(defaults, options);
        this.options.parent.innerHTML += this.getHtml();

        this.availableEffects = ['reverb'];

        this.el = document.querySelector(`#edit-block`);

        this.loadElements();
        this.initEvents();
    }

    loadElements(){
        this.effect = this.el.querySelector('.effect');
        this.effectsList = this.el.querySelector('.effects-list');
    }

    initEvents(){
        this.effect.onclick = this.onEffectClick;
    }

    onEffectClick = (e) => {
        e.preventDefault();
        let ae = this.availableEffects.map((effect) => `<button type="button" class="btn btn-dark btn-lg btn-block ${effect}">${effect.toUpperCase()}</button>`).join();
        let html = `
            <div class="col-sm">
                <div class="card" id="add-effect-block">
                    <h5 class="card-header">Add Effect Block</h5>
                    <div class="card-body">
                        ${ae}
                    </div>
                </div>
            </div>
        `;
        this.options.parent.innerHTML += html;
        this.addEffectBlock = document.querySelector('#add-effect-block');
        this.availableEffects.forEach((effect) => {
            this.addEffectBlock.querySelector(`.${effect}`).onclick = (e) => {
                let html = `
                    <div class="col-sm">
                        <div class="card" id="${effect}-block">
                            <h5 class="card-header">${effect.toUpperCase()} Block</h5>
                            <div class="card-body">
                                <button type="button" class="btn btn-dark btn-lg btn-block enable">
                                    Enable
                                </button>
                                <input type="range" class="form-control-range mt-3 mb-3 range">
                            </div>
                        </div>
                    </div>
                `;
                this.options.parent.innerHTML += html;

                Loops.replayBlocks[this.options.replayBlockId].reverb = new Tone.Reverb().toDestination();

                this[effect + 'Block'] = document.querySelector(`#${effect}-block`);
                this[effect + 'Block'].querySelector('.enable').onclick = (e) => {
                    Loops.replayBlocks[this.options.replayBlockId].sounds.forEach((sound) =>{
                        sound.connect(Loops.replayBlocks[this.options.replayBlockId].reverb);
                    });
                }
                this[effect + 'Block'].querySelector('.range').oninput = (e) => {
                    let mixValue = this[effect + 'Block'].querySelector('.range').value;
                    // this.debug('mixValue', mixValue);
                    Loops.replayBlocks[this.options.replayBlockId].reverb.set({
                        decay: mixValue
                    });
                }
            }
        })
    }

    getHtml() {
        return `
            <div class="col-sm">
                <div class="card" id="edit-block">
                    <h5 class="card-header">Edit Block</h5>
                    <ul class="list-group list-group-flush effects-list">
                    </ul>
                    <div class="card-body">
                        <button type="button" class="btn btn-dark btn-lg btn-block effect">
                            Add effect
                        </button>
                    </div>
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
