let ac;
function ctx(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();return ac;}catch{return null;}}
function tom(f,ini,dur,vol=.15){const a=ctx();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type="sine";o.frequency.value=f;o.connect(g);g.connect(a.destination);const t=a.currentTime+ini;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.05);}
function beepTecla(){tom(660,0,.07,.06);}
function beepFim(){tom(523,0,.25);tom(659,.18,.25);tom(784,.36,.7);} 