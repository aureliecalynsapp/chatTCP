//socket-logic.js
var typingIndicator = document.getElementById('typing-indicator');
let pendingReadIds = [];
		
function setupSocketListeners() {
	if (!socket) return;
		
	socket.on('load history', (h) => {
		var btn = document.getElementById('load_more_btn');
		const currentLang = localStorage.getItem('preferred-lang') || 'fr';
		const currentUserId = localStorage.getItem('user-id');
		
		if (h.length >= 20) {
			btn.style.display = 'block';
			if (typeof bridgeTranslations !== 'undefined' && bridgeTranslations[currentLang]) {
				btn.textContent = bridgeTranslations[currentLang].load_more_btn;
			}
		} else {
			btn.style.display = 'none';
		}

		h.forEach(m => {
			const isDecryptedSuccessfully = addMessage(m, m.authorId === currentUserId ? 'me' : 'them');
			
			if (m.authorId !== currentUserId && m.id && isDecryptedSuccessfully && !m.read) {
				socket.emit('confirm read', m.id);
			}
		});
	});
	
	socket.on('chat message', function(data) {
		let msgData = (typeof data === 'object') ? data : { text: data, pseudo: 'Anonyme', time: getNowFormatted(), id: Date.now(), authorId: 'legacy-user' };
		const currentUserId = localStorage.getItem('user-id');
		let isDecryptedSuccessfully = false;

		if (msgData.authorId !== currentUserId) { 
			console.log("Réception d'un message de : " + msgData.pseudo);
			isDecryptedSuccessfully = addMessage(msgData, 'them');
			if (isDecryptedSuccessfully) {
				socket.emit('confirm received', msgData.id);
			}
			if (!document.hidden && isDecryptedSuccessfully) {
				socket.emit('confirm read', msgData.id);
			}
		}	
		
		if (document.hidden && isDecryptedSuccessfully) {
			var notificationSound = new Audio('/assets/sounds/pop.mp3');
			notificationSound.play().catch(e => console.log("Le navigateur bloque le son sans interaction"));
			sendSystemNotification(msgData.pseudo)
			pendingReadIds.push(data.id);
		}
	});
		
	socket.on('user typing', (pseudo) => {
		if (typeof bridgeTranslations !== 'undefined' && bridgeTranslations[lang]) {
			typingIndicator.textContent = pseudo + bridgeTranslations[lang].typing;
		}
	});
	
	socket.on('user stop typing', () => { typingIndicator.textContent = ""; });

	socket.on('user read message', (msgId) => {
		var tick = document.getElementById(`tick-${msgId}`);
		if (tick) {
			tick.innerText = '✓✓';
			tick.style.color = '#3498db';
		}
	});
	
	socket.on('status update', function({ id, status }) {
		const tick = document.getElementById(`tick-${id}`);
		if (tick) {
			if (status === 'received') {
				tick.innerText = '✓✓';
				tick.style.color = '#bdc3c7'; // Gris
			} else if (status === 'read') {
				tick.innerText = '✓✓';
				tick.style.color = '#3498db'; // Bleu
			}
		}
	});
	
	socket.on('update users timezones', (allTZ) => {
		const currentUserId = localStorage.getItem('user-id');
		let foundOther = false;
		for (let user in allTZ) {
			if (user !== currentUserId) {
				themTZ = allTZ[user];
				foundOther = true;				
				setupClocksVisibility(themTZ);
				break;
			}			
		}
		if (!foundOther) {
			document.getElementById('clocks-container').style.display = 'none';
		}
	});
	
	socket.on('older messages', (olderMessages) => {
		var btn = document.getElementById('load_more_btn');
		const currentUserId = localStorage.getItem('user-id');
		if (olderMessages.length === 0) {
			btn.style.display = 'none';
			return;
		}
		
		if (typeof bridgeTranslations !== 'undefined' && bridgeTranslations[lang]) {
			btn.textContent = bridgeTranslations[lang].load_more;
		}
		
		var messagesList = document.getElementById('messages');
		var oldHeight = messagesList.scrollHeight; 
		olderMessages.reverse().forEach(data => {
				var side = (data.authorId === currentUserId) ? 'me' : 'them';
				addMessage(data, side, true); 
		});
		messagesList.scrollTop = messagesList.scrollHeight - oldHeight;
		
		if (olderMessages.length < 20) btn.style.display = 'none';
	});
	
	socket.on('message deleted', (messageId) => {
    const element = document.getElementById(messageId);
    if (element) {
        element.style.transition = "opacity 0.5s";
        element.style.opacity = "0";
        setTimeout(() => element.remove(), 500); // Suppression fluide
    }
	});
	
	
	socket.on('message edited', ({ id, text, pseudo, authorId }) => {
		const currentUserId = localStorage.getItem('user-id');
		const element = document.getElementById(id);
		let displayText = null;
		if (element) {
			// On cible la div qui contient le texte à l'intérieur de la bulle
			const textContainer = element.querySelector('.message-wrapper div:first-child');
			try {
				var textBytes = CryptoJS.AES.decrypt(text, SECRET_KEY);
				var decryptedText = textBytes.toString(CryptoJS.enc.Utf8);
				displayText = decryptedText;				
			} catch (e) { 
				console.error("Erreur de déchiffrement :", e);
			}
				if (displayText) {
					textContainer.textContent = displayText;
					// Optionnel : ajouter une petite mention "(modifié)"
					if (!element.querySelector('.edited-label')) {
						const label = document.createElement('span');
						label.className = 'edited-label';
						label.innerText = ' (modifié)';
						label.style.fontSize = '0.7em';
						label.style.opacity = '0.5';
						element.querySelector('.message-footer').prepend(label);
					}
				
					if (authorId !== currentUserId) {
						socket.emit('confirm received', id);
						
						if (!document.hidden) {
							socket.emit('confirm read', id);
						} else  {
							var notificationSound = new Audio('/assets/sounds/pop.mp3');
							notificationSound.play().catch(e => console.log("Le navigateur bloque le son sans interaction"));
							sendSystemNotification(pseudo)
							pendingReadIds.push(id);
						}
					}
				}
		}
	});
	
	// DANS SOCKET-LOGIC.JS (CLIENT)
	// socket.on('message edited', (data) => {
		// const container = document.querySelector(`[data-id="${data.id}"]`);
		// if (!container) return;

		// // 1. Mise à jour visuelle du texte
		// const textElement = container.querySelector('.message-text');
		// let decrypted = decrypt(data.text, SECRET_KEY);
		// textElement.innerHTML = decrypted + ' <small>(édité)</small>';

		// // 2. Remettre les ticks en GRIS (puisque data.read est false)
		// updateMessageStatus(data.id, false, false); 

		// // 3. RELANCER LE CYCLE DE LECTURE
		// const currentUserId = localStorage.getItem('user-id');
		// const authorId = container.getAttribute('data-author-id'); // Il faut stocker l'auteur dans le DOM

		// if (authorId !== currentUserId && decrypted !== t.key_ko) {
			// // J'ai réussi à lire la nouvelle version, je préviens le serveur !
			// socket.emit('confirm read', data.id);
		// }
	// });
	
}