//socket-logic.js
		
function setupSocketListeners() {
	// On vérifie que le socket existe bien
	if (!socket) return;
		
	socket.on('load history', (h) => {
		const btn = document.getElementById('load-more-btn');
		
		// 1. Afficher ou cacher le bouton
		if (h.length >= 20) {
			btn.style.display = 'block';
			const lang = localStorage.getItem('preferred-lang') || 'fr';
			// On vérifie que translations existe avant d'afficher
			if (typeof translations !== 'undefined' && translations[lang]) {
				btn.textContent = translations[lang].load_more;
			}
		} else {
			btn.style.display = 'none';
		}

		// 2. Vider les messages (Le bouton ne risque plus rien !)
		messages.innerHTML = '';

		// 3. Ajouter les messages
		h.forEach(m => {
			addMessage(m, m.pseudo === myPseudo ? 'me' : 'them');
			
			// Confirmation de lecture
			if (m.pseudo !== myPseudo && m.id) {
				socket.emit('message read', m.id);
			}
		});
	});
		
	socket.on('chat message', function(data) {
		// On s'assure que data est un objet
		let msgData = (typeof data === 'object') ? data : { text: data, pseudo: 'Anonyme', time: getNowFormatted(), id: Date.now() };

		// CORRECTION : On utilise myPseudo (ta variable globale)
		if (msgData.pseudo !== myPseudo) { 
			console.log("Réception d'un message de : " + msgData.pseudo);
			addMessage(msgData, 'them');
			
			// On informe le serveur qu'on a lu le message
			if (msgData.id) {
				socket.emit('message read', msgData.id);
			}
		}
	});
		
	socket.on('user typing', (pseudo) => {
		const lang = localStorage.getItem('preferred-lang') || 'fr';
		// On vérifie que translations existe avant d'afficher
		if (typeof translations !== 'undefined' && translations[lang]) {
			typingIndicator.textContent = pseudo + translations[lang].typing;
		}
	});
	
	socket.on('user stop typing', () => { typingIndicator.textContent = ""; });

	socket.on('user read message', (msgId) => {
		const tick = document.getElementById(`tick-${msgId}`);
		if (tick) {
			tick.innerText = '✓✓'; // Passage au double check
			tick.style.color = '#3498db'; // Passage au bleu
		}
	});
	
	socket.on('update users timezones', (allTZ) => {
		// On cherche le fuseau de la personne qui n'est pas "Moi"
		for (let user in allTZ) {
			if (user !== myPseudo) {
				themTZ = allTZ[user];
			}			
		}
	});	
	
	// Réception des messages anciens
	socket.on('older messages', (olderMessages) => {
		const btn = document.getElementById('load-more-btn');
		if (olderMessages.length === 0) {
			btn.style.display = 'none'; // Plus rien à charger
			return;
		}
		
		const lang = localStorage.getItem('preferred-lang') || 'fr';
		// On vérifie que translations existe avant d'afficher
		if (typeof translations !== 'undefined' && translations[lang]) {
			btn.textContent = translations[lang].load_more;
		}
		
		const messagesList = document.getElementById('messages');
		const oldHeight = messagesList.scrollHeight; // On mémorise la hauteur avant insertion
		// On insère les messages un par un juste après le bouton
		// On les inverse pour qu'ils s'affichent dans le bon ordre chronologique
		olderMessages.reverse().forEach(data => {
				const side = (data.pseudo === myPseudo) ? 'me' : 'them';
				addMessage(data, side, true); 
		});
		// RECALCUL DU SCROLL : On replace l'utilisateur là où il était
		// pour éviter que l'écran ne saute tout en bas
		messagesList.scrollTop = messagesList.scrollHeight - oldHeight;
		
		if (olderMessages.length < 20) btn.style.display = 'none';
	});
	
}