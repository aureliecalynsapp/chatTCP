// bridge.js

var input = document.getElementById('input_placeholder');
var SECRET_KEY = "";
var myPseudo = "";
var typingTimeout;
let emojiPicker = null;
let mediaRecorder = null;
let audioChunks = [];

var savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
}

function setupDynamicListeners() {
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('[id]'); 
        if (!target) return;
        const id = target.id;

        switch (id) {
            case 'cgu_btn':
				try {
					loadComponentFull(`cgu`)
					document.getElementById('bridge-view').style.display = 'none';
					document.getElementById('cgu-view').style.display = 'flex';	
				} catch (err) {
					console.error("Erreur de chargement du module cgu :", err);
				}
                break;

            // case 'return-bridge':
                // document.getElementById('bridge-view').style.display = 'flex';
                // document.getElementById('cgu-view').style.display = 'none';
                // break;

            case 'theme-toggle':
                var isDark = document.documentElement.hasAttribute('data-theme');
				if (isDark) {
					document.documentElement.removeAttribute('data-theme');
					e.target.innerText = '🌙';
					localStorage.setItem('theme', 'light');
				} else {
					document.documentElement.setAttribute('data-theme', 'dark');
					e.target.innerText = '☀️';
					localStorage.setItem('theme', 'dark');
				}
                break;
				
			case 'load_more_btn':
				var currentCount = document.querySelectorAll('.message').length;
				socket.emit('load more', currentCount);
				break;

            case 'emoji-btn':
                e.stopPropagation();
				if (!emojiPicker) {
					var emojiPicker = new EmojiMart.Picker({
						locale: 'fr',
						native: true, // IMPORTANT : évite de charger des dossiers d'images externes
						onEmojiSelect: (emoji) => {
							input.value += emoji.native;
							input.dispatchEvent(new Event('input')); 
							input.focus();
							emojiPicker.style.display = 'none';
						}
					});
					Object.assign(emojiPicker.style, {
						display: 'none',
						position: 'absolute',
						bottom: '80px',
						left: '10px',
						zIndex: '1000',
						//boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
						//borderRadius: '10px'
					});
					document.body.appendChild(emojiPicker);
				}
                emojiPicker.style.display = (emojiPicker.style.display === 'none') ? 'block' : 'none';
                break;
				
			case 'voice-btn':
				var voiceBtn = target				
				if (!mediaRecorder || mediaRecorder.state === "inactive") {
					try {
					// DÉMARRER L'ENREGISTREMENT
						var stream = await navigator.mediaDevices.getUserMedia({ 
							audio: {
								echoCancellation: { ideal: false }, 
								noiseSuppression: { ideal: false }, 
								autoGainControl: { ideal: false },  
								sampleRate: { ideal: 44100 },
								sampleSize: { ideal: 16 },
								channelCount: { ideal: 1 }
							} 
						});
						let mimeType = 'audio/mp4';
						if (!MediaRecorder.isTypeSupported(mimeType)) {
							mimeType = 'audio/webm;codecs=opus';
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
					} catch (err) {
						console.error("Accès micro refusé ou erreur :", err);
					}
				} else {
					// ARRÊTER
					mediaRecorder.stop();
					stopTimer();
					socket.emit('stop typing');
					voiceBtn.textContent = "🎤";
					document.getElementById('recording-status').style.display = "none";
				}
				break;
				
				
        }
		// document.addEventListener('click', (e) => {
			// if (emojiPicker && !e.target.closest('#emoji-btn') && !e.target.closest('em-emoji-picker')) {
				// emojiPicker.style.display = 'none';
			// }
		// });
    });	
	
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			document.getElementById('bridge-view').dispatchEvent(new Event('submit'));
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
	document.getElementById('file-input').addEventListener('change', (e) => {
		var file = e.target.files[0];
		if (!file) return;

		// --- CONDITION SPÉCIALE GIF ---
		if (file.type === "image/gif") {
			var reader = new FileReader();
			reader.onload = function(event) {
				var rawImageData = event.target.result;
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
		e.target.value = '';
	});
}

function stopTimer() {
	clearInterval(timerInterval);
}

function setupMobileListeners() {		
	document.addEventListener('touchmove', (e) => {
		if (e.scale !== 1) { 
			e.preventDefault(); }
	}, { passive: false });
		
	document.addEventListener('touchstart', (e) => {
		if (e.touches.length > 1) {
			e.preventDefault(); 
		}
	}, { passive: false });

	document.addEventListener('gesturestart', (e) => {
		e.preventDefault();
	});
}

// ENVOI DE TEXTE ---
document.getElementById('bridge-view').addEventListener('submit', (e) => {
	e.preventDefault();
	if (input.value.trim()) {
		var timeStr = getNowFormatted();				
		var encryptedText = CryptoJS.AES.encrypt(input.value, SECRET_KEY).toString();
		var data = { 
			text: encryptedText, 
			time: timeStr, 
			pseudo: myPseudo, 
			isEncrypted: true, 
			id: 'msg-' + Date.now() 
		};
				
		addMessage(data, 'me');
		socket.emit('chat message', data);
		input.value = '';
		input.style.height = 'auto';
		socket.emit('stop typing');
	}
});
    		
		
if (window.visualViewport) {
	window.visualViewport.addEventListener('resize', () => {
	var viewHeight = window.visualViewport.height;
	document.getElementById('bridge-view').style.height = `${viewHeight}px`;
	window.scrollTo(0, 0);
	});
}
		
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) {
		clearInterval(notificationInterval);
		notificationInterval = null;
		document.title = originalTitle;
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
    
// FONCTION D'AFFICHAGE DES MESSAGES ---
function addMessage(data, side, isPrepend = false) {
	var item = document.createElement('li');
	item.classList.add('message', side);
	const currentLang = localStorage.getItem('preferred-lang') || 'fr';
	var t = bridgeTranslations[currentLang];    
			
	let displayText = "";
	let displayImage = null;
	let displayAudio = null;

	// --- LOGIQUE DE DÉCHIFFREMENT ---
	if (data.isEncrypted && SECRET_KEY) {
		try {
			if (data.text && data.text.length > 0) {
				var textBytes = CryptoJS.AES.decrypt(data.text, SECRET_KEY);
				var decryptedText = textBytes.toString(CryptoJS.enc.Utf8);
				displayText = decryptedText || t.key_ko;
			}
			if (data.image) {
				if (data.image.startsWith('data:image')) {
					displayImage = data.image;
				} else {
					var imgBytes = CryptoJS.AES.decrypt(data.image, SECRET_KEY);
					var decryptedImg = imgBytes.toString(CryptoJS.enc.Utf8);
					displayImage = decryptedImg || null;
					if (!displayImage) displayText = t.key_ko;
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
			displayText = t.key_ko; 
		}
	} else {
		displayText = data.text || "";
		displayImage = data.image || null;
		displayAudio = data.audio || null;
	}

	// --- LOGIQUE D'AFFICHAGE ---
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

	// --- LOGIQUE D'INSERTION ---
	var messagesList = document.getElementById('messages');
	if (isPrepend) {
		messagesList.prepend(item); 
	} else {
		messagesList.appendChild(item);
		messagesList.scrollTop = messagesList.scrollHeight;
	}
}    