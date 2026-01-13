//socket-logic.js
var typingIndicator = document.getElementById('typing-indicator');
		
function setupSocketListeners() {
	if (!socket) return;
		
	socket.on('load history', (h) => {
		var btn = document.getElementById('load_more_btn');
		const currentLang = localStorage.getItem('preferred-lang') || 'fr';
		
		if (h.length >= 20) {
			btn.style.display = 'block';
			if (typeof bridgeTranslations !== 'undefined' && bridgeTranslations[currentLang]) {
				btn.textContent = bridgeTranslations[currentLang].load_more_btn;
			}
		} else {
			btn.style.display = 'none';
		}

		h.forEach(m => {
			addMessage(m, m.pseudo === myPseudo ? 'me' : 'them');
			
			if (m.pseudo !== myPseudo && m.id) {
				socket.emit('message read', m.id);
			}
		});
	});
		
	socket.on('chat message', function(data) {
		let msgData = (typeof data === 'object') ? data : { text: data, pseudo: 'Anonyme', time: getNowFormatted(), id: Date.now() };

		if (msgData.pseudo !== myPseudo) { 
			console.log("Réception d'un message de : " + msgData.pseudo);
			addMessage(msgData, 'them');
			
			if (msgData.id) {
				socket.emit('message read', msgData.id);
			}
		}	
		
		console.log("Message reçu ! État de la page :", document.visibilityState);	
		if (document.hidden) {
			var notificationSound = new Audio('/assets/sounds/pop.mp3');
			notificationSound.play().catch(e => console.log("Le navigateur bloque le son sans interaction"));
			sendSystemNotification(msgData.pseudo)
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
	
	socket.on('update users timezones', (allTZ) => {
		let foundOther = false;
		for (let user in allTZ) {
			if (user !== myPseudo) {
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
				var side = (data.pseudo === myPseudo) ? 'me' : 'them';
				addMessage(data, side, true); 
		});
		messagesList.scrollTop = messagesList.scrollHeight - oldHeight;
		
		if (olderMessages.length < 20) btn.style.display = 'none';
	});
}