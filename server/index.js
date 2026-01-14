var express = require('express');
var path = require('path');
var app = express();
app.use(express.static(path.join(__dirname, '../client')));
var http = require('http');
var server = http.createServer(app);
var { Server } = require("socket.io");
var fs = require('fs');

var io = new Server(server, {
    maxHttpBufferSize: 1e7 // 10Mo pour les photos chiffrées
});

var DATA_FILE = path.join(__dirname, 'data', 'messages.json');
let messagesSave = [];
var userTimezones = {};

// Chargement initial (On charge TOUT l'historique)
try {
	if (fs.existsSync(DATA_FILE)) {
		var fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
		messagesSave = fileContent ? JSON.parse(fileContent) : [];
	}
} catch (err) {
	console.error("Erreur lecture historique:", err);
	messagesSave = [];
}

io.on('connection', (socket) => {
	console.log(`Utilisateur sur l'appli`);
	
	// authentification
	socket.on('check-auth', (submittedPassword) => {
		var correctPassword = process.env.CHAT_PASSWORD;
				
		if (submittedPassword === correctPassword) {
			socket.emit('auth-result', { success: true });
		} else {
			socket.emit('auth-result', { success: false });
		}
	});		
	
	// Écoute les erreurs envoyées par les clients
	socket.on('client error', (data) => {
		console.log(`❌ ERREUR CLIENT [${data.pseudo}]: ${data.message} à la ligne ${data.line} dans ${data.source}`);
	});

	// 1. Gestion de l'arrivée
	const activeUsers = {}; 

	socket.on('join', (data) => {
		const pseudo = (typeof data === 'object') ? data.pseudo : data;
		const timezone = (typeof data === 'object') ? data.tz : arguments[1];
		const userId = (typeof data === 'object') ? data.userId : null;

		socket.pseudo = pseudo;
		socket.userId = userId;

		if (userId) {
			activeUsers[userId] = {
				pseudo: pseudo,
				timezone: timezone,
				lastSeen: Date.now()
			};
		}

		userTimezones[userId] = timezone;
		io.emit('update users timezones', userTimezones);
		
		// --- Historique ---
		var last20 = messagesSave.slice(-20);
		socket.emit('load history', last20);
		
		console.log(`👤 ${pseudo} (ID: ${userId}) a rejoint le chat.`);
	});

	// --- NOUVEAU : Gestion du bouton "Charger plus" ---
	socket.on('load more', (currentCount) => {
		var total = messagesSave.length;
		var end = total - currentCount;
		var start = Math.max(0, end - 20);

		if (end > 0) {
			var olderBatch = messagesSave.slice(start, end);
			socket.emit('older messages', olderBatch);
		} else {
			socket.emit('older messages', []);
		}
	});

	// 2. Gestion des messages
	socket.on('chat message', (data) => {
		data.received = false;
		data.read = false;
		messagesSave.push(data);

		// Nettoyage des images (Garde les 10 dernières)
		let imageMessages = messagesSave.filter(m => m.image);
		if (imageMessages.length > 10) {
			let toClean = imageMessages.length - 10;
			let cleanedCount = 0;
			for (let i = 0; i < messagesSave.length; i++) {
				if (messagesSave[i].image && cleanedCount < toClean) {
					messagesSave[i].image = null;
					cleanedCount++;
				}
			}
		}

		fs.writeFile(DATA_FILE, JSON.stringify(messagesSave, null, 2), 'utf-8', (err) => {
			if (err) console.error("Erreur sauvegarde:", err);
		});

		socket.broadcast.emit('chat message', data);
		// socket.emit('message received', data.id);
	});
	
	socket.on('confirm received', (id) => {
		let msg = messagesSave.find(m => m.id === id);
		if (msg && !msg.received) {
			msg.received = true;
			fs.writeFile(DATA_FILE, JSON.stringify(messagesSave, null, 2), 'utf-8', (err) => {
				if (err) return console.error("Erreur save received status:", err);				
			});
			io.emit('status update', { id: id, status: 'received' });
		}
	});
	
	socket.on('confirm read', (id) => {
		let msg = messagesSave.find(m => m.id === id);
		if (msg && !msg.read) {
			msg.received = true;
			msg.read = true;
			// SAUVEGARDE PHYSIQUE DANS LE JSON
			fs.writeFile(DATA_FILE, JSON.stringify(messagesSave, null, 2), 'utf-8', (err) => {
				if (err) return console.error("Erreur save read status:", err);
			});
			io.emit('status update', { id: id, status: 'read' });
		}
	});

    // 3. Gestion du "LU"
    // socket.on('message read', (msgId) => {
        // let msg = messagesSave.find(m => m.id === msgId);
        // if (msg) msg.read = true;

        // socket.broadcast.emit('user read message', msgId);
        // fs.writeFile(DATA_FILE, JSON.stringify(messagesSave), (err) => {
            // if (err) console.error("Erreur sauvegarde read-status:", err);
        // });
    // });

	// 4. Typing indicators
	socket.on('typing', (pseudo) => { socket.broadcast.emit('user typing', pseudo); });
	socket.on('stop typing', () => { socket.broadcast.emit('user stop typing'); });

	// 5. Déconnexion
	socket.on('disconnect', () => {
		if (socket.pseudo) {
			console.log(`📡 ${socket.pseudo} (ID: ${socket.userId}) s'est déconnecté.`);
			delete userTimezones[socket.userId];
			io.emit('update users timezones', userTimezones);
		}
	});

	socket.on('delete message', (messageId) => {
		// 1. On le retire de la mémoire (messages.json)
		const index = messagesSave.findIndex(m => m.id === messageId);
		
		if (index !== -1) {
			// Optionnel : Vérifier que le socket.userId est bien l'authorId du message (SÉCURITÉ)
			if (messagesSave[index].authorId === socket.userId) {
				messagesSave.splice(index, 1);
				
				try {
					fs.writeFileSync(DATA_FILE, JSON.stringify(messagesSave, null, 2), 'utf-8');
					console.log(" Message supprimé dans messages.json");
					
					// 5. On prévient les clients SEULEMENT si le fichier est OK
					io.emit('message deleted', messageId);
				} catch (err) {
					console.error("ERREUR d'écriture :", err);
				}
			} else {
				console.log("Tentative de suppression non autorisée par :", socket.pseudo);
			}
		}
	});
		
	socket.on('edit message', ({ id, newText }) => {
		const msg = messagesSave.find(m => m.id === id);
		if (msg && msg.authorId === socket.userId) {
			msg.text = newText;
			msg.edited = true; // On ajoute un flag
			msg.read = false;      // Le message redeviendra gris (non lu)
			msg.received = false;  // On attend que l'autre le reçoive à nouveau
			msg.utcDate = new Date().toISOString(); // Optionnel: on met à jour l'heure

			fs.writeFile(DATA_FILE, JSON.stringify(messagesSave, null, 2), 'utf-8', (err) => {
				if (!err) {
					console.log(" Message mis à jour dans messages.json");
					io.emit('message edited', { id: id, text: newText, pseudo: msg.pseudo, authorId: msg.authorId });
				}
			});
		}
	});
});

var PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});