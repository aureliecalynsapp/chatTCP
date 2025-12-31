//ui.js
let themTZ = "Asia/Shanghai"; // Par défaut

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
    		
	const t = translations[lang];
	if (!t) {
		console.error("Langue non trouvée dans translations.js :", lang);
		return;
	}
    
	// Liste des IDs à mettre à jour
	const mapping = {
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
		const el = document.getElementById(id);
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
	const selectors = ['lang-select-home', 'lang-select']; 
	selectors.forEach(id => {
		const el = document.getElementById(id);
		if (el) {
			el.value = lang; // Force l'affichage sur "en", "fr" ou "zh"
		}
	});
		
	// On met à jour le lien vers les CGU pour inclure la langue
	const cguLink = document.getElementById('txt-view-cgu');
	if(cguLink) {
		cguLink.href = `/cgu?lang=${lang}`;
	}
}

function updateDynamicClocks() {
	const now = new Date();

	// 1. Détection automatique de MA ville
	const myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const myCity = myTZ.split('/').pop().replace('_', ' ');
	const themCity = themTZ.split('/').pop().replace('_', ' ');

	const zones = [
		{ id: 'me-analog', tz: myTZ, nameId: 'me-city-name', name: myCity },
		{ id: 'them-analog', tz: themTZ, nameId: 'them-city-name', name: themCity }
	];

	zones.forEach(zone => {
		try {
			const timeStr = now.toLocaleTimeString('en-US', { 
				timeZone: zone.tz, hour12: false, hour: '2-digit', minute: '2-digit' 
			});
			const [hours, minutes] = timeStr.split(':').map(Number);

			const hourDeg = (hours % 12) * 30 + minutes * 0.5;
			const minuteDeg = minutes * 6;

			const clockEl = document.getElementById(zone.id);
			clockEl.style.borderColor = zone.color;
			clockEl.querySelector('.hour').style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
			clockEl.querySelector('.minute').style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
			
			document.getElementById(zone.nameId).innerText = zone.name;
		} catch (e) {
			console.error("Erreur sur le fuseau :", zone.tz);
		}
	});
}

/* Pensée du jour */
function displayDailyQuote(forcedLang) {
	// Si on passe une langue, on l'utilise, sinon on cherche dans le stockage, sinon 'fr'
	const currentLang = forcedLang || localStorage.getItem('preferred-lang') || 'fr';
	
	// On vérifie si la fonction getDailyQuote (de quotes.js) existe
	if (typeof getDailyQuote === 'function') {
		const quoteText = getDailyQuote(currentLang);
		const quoteEl = document.getElementById('quote-text');
		if (quoteEl) {
			quoteEl.innerText = quoteText;
		}
	}
}

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // On limite la largeur pour le chat
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Exportation en JPEG compressé (qualité 0.7)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(dataUrl);
        };
    };
	console.log("Fichier compressé");
}

// On attend que le HTML soit chargé pour lancer le moteur
document.addEventListener('DOMContentLoaded', () => {
	// On lance une première fois pour éviter d'attendre 1 seconde le premier tic-tac
	updateDynamicClocks(); 
		
	// On règle la répétition
	 setInterval(updateDynamicClocks, 1000);

	console.log("Moteur des horloges démarré dans ui.js");
});