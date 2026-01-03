// core.js

var socket = io({
	transports: ['polling', 'websocket'],
	upgrade: true
});
var chatContainer = document.getElementById('chat-container');
var messages = document.getElementById('messages');
var form = document.getElementById('form');
var input = document.getElementById('input');
var typingIndicator = document.getElementById('typing-indicator');
var SECRET_KEY = "";
var myPseudo = "";
var typingTimeout;        

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
	var selector = document.getElementById('lang-select');
	if (selector) {
		var savedLang = localStorage.getItem('preferred-lang') || 'fr';
		selector.value = savedLang;
		applyLanguage(savedLang);
 
		selector.addEventListener('change', (e) => {
			applyLanguage(e.target.value);
		});
	} else {
		console.error("Le sélecteur 'lang-selector' est introuvable !");
	}
});

// Moteur horloge
// document.addEventListener('DOMContentLoaded', () => {				
	// setupClocksVisibility(themTZ);
	// setInterval(updateDynamicClocks, 1000);
	// console.log("Moteur des horloges prêt (en attente de connexion)");
// });
	
// Capture les erreurs JavaScript globales
window.onerror = function(message, source, lineno, colno, error) {
	var errorData = {
		message: message,
		source: source,
		line: lineno,
		pseudo: typeof myPseudo !== 'undefined' ? myPseudo : 'Inconnu'
	};
	// Envoie l'erreur au serveur via le socket
	if (typeof socket !== 'undefined') {
		socket.emit('client error', errorData);
	}
	alert(errorData);
};
		
// Rejoindre le chat:
document.getElementById('enter-chat-btn').addEventListener('click', () => {
	// On crée un contexte audio ou on joue un son bref pour "déverrouiller"
	var audio = new Audio('/sounds/pop.mp3');
	audio.muted = true; // On peut le mettre en muet pour le déverrouillage
	audio.play().then(() => {
		console.log("Audio débloqué pour cette session !");
	}).catch(e => console.log("Déverrouillage échoué"));
	// À mettre dans ton bouton "Envoyer" ou "Rejoindre"
	requestNotificationPermission();
});

    
        // FONCTION D'AFFICHAGE DES MESSAGES ---
		function addMessage(data, side, isPrepend = false) {
			var item = document.createElement('li');
			item.classList.add('message', side);
			
			let displayText = "";
			let displayImage = null;
			let displayAudio = null;

			// --- LOGIQUE DE DÉCHIFFREMENT (Ton code inchangé) ---
			if (data.isEncrypted && SECRET_KEY) {
				try {
					if (data.text && data.text.length > 0) {
						var textBytes = CryptoJS.AES.decrypt(data.text, SECRET_KEY);
						var decryptedText = textBytes.toString(CryptoJS.enc.Utf8);
						displayText = decryptedText || "[Erreur de clé]";
					}
					if (data.image) {
						if (data.image.startsWith('data:image')) {
							displayImage = data.image;
						} else {
							var imgBytes = CryptoJS.AES.decrypt(data.image, SECRET_KEY);
							var decryptedImg = imgBytes.toString(CryptoJS.enc.Utf8);
							displayImage = decryptedImg || null;
							if (!displayImage) displayText = "[Clé image incorrecte]";
						}
					}
					if (data.type === 'voice' && data.audio) {
						try {
							let rawBase64 = "";
							if (data.audio.startsWith('data:audio')) {
								rawBase64 = data.audio;
							} else {
								var audioBytes = CryptoJS.AES.decrypt(data.audio, SECRET_KEY);
								rawBase64 = audioBytes.toString(CryptoJS.enc.Latin1);
							}

							var blob = dataURLtoBlob(rawBase64);
							if (blob) {
								displayAudio = URL.createObjectURL(blob);
							}
						} catch (e) {
							console.error("Erreur technique audio:", e);
						}
					}
				} catch (e) { 
					console.error("Erreur de déchiffrement :", e);
					displayText = "[Message illisible]"; 
				}
			} else {
				displayText = data.text || "";
				displayImage = data.image || null;
				displayAudio = data.audio || null;
			}

			// --- LOGIQUE D'AFFICHAGE (Ton code inchangé) ---
			var color = getHashColor(data.pseudo || "Anonyme");
			var nameStyle = (side === 'me') ? 'display:none' : `color:${color}; font-weight:bold; font-size:0.8em; margin-bottom:3px;`;
			var imageHtml = displayImage ? `<img src="${displayImage}" style="max-width:100%; border-radius:10px; margin:5px; display:block;">` : "";
			var audioHtml = displayAudio ? `
				<audio controls 
					   preload="metadata" 
					   src="${displayAudio}" 
					   onplay="console.log('Lecture en cours...')" 
					   style="max-width: 100%; margin: 5px; height: 35px;">
				</audio>` : "";
			var tickContent = (data.read) ? '✓✓' : '✓';
			var tickColor = (data.read) ? 'color: #3498db;' : '';
			var statusCheckHtml = (side === 'me') ? `<span class="status-check" id="tick-${data.id || Date.now()}" style="${tickColor}">${tickContent}</span>` : "";

			item.innerHTML = `
				<div style="${nameStyle}">${data.pseudo || 'Anonyme'}</div>
				<div class="message-wrapper">
					<div>${displayText}</div>
					${imageHtml}
					${audioHtml}
				</div>
				<div class="message-footer" style="display: flex; align-items: center; justify-content: flex-end; margin-top:3px">
					<span class="time">${data.time || ''}</span>
					${statusCheckHtml}
				</div>
			`;

			// --- LOGIQUE D'INSERTION (C'est ici que ça change) ---
			var messagesList = document.getElementById('messages');

			if (isPrepend) {
				// On insère tout en haut de la liste <ul>
				messagesList.prepend(item); 
			} else {
				// On ajoute en bas normalement
				messagesList.appendChild(item);
				messagesList.scrollTop = messagesList.scrollHeight;
			}
		}
    
        // ENVOI DE TEXTE ---
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          if (input.value.trim()) {
            var timeStr = getNowFormatted(); // Utilisation du nouveau format
            
            var encryptedText = CryptoJS.AES.encrypt(input.value, SECRET_KEY).toString();
            var data = { text: encryptedText, time: timeStr, pseudo: myPseudo, isEncrypted: true, id: 'msg-' + Date.now() };
            
            addMessage(data, 'me');
            socket.emit('chat message', data);
            input.value = '';
            input.style.height = 'auto';
            socket.emit('stop typing');
          }
        });
    
        // IHM : ENTRÉE ET AGRANDISSEMENT AUTO ---
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
          }
        });
    
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            socket.emit('typing', myPseudo);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => socket.emit('stop typing'), 5000);
        });
    
        // ENVOI DE PHOTOS CHIFFRÉES AVEC COMPRESSION ---
		document.getElementById('file-input').addEventListener('change', function(e) {
			var file = e.target.files[0];
			if (!file) return;

			// --- CONDITION SPÉCIALE GIF ---
			if (file.type === "image/gif") {
				var reader = new FileReader();
				reader.onload = function(event) {
					var rawImageData = event.target.result;
					// On chiffre directement le GIF sans passer par la compression
					var encryptedImage = CryptoJS.AES.encrypt(rawImageData, SECRET_KEY).toString();
					
					var imageData = {
						id: 'img-' + Date.now(),
						text: "", 
						image: encryptedImage,
						isEncrypted: true,
						time: getNowFormatted(),
						pseudo: myPseudo
					};
					addMessage({ ...imageData, image: rawImageData }, 'me');
					socket.emit('chat message', imageData);
				};
				reader.readAsDataURL(file);
			} 
			// --- POUR TOUT LE RESTE (JPG, PNG) On compresse ---
			else {
				compressImage(file, function(compressedBase64) {
					var encryptedImage = CryptoJS.AES.encrypt(compressedBase64, SECRET_KEY).toString();
					var imageData = {
						id: 'img-' + Date.now(),
						text: "", 
						image: encryptedImage,
						isEncrypted: true,
						time: getNowFormatted(),
						pseudo: myPseudo
					};
					addMessage({ ...imageData, image: compressedBase64 }, 'me');
					socket.emit('chat message', imageData);
				});
			}
			e.target.value = ''; // Reset l'input
		});
    
        // EMOJIS ---
        var picker = new EmojiMart.Picker({
            locale: 'fr',
			native: true, // IMPORTANT : évite de charger des dossiers d'images externes
            onEmojiSelect: (emoji) => {
                input.value += emoji.native;
                input.dispatchEvent(new Event('input')); 
                input.focus();
                picker.style.display = 'none';
            }
        });
        picker.style.display = 'none';
        picker.style.position = 'absolute';
        picker.style.bottom = '80px';
        picker.style.left = '10px';
        picker.style.zIndex = '1000';
        document.body.appendChild(picker);
    
        document.getElementById('emoji-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            picker.style.display = (picker.style.display === 'none') ? 'block' : 'none';
        });
    
        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target) && e.target.id !== 'emoji-btn') picker.style.display = 'none';
        });
    	
		
    	
    	// DARK MODE ---
    	var themeToggle = document.getElementById('theme-toggle');
    
    	// Charger le thème sauvegardé
    	var savedTheme = localStorage.getItem('theme') || 'light';
    	if (savedTheme === 'dark') {
    		document.documentElement.setAttribute('data-theme', 'dark');
    		themeToggle.innerText = '☀️';
    	}
    
    	// Écouter le clic sur le bouton
    	themeToggle.addEventListener('click', () => {
    		var isDark = document.documentElement.hasAttribute('data-theme');
    		if (isDark) {
    			document.documentElement.removeAttribute('data-theme');
    			themeToggle.innerText = '🌙';
    			localStorage.setItem('theme', 'light');
    		} else {
    			document.documentElement.setAttribute('data-theme', 'dark');
    			themeToggle.innerText = '☀️';
    			localStorage.setItem('theme', 'dark');
    		}
    	});
		
		// CHARGEMENT MESSAGE ANCIEN ---
		// Événement clic sur le bouton
		document.getElementById('load-more-btn').addEventListener('click', () => {
			var currentCount = document.querySelectorAll('.message').length;
			socket.emit('load more', currentCount);
		});
		
		// Message vocal
		let mediaRecorder;
		let audioChunks = [];

		var voiceBtn = document.getElementById('voice-btn');
		
		function stopTimer() {
			clearInterval(timerInterval);
		}

		voiceBtn.addEventListener('click', async () => {
			if (!mediaRecorder || mediaRecorder.state === "inactive") {
				// DÉMARRER L'ENREGISTREMENT
				var stream = await navigator.mediaDevices.getUserMedia({ audio: {
					echoCancellation: { ideal: false }, 
					noiseSuppression: { ideal: false }, 
					autoGainControl: { ideal: false },  
					sampleRate: { ideal: 44100 },
					sampleSize: { ideal: 16 },
					channelCount: { ideal: 1 }
					} 
				});
				let mimeType = 'audio/mp4'; // Idéal pour iPhone/Mac et Windows

				if (!MediaRecorder.isTypeSupported(mimeType)) {
					mimeType = 'audio/webm;codecs=opus'; // Repli pour certains navigateurs Linux/Android
				}
				try {
					var recorderOptions = {
						mimeType: mimeType,
						audioBitsPerSecond: 128000
					};
					mediaRecorder = new MediaRecorder(stream, recorderOptions);
					console.log("Recorder initialisé avec le format :", mimeType);
				} catch (e) {
					console.log("Format spécifique non supporté, utilisation du format par défaut");
					mediaRecorder = new MediaRecorder(stream);
				}
				audioChunks = [];

				mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);

				mediaRecorder.onstop = async () => {
					stopTimer();
					socket.emit('stop typing');
					var audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
					
					var reader = new FileReader();
					reader.readAsDataURL(audioBlob);
					reader.onloadend = () => {
						var base64Audio = reader.result;
						sendMediaMessage(base64Audio, 'voice'); 
					};
				};

				mediaRecorder.start();
				startTimer();
				socket.emit('typing', myPseudo);
				voiceBtn.textContent = "🛑";
				document.getElementById('recording-status').style.display = "inline";
			} else {
				// ARRÊTER
				mediaRecorder.stop();
				stopTimer();
				socket.emit('stop typing');
				voiceBtn.textContent = "🎤";
				document.getElementById('recording-status').style.display = "none";
			}
		});
		
		document.addEventListener('touchmove', function (event) {
			if (event.scale !== 1) { event.preventDefault(); }
		}, { passive: false });
		
		document.addEventListener('touchstart', (event) => {
			if (event.touches.length > 1) {
				event.preventDefault(); // Bloque le zoom à deux doigts
			}
		}, { passive: false });

		document.addEventListener('gesturestart', (event) => {
			event.preventDefault(); // Bloque le geste de zoom spécifique à Safari
		});
		
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', () => {
				var viewHeight = window.visualViewport.height;
				// On force le conteneur à ne pas dépasser la zone visible
				document.getElementById('chat-container').style.height = `${viewHeight}px`;
				// On scrolle tout en haut pour que le header reste calé
				window.scrollTo(0, 0);
			});
		}
		
		// Arrêter l'alerte dès que l'utilisateur revient sur l'onglet
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) {
				clearInterval(notificationInterval);
				notificationInterval = null;
				document.title = originalTitle;
			}
		});