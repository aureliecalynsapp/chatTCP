//socket-logic.js
var typingIndicator = document.getElementById('typing-indicator');
let pendingReadIds = [];
const currentLang = localStorage.getItem('preferred-lang') || 'fr';
		
function setupSocketListeners() {
	if (!socket) return;
	
	const currentUserId = localStorage.getItem('user-id');
		
	socket.on('load history', (h) => {
		if (h) {
			const btn = document.getElementById('load_more_btn');
			
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
					socket.emit('confirm read', m.id, currentUserId, myPseudo);
				}
			});
			console.log("Historique chargé");
		} else {
			console.log("Pas d'historique");
		}
	});
	
	socket.on('chat message', (data) => {
		let msgData = (typeof data === 'object') ? data : { text: data, pseudo: 'Anonyme', time: getNowFormatted(), id: Date.now(), authorId: 'legacy-user' };
		let isDecryptedSuccessfully = false;

		if (msgData.authorId !== currentUserId) { 
			console.log("Réception d'un message de : " + msgData.pseudo);
			isDecryptedSuccessfully = addMessage(msgData, 'them');
			if (isDecryptedSuccessfully) {
				socket.emit('confirm received', msgData.id, currentUserId, myPseudo);
			}
			if (!document.hidden && isDecryptedSuccessfully) {
				socket.emit('confirm read', msgData.id, currentUserId, myPseudo);
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
		if (typeof bridgeTranslations !== 'undefined' && bridgeTranslations[currentLang]) {
			typingIndicator.textContent = pseudo + bridgeTranslations[currentLang].typing;
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
	
	socket.on('status update', ({ id, status }) => {
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
	
	socket.on('older messages', (msg) => {
		const btn = document.getElementById('load_more_btn');	
		if (msg.messagesMore.length === 0) {
			btn.style.display = 'none';
			return;
		}		
		if (typeof bridgeTranslations !== 'undefined' && bridgeTranslations[currentLang]) {
			btn.textContent = bridgeTranslations[currentLang].load_more_btn;
		}
		try {
			var messagesList = document.getElementById('messages');
			var oldHeight = messagesList.scrollHeight; 
			msg.messagesMore.reverse().forEach(data => {
					var side = (data.authorId === currentUserId) ? 'me' : 'them';
					addMessage(data, side, true); 
			});
			messagesList.scrollTop = messagesList.scrollHeight - oldHeight;
		} catch (e) {
			console.error("Erreur pendant l'ajout des messages :", e);
		}
		if (!msg.hasMore) {
			btn.style.display = 'none';
		} 
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
		const element = document.getElementById(id);
		let displayText = null;
		if (element) {
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
					if (!element.querySelector('.edited-label')) {
						const label = document.createElement('span');
						label.className = 'edited-label';
						label.innerText = '(modifié) ';
						label.style.fontSize = '0.7em';
						label.style.opacity = '0.5';
						element.querySelector('.message-footer').prepend(label);
					}
					const timeEl = element.querySelector('.time');
					if (timeEl) {
						timeEl.textContent = formatToLocalTime(new Date().toISOString());
					}
				
					if (authorId !== currentUserId) {
						socket.emit('confirm received', id, currentUserId, myPseudo);
						
						if (!document.hidden) {
							socket.emit('confirm read', id, currentUserId, myPseudo);
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
	
	socket.on('reaction added', ({id, emoji}) => {
		const element = document.getElementById(id);
		if (element) {
			let reactionContainer = element.querySelector('.reactions-container');
			if (!reactionContainer) {
				reactionContainer = document.createElement('div');
				reactionContainer.className = 'reactions-container';
				element.appendChild(reactionContainer);
			}
			reactionContainer.innerHTML += `<span class="badge">${emoji}</span>`;
		}
	});
}