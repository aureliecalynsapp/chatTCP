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
				const firstMessage = document.querySelector('li.message'); 
				if (firstMessage) {
					const lastId = firstMessage.getAttribute('id');
					console.log("Chargement des messages avant l'ID :", lastId);
					
					// 3. On envoie la demande au serveur
					socket.emit('load more', { canalId: '1', lastId: lastId });
				} else {
					console.log("Aucun message trouvé pour servir de référence.");
				}
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
					id: 'img-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
					// text: "", 
					type: 'image',
					content: encryptedImage,
					// isEncrypted: true,
					utcDate: new Date().toISOString(),
					pseudo: myPseudo,
					authorId: localStorage.getItem('user-id')
				};
				addMessage({ ...imageData, content: rawImageData, received: false, read:false }, 'me');
				socket.emit('chat message', imageData);
			};
			reader.readAsDataURL(file);
		} 
		else {
			compressImage(file, function(compressedBase64) {
				var encryptedImage = CryptoJS.AES.encrypt(compressedBase64, SECRET_KEY).toString();
				var imageData = {
					id: 'img-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
					// text: "", 
					type: 'image',
					content: encryptedImage,
					// isEncrypted: true,
					utcDate: new Date().toISOString(),
					pseudo: myPseudo,
					authorId: localStorage.getItem('user-id')
				};
				addMessage({ ...imageData, content: compressedBase64, received: false, read:false }, 'me');
				socket.emit('chat message', imageData);
			});
		}
		e.target.value = '';
	});
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
	const editId = input.getAttribute('data-edit-id')
	if (input.value.trim()) {			
		if (editId) {
			var encryptedText = CryptoJS.AES.encrypt(input.value, SECRET_KEY).toString();
			socket.emit('edit message', { id: editId, newText: encryptedText, pseudo: myPseudo, authorId: localStorage.getItem('user-id') });
			input.removeAttribute('data-edit-id');			
		} else {
			var encryptedText = CryptoJS.AES.encrypt(input.value, SECRET_KEY).toString();
			var data = { 
				content: encryptedText, 
				type: 'text',
				utcDate: new Date().toISOString(), 
				pseudo: myPseudo, 
				// isEncrypted: true, 
				id: 'msg-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
				authorId: localStorage.getItem('user-id')
			};
					
			addMessage({ ...data, received: false, read:false}, 'me');
			socket.emit('chat message', data);
		}
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
	
	const currentUserId = localStorage.getItem('user-id');
	if (!document.hidden) {
		clearInterval(notificationInterval);
		notificationInterval = null;
		document.title = originalTitle;
		
		if (pendingReadIds.length > 0) {
			pendingReadIds.forEach(id => {
				socket.emit('confirm read', id, currentUserId, myPseudo);
			});
			pendingReadIds = [];
		}
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
	var t = bridgeTranslations[currentLang];    
			
	let displayText = "";
	let displayImage = null;
	let displayAudio = null;
	let success = true;

	// --- LOGIQUE DE DÉCHIFFREMENT ---
	if (data.type && SECRET_KEY) {
		try {
			if (data.type === 'text' && data.content && data.content.length > 0) {
				var textBytes = CryptoJS.AES.decrypt(data.content, SECRET_KEY);
				var decryptedText = textBytes.toString(CryptoJS.enc.Utf8);
				displayText = decryptedText || t.key_ko;
			}
			if (data.type === 'image' && data.content) {
				if (data.content.startsWith('data:image')) {
					displayImage = data.content;
				} else {
					var imgBytes = CryptoJS.AES.decrypt(data.content, SECRET_KEY);
					var decryptedImg = imgBytes.toString(CryptoJS.enc.Utf8);
					displayImage = decryptedImg || null;
					if (!displayImage) displayText = t.key_ko;
				}
			}
			if (data.type === 'voice' && data.content) {
				try {
					let rawBase64 = "";
					if (data.content.startsWith('data:audio')) {
						rawBase64 = data.content;
					} else {
						var audioBytes = CryptoJS.AES.decrypt(data.content, SECRET_KEY);
						rawBase64 = audioBytes.toString(CryptoJS.enc.Latin1);
					}
					if (!rawBase64 || !rawBase64.startsWith('data:audio')) {
						displayText = t.key_ko;
						displayAudio = null;
					} else {
						var blob = dataURLtoBlob(rawBase64);
						if (blob) {
							displayAudio = URL.createObjectURL(blob);
						} else { 
							displayText = t.key_ko;
						}
					}
				} catch (e) {
					console.error("Erreur technique audio:", e);
					displayText = t.key_ko;
				}
			}
		} catch (e) { 
			console.error("Erreur de déchiffrement :", e);
			displayText = t.key_ko; 
		}
	} else {
		displayText = data.content || "";
		displayImage = data.content || null;
		displayAudio = data.content || null;
	}
	if (displayText === t.key_ko){
		success = false;
		// return success
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
	var tickContent = (data.received) ? '✓✓' : '✓';
	var tickColor = (data.read) ? 'color: #3498db;' : '';
	var statusCheckHtml = (side === 'me') ? `<span class="status-check" id="tick-${data.id || Date.now()}" style="${tickColor}">${tickContent}</span>` : "";
	var deleteBtnHtml = (side === 'me' && displayText !== t.key_ko) ? `<div class="deleted-btn" style="cursor:pointer; margin-right:8px;" onclick="deleteMessage('${data.id}','${data.authorId}')">🗑️</div>` : "";
	var editBtnHtml = (side === 'me' && data.type === 'text' && data.content.length > 0 && displayText !== t.key_ko) ? `<div class="edited-btn" style="cursor:pointer; margin-right:8px;" onclick="editMessage('${data.id}')">✏️</div>` : "";
	var editedMsg = (data.modifiedDate) ? `<span class="edited-label" style="font-size:0.7em; opacity:0.5;">(modifié) </span>` : "";// à refaire

	item.id = data.id;
	item.innerHTML = `
		<div style="${nameStyle}">${data.pseudo || 'Anonyme'}</div>
		<div class="message-wrapper">
			<div>${displayText}</div>
			${imageHtml}
			${audioHtml}
		</div>
		<div class="message-footer" style="display: flex; align-items: center; justify-content: flex-end; margin-top:3px">
			${editedMsg}
			<span class="time">${formatToLocalTime(data.utcDate) || ''}</span>
			${statusCheckHtml}
			${deleteBtnHtml}
			${editBtnHtml}
		</div>
	`;
	
	if (data.emojis && data.emojis.length > 0) {
		let reactionContainer = document.createElement('div');
		reactionContainer.className = 'reactions-container';
		
		data.emojis.forEach(emoji => {
			reactionContainer.innerHTML += `<span class="reaction-badge">${emoji}</span>`;
		});
		
		item.appendChild(reactionContainer);
	}
	
	if (side === 'them') {
		// Pour la souris (PC)
		item.onmousedown = () => {
			startPress(data.id, item);
		};
		item.onmouseup = cancelPress;
		item.onmouseleave = cancelPress;

		// Pour le tactile (Mobile)
		item.ontouchstart = () => {
			startPress(data.id, item);
		};
		item.ontouchend = cancelPress;
	}	

	// --- LOGIQUE D'INSERTION ---
	var messagesList = document.getElementById('messages');
	if (isPrepend) {
		messagesList.prepend(item); 
	} else {
		messagesList.appendChild(item);
		messagesList.scrollTop = messagesList.scrollHeight;
	}
	
	return success;
}    

document.addEventListener('mousedown', (event) => {
    const picker = document.getElementById('emoji-reaction');
    if (picker && !picker.contains(event.target)) {
        picker.style.display = 'none';
    }
});