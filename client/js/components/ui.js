//ui.js
let timerInterval;
let originalTitle = document.title;
let notificationInterval = null;
let myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
let themTZ = myTZ;

// function getNowFormatted() {
	// var now = new Date();
	// var options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
	// return now.toLocaleDateString('en-GB', options).replace(',', '');
// }

function formatToLocalTime(utcString) {
    const date = new Date(utcString);
    
    // Options pour un affichage propre (ex: 14:20)
    return date.toLocaleTimeString(navigator.language, {
		day: 'numeric', 
		month: 'short', 
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Force le format 24h si tu préfères
    });
}

function getHashColor(str) {
	if(!str) return '#000';
	var hash = 0; for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
	var c = '#'; for (var i = 0; i < 3; i++) c += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
	return c;
}

function initClockEngine() {
    setupClocksVisibility(themTZ);
    setInterval(updateDynamicClocks, 1000);
    updateDynamicClocks(); 
    console.log("Moteur des horloges activé !");
}

function updateDynamicClocks() {
	var now = new Date();
	var myCity = myTZ.split('/').pop().replace('_', ' ');
	var themCity = themTZ.split('/').pop().replace('_', ' ');

	var zones = [
		{ id: 'me-analog', tz: myTZ, nameId: 'me-city-name', name: myCity },
		{ id: 'them-analog', tz: themTZ, nameId: 'them-city-name', name: themCity }
	];

	zones.forEach(zone => {
		try {
			var timeStr = now.toLocaleTimeString('en-US', { 
				timeZone: zone.tz, hour12: false, hour: '2-digit', minute: '2-digit' 
			});
			var [hours, minutes] = timeStr.split(':').map(Number);

			var hourDeg = (hours % 12) * 30 + minutes * 0.5;
			var minuteDeg = minutes * 6;

			var clockEl = document.getElementById(zone.id);
			clockEl.style.borderColor = zone.color;
			clockEl.querySelector('.hour').style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
			clockEl.querySelector('.minute').style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
			
			document.getElementById(zone.nameId).innerText = zone.name;
		} catch (e) {
			console.error("Erreur sur le fuseau :", zone.tz);
		}
	});
}

function setupClocksVisibility(remoteTZ) {
	if (!remoteTZ) return;
	
    themTZ = remoteTZ;
    
    var clockContainer = document.getElementById('clocks-container');
    if (clockContainer) {
        if (shouldShowClocks(remoteTZ)) {
            clockContainer.style.display = 'flex';
            updateDynamicClocks();
            console.log("Fuseaux différents : Affichage des horloges");
        } else {
            clockContainer.style.display = 'none';
            console.log("Même fuseau : Horloges masquées");
        }
    }
}

function shouldShowClocks(remoteTZ) {
    var now = new Date();
    
    var myTime = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(now);

    var remoteTime = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: remoteTZ
    }).format(now);

    return myTime !== remoteTime;
}

function compressImage(file, callback) {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        var img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            var canvas = document.createElement('canvas');
            var MAX_WIDTH = 800; 
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(dataUrl);
        };
    };
	console.log("Fichier compressé");
}

function sendMediaMessage(base64Data, type) {
    if (!SECRET_KEY) return;

    var encryptedAudio = CryptoJS.AES.encrypt(base64Data, SECRET_KEY).toString();
    
    var data = {
        id: 'voice-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
        type: 'voice',
        text: "", 
        audio: encryptedAudio,
        isEncrypted: true,
        utcDate: new Date().toISOString(),
        pseudo: myPseudo,
		authorId: localStorage.getItem('user-id')
    };

    addMessage({ ...data, audio: base64Data }, 'me');
    
    socket.emit('chat message', data);
}

function dataURLtoBlob(dataurl) {
    try {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type:mime});
    } catch(e) {
        console.error("Erreur conversion Blob:", e);
        return null;
    }
}

function startTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('timer');
    timerEl.innerText = "0s";
    timerInterval = setInterval(() => {
        seconds++;
        timerEl.innerText = seconds + "s";
    }, 1000);
}

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function sendSystemNotification(user) {
    if (Notification.permission === "granted") {
        new Notification(`Message de ${user}`, {
            icon: '../assets/img/logo.png'
        });
    }
    if (!notificationInterval) {
        let toggle = false;
		notificationInterval = setInterval(() => {
			document.title = toggle ? `🟢 ${user}` : originalTitle;
			toggle = !toggle;
		}, 1000); 
	}
}

function deleteMessage(id) {	
	const currentLang = localStorage.getItem('preferred-lang') || 'fr';
	var t = bridgeTranslations[currentLang];    
	if(confirm(t.confirm_delete)) {
		socket.emit('delete message', id);
	}
}

function editMessage(text,id) {
	const input = document.getElementById('input_placeholder');
	input.value = text;
	input.dataset.editId = id;
	input.focus();
}

function editMessage(id) {
	const messageEl = document.getElementById(id);
	const textContainer = messageEl.querySelector('.message-wrapper div:first-child');
    if (!textContainer) return;
	const input = document.getElementById('input_placeholder');
	input.value = textContainer.textContent;
	input.dataset.editId = id;
	input.focus();
}

var debugDiv = document.getElementById('debug-check');
if (debugDiv) debugDiv.style.display = 'none';