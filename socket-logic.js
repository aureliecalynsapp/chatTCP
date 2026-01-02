//socket-logic.js
		
function setupSocketListeners() {
	// On vérifie que le socket existe bien
	if (!socket) return;
		
	socket.on('load history', (h) => {
		var btn = document.getElementById('load-more-btn');
		
		// 1. Afficher ou cacher le bouton
		if (h.length >= 20) {
			btn.style.display = 'block';
			var lang = localStorage.getItem('preferred-lang') || 'fr';
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
		// Notification
		console.log("Message reçu ! État de la page :", document.visibilityState);	
		if (document.hidden) {
			var notificationSound = new Audio('/sounds/pop.mp3');
			notificationSound.play().catch(e => console.log("Le navigateur bloque le son sans interaction"));
			sendSystemNotification(msgData.pseudo)
		}
	});
		
	socket.on('user typing', (pseudo) => {
		var lang = localStorage.getItem('preferred-lang') || 'fr';
		// On vérifie que translations existe avant d'afficher
		if (typeof translations !== 'undefined' && translations[lang]) {
			typingIndicator.textContent = pseudo + translations[lang].typing;
		}
	});
	
	socket.on('user stop typing', () => { typingIndicator.textContent = ""; });

	socket.on('user read message', (msgId) => {
		var tick = document.getElementById(`tick-${msgId}`);
		if (tick) {
			tick.innerText = '✓✓'; // Passage au double check
			tick.style.color = '#3498db'; // Passage au bleu
		}
	});
	
	socket.on('update users timezones', (allTZ) => {
		// 1. On cherche le fuseau de la personne qui n'est pas "Moi"
		let foundOther = false;
		for (let user in allTZ) {
			if (user !== myPseudo) {
				themTZ = allTZ[user]; // Met à jour la variable globale
				foundOther = true;
				
				// 2. On pilote l'affichage des horloges (Fonction dans ui.js)
				if (typeof setupClocksVisibility === 'function') {
					setupClocksVisibility(themTZ);
				}
				break; // On a trouvé l'interlocuteur, on s'arrête
			}			
		}

		// 3. Si on est seul dans le salon, on cache les horloges
		/*if (!foundOther) {
			var clockContainer = document.getElementById('clocks-container');
			if (clockContainer) clockContainer.style.display = 'none';
		}*/
	});
	
	// Réception des messages anciens
	socket.on('older messages', (olderMessages) => {
		var btn = document.getElementById('load-more-btn');
		if (olderMessages.length === 0) {
			btn.style.display = 'none'; // Plus rien à charger
			return;
		}
		
		var lang = localStorage.getItem('preferred-lang') || 'fr';
		// On vérifie que translations existe avant d'afficher
		if (typeof translations !== 'undefined' && translations[lang]) {
			btn.textContent = translations[lang].load_more;
		}
		
		var messagesList = document.getElementById('messages');
		var oldHeight = messagesList.scrollHeight; // On mémorise la hauteur avant insertion
		// On insère les messages un par un juste après le bouton
		// On les inverse pour qu'ils s'affichent dans le bon ordre chronologique
		olderMessages.reverse().forEach(data => {
				var side = (data.pseudo === myPseudo) ? 'me' : 'them';
				addMessage(data, side, true); 
		});
		// RECALCUL DU SCROLL : On replace l'utilisateur là où il était
		// pour éviter que l'écran ne saute tout en bas
		messagesList.scrollTop = messagesList.scrollHeight - oldHeight;
		
		if (olderMessages.length < 20) btn.style.display = 'none';
	});
	

}