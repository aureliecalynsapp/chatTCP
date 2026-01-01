//ui.js
let myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone; // Ta zone
let themTZ = myTZ; // Par défaut, on considère que l'autre est au même endroit
let timerInterval;

// FONCTION DE FORMATEUR DE DATE (29 Dec 18:05) ---
function getNowFormatted() {
	var now = new Date();
	var options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
	// 'en-GB' donne le format Jour Mois Heure sans virgules inutiles
	return now.toLocaleDateString('en-GB', options).replace(',', '');
}

function getHashColor(str) {
	if(!str) return '#000';
	var hash = 0; for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
	var c = '#'; for (var i = 0; i < 3; i++) c += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
	return c;
}

// Fonction pour appliquer la langue	
function applyLanguage(lang) {
	console.log("Changement de langue vers :", lang); // Pour vérifier dans la console (F12)
    		
	var t = translations[lang];
	if (!t) {
		console.error("Langue non trouvée dans translations.js :", lang);
		return;
	}
    
	// Liste des IDs à mettre à jour
	var mapping = {
		'txt-header-title': t.header_title,
		'txt-view-cgu': t.view_cgu,
		'txt-welcome-title': t.welcome_title,
		'enter-chat-btn': t.enter_chat,
		'quote-intro': t.quote_intro,
		'load-more-btn': t.load_more,
		'send-btn' : t.send_btn,
		'input': 'placeholder' // Cas spécial pour le placeholder
	};
    
	for (let id in mapping) {
		var el = document.getElementById(id);
		if (el) {
			if (mapping[id] === 'placeholder') {
				el.placeholder = t.input_placeholder;
			} else {
				el.innerText = mapping[id];
			}
		} else {
			console.warn("Élément introuvable : " + id);
		}
	}
	// Mettre à jour la citation du jour (depuis quotes.js)
	if (typeof displayDailyQuote === 'function') {
		displayDailyQuote(lang);
	}
    
	// Sauvegarder la langue
	localStorage.setItem('preferred-lang', lang);
			
	// SYNCHRONISATION : On s'assure que les deux sélecteurs affichent la même langue
	// On cherche tous les menus de langue et on leur impose la valeur
	var selectors = ['lang-select-home', 'lang-select']; 
	selectors.forEach(id => {
		var el = document.getElementById(id);
		if (el) {
			el.value = lang; // Force l'affichage sur "en", "fr" ou "zh"
		}
	});
		
	// On met à jour le lien vers les CGU pour inclure la langue
	var cguLink = document.getElementById('txt-view-cgu');
	if(cguLink) {
		cguLink.href = `/cgu?lang=${lang}`;
	}
}

function updateDynamicClocks() {
	var now = new Date();

	// 1. Détection automatique de MA ville
	var myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
// Fonction appelée par socket-logic.js quand un partenaire arrive
function setupClocksVisibility(remoteTZ) {
	if (!remoteTZ) return;
	
    themTZ = remoteTZ; // Met à jour la variable globale utilisée par updateDynamicClocks
    
    var clockContainer = document.getElementById('clocks-container');
    if (clockContainer) {
        if (shouldShowClocks(remoteTZ)) {
            clockContainer.style.display = 'flex'; // ou 'block' selon ton CSS
            updateDynamicClocks(); // Rafraîchissement immédiat
            console.log("Fuseaux différents : Affichage des horloges");
        } else {
            clockContainer.style.display = 'none';
            console.log("Même fuseau : Horloges masquées");
        }
    }
}

function shouldShowClocks(remoteTZ) {
    var now = new Date();
    
    // On compare uniquement HH:mm (sans les secondes)
    var myTime = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(now);

    var remoteTime = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: remoteTZ
    }).format(now);

    return myTime !== remoteTime;
}

/* Pensée du jour */
function displayDailyQuote(forcedLang) {
	// Si on passe une langue, on l'utilise, sinon on cherche dans le stockage, sinon 'fr'
	var currentLang = forcedLang || localStorage.getItem('preferred-lang') || 'fr';
	
	// On vérifie si la fonction getDailyQuote (de quotes.js) existe
	if (typeof getDailyQuote === 'function') {
		var quoteText = getDailyQuote(currentLang);
		var quoteEl = document.getElementById('quote-text');
		if (quoteEl) {
			quoteEl.innerText = quoteText;
		}
	}
}

function compressImage(file, callback) {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        var img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            var canvas = document.createElement('canvas');
            var MAX_WIDTH = 800; // On limite la largeur pour le chat
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

            // Exportation en JPEG compressé (qualité 0.7)
            var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(dataUrl);
        };
    };
	console.log("Fichier compressé");
}

function sendMediaMessage(base64Data, type) {
    if (!SECRET_KEY) return;

    // 1. Chiffrement du Base64 (l'audio est traité comme un gros texte)
    var encryptedAudio = CryptoJS.AES.encrypt(base64Data, SECRET_KEY).toString();
    
    var data = {
        id: 'voice-' + Date.now(),
        type: 'voice', // On précise le type
        text: "", 
        audio: encryptedAudio, // On stocke l'audio chiffré ici
        isEncrypted: true,
        time: getNowFormatted(),
        pseudo: myPseudo
    };

    // 2. Affichage local immédiat (avec l'audio non chiffré pour la rapidité)
    addMessage({ ...data, audio: base64Data }, 'me');
    
    // 3. Envoi au serveur
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

// On attend que le HTML soit chargé
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cacher les horloges au démarrage (on attend de savoir qui est en face)
    var clockContainer = document.getElementById('clocks-container');
    if (clockContainer) clockContainer.style.display = 'none';

    // 2. Lancer le moteur (il tournera en arrière-plan)
    setInterval(updateDynamicClocks, 1000);

    console.log("Moteur des horloges prêt (en attente de connexion)");
});

var debugDiv = document.getElementById('debug-check');
if (debugDiv) debugDiv.style.display = 'none';