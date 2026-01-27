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

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir);
}
let messagesSave = [];
var userTimezones = {};
const activeUsers = {}; 
// const userId = "";
const database = require('./database');

async function startApp() {
	
// Au démarrage du serveur
	await database.initdatabase();
	console.log("✅ Base de données prête");
	
	const PORT = process.env.PORT || 3000;
	server.listen(PORT, () => {
		console.log(`Serveur prêt sur le port ${PORT}`);
	});
	
	io.on('connection', (socket) => {
		console.log(`Utilisateur sur l'appli`);
		
		// authentification
		socket.on('check-auth', (submittedPassword) => {
			var correctPassword = process.env.CHAT_PASSWORD;					
			if (submittedPassword === correctPassword) {
				socket.emit('auth-result', { success: true });				
				// socket.userId = socket.handshake.query.userId;				
			} else {
				socket.emit('auth-result', { success: false });
			}
		});		
		
		// Écoute les erreurs envoyées par les clients
		socket.on('client error', (data) => {
			console.log(`❌ ERREUR CLIENT [${data.pseudo}]: ${data.message} à la ligne ${data.line} dans ${data.source}`);
		});

		// Gestion de l'arrivée
		socket.on('join', async (data) => {
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
			messagesSave = await database.getMessagesByCanal('1');
			console.log(`✅ ${messagesSave.length} messages chargés`);
			socket.emit('load history', messagesSave);
			
			console.log(`👤 ${pseudo} (ID: ${userId}) a rejoint le chat.`);
		});

		// Gestion du bouton "Charger plus"
		socket.on('load more', async (data) => {
			const limit = 20;
			const messagesMore = await database.getMessagesByCanal(data.canalId, limit + 1, data.lastId);
			const hasMore = messagesMore.length > limit;
			if (hasMore) {
				messagesMore.shift();
			}
			socket.emit('older messages', { 
				messagesMore: messagesMore, 
				hasMore: hasMore 
			});
		});

		// Gestion des messages
		socket.on('chat message', async(data) => {

			// Nettoyage des images (Garde les 10 dernières)
			// let imageMessages = messagesSave.filter(m => m.image);
			// if (imageMessages.length > 10) {
				// let toClean = imageMessages.length - 10;
				// let cleanedCount = 0;
				// for (let i = 0; i < messagesSave.length; i++) {
					// if (messagesSave[i].image && cleanedCount < toClean) {
						// messagesSave[i].image = null;
						// cleanedCount++;
					// }
				// }
			// }

			try {
				const saved = await database.saveMessage(data);		
				socket.broadcast.emit('chat message', data);
			} catch (err) {
				console.error("Erreur BDD:", err);
			}
		});
		
		socket.on('confirm received', async (id, userId, pseudo) => {
			const received = await database.getReactionReceivedByMessage(id);
			if (!received) {
				await database.insertMessageStatus(id, 'received', userId, pseudo);
				io.emit('status update', { id: id, status: 'received' });
			}
		});
		
		socket.on('confirm read', async (id, userId, pseudo) => {
			const read = await database.getReactionReadByMessage(id);
			if (!read) {
				await database.insertMessageStatus(id, 'received', userId, pseudo);
				await database.insertMessageStatus(id, 'read', userId, pseudo);
				io.emit('status update', { id: id, status: 'read' });
			}
		});

		// Typing indicators
		socket.on('typing', (pseudo) => { socket.broadcast.emit('user typing', pseudo); });
		socket.on('stop typing', () => { socket.broadcast.emit('user stop typing'); });

		// Déconnexion
		socket.on('disconnect', () => {
			if (socket.pseudo) {
				console.log(`📡 ${socket.pseudo} (ID: ${socket.userId}) s'est déconnecté.`);
				delete userTimezones[socket.userId];
				io.emit('update users timezones', userTimezones);
			}
		});

		// Réaction
		socket.on('delete message', async (msg) => {
			if (msg.authorId === socket.userId) {
				try {
					await database.insertMessageStatus(msg.id, 'deleted', msg.authorId, msg.pseudo);
					console.log(" Message supprimé");
					io.emit('message deleted', msg.id);
				} catch (err) {
					console.error("ERREUR d'écriture :", err);
				}
			} else {
				console.log("Tentative de suppression non autorisée par :", socket.pseudo, msg.authorId, socket.userId);
			}
		});
			
		socket.on('edit message', async (msg) => {
			if (msg.authorId === socket.userId) {				
				try {
					await database.updateMessage(msg.id, msg.newText);
					console.log(" Message modifié");
					io.emit('message edited', { id: msg.id, text: msg.newText, pseudo: msg.pseudo, authorId: msg.authorId });
				} catch (err) {
					console.error("ERREUR d'écriture :", err);
				}
			} else {
				console.log("Tentative de modification non autorisée par :", socket.pseudo, msg.authorId, socket.userId);
			}
		});
		
		socket.on('message reaction', async (msg) => {
			await database.insertEmoji(msg.id, msg.emoji, msg.userId, msg.pseudo);
			io.emit('reaction added', { 
				id: msg.id, 
				emoji: msg.emoji, 
				userId: socket.userId 
			});
		});
	});
}

startApp();