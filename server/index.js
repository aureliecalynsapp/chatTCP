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
		console.log(`Utilisateur sur le socket ${socket.id}`);
		
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

		// Création de compte 
		socket.on('register-user', async (data) => {
			const { userId, authHash, vault } = data;
			if (!userId || !authHash || !vault) {
				return socket.emit('register-error', { message: "Données incomplètes" });
			}
			try {
				const result = await database.insertUser(userId, authHash, vault);
				if (result.success) {
					console.log(`Nouveau compte créé : ${userId}`);
					socket.emit('register-success', { userId });
				} else if (result.error === "ALREADY_EXISTS") {
					socket.emit('register-error', { message: "Cet identifiant est déjà pris." });
				}
			} catch (err) {
				socket.emit('register-error', { message: "Erreur lors de la création du compte." });
			}

			
		});

		// Maj du compte
		socket.on('update-vault', async (data) => {
			const { userId, authHash, newVault } = data;
			try {
				const result = await database.updateUserVault(userId, authHash, newVault);				
				if (result.success) {
					io.to(userId).emit('update-success', { message: "Profil synchronisé." });
					console.log(`Vault mis à jour pour : ${userId}`);
				}
			} catch (err) {
				socket.emit('update-error', { message: "Erreur lors de la sauvegarde." });
			}
		});

		// Connection
		socket.on('login-user', async (data) => {
			const { userId, authHash } = data;
			try {
				const result = await database.getUser(userId, authHash);
				if (result.success) {
					console.log(`Connexion réussie : ${userId}`);
					// On renvoie le vault au client pour qu'il puisse déchiffrer son profil
					socket.join(userId);
					io.to(userId).emit('login-success', result.vault);	
        			console.log(`User ${userId} est lié au socket ${socket.id}`);
				} else {
					socket.emit('login-error', { message: "Identifiants invalides." });
				}
			} catch (err) {
				socket.emit('login-error', { message: "Erreur serveur lors de la connexion." });
			}
		});
		
		socket.on('login-register-user', async (data) => {
			const { userId } = data;
			try {
				console.log(`Connexion réussie : ${userId}`);
				socket.join(userId);
        		console.log(`User ${userId} est lié au socket ${socket.id}`);
			} catch (err) {
				socket.emit('login-error', { message: "Erreur serveur lors de la connexion." });
			}
		});

		// Gestion de l'arrivée
		socket.on('join-channel', async (data) => {
			const pseudo = (typeof data === 'object') ? data.pseudo : data;
			const timezone = (typeof data === 'object') ? data.tz : arguments[1];
			const userId = (typeof data === 'object') ? data.userId : null;
			const channelId = (typeof data === 'object') ? data.channelId : null;

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
			socket.join(channelId);
			// io.to(channelId).emit('update users timezones', userTimezones);
						
			// --- Historique ---
			messagesSave = await database.getMessagesByChannel(channelId);
			console.log(`✅ ${messagesSave.length} messages chargés`);
			socket.emit('load history', messagesSave, userId);
			
			console.log(`👤 ${pseudo} (ID: ${userId}) a rejoint le chat ${channelId}`);
		});

		// Gestion des amis
		socket.on('get-my-friends', async (myId) => {
			const response = await database.getFriends(myId);
			const friendsList = [];
			if (response.success) {
				for (const row of response.friends) {
					const friendId = (row.userId1 === myId) ? row.userId2 : row.userId1;
					const friendData = (row.userId1 === myId) ? row.vault2 : row.vault1;
//console.log("channelId dans index.js :", row.channelId);
					friendsList.push({
						id: friendId,
						vault: friendData,
						status: row.status,
						isRequester: (row.actionUserId === myId),
						channelId: row.channelId
					});
				}
				io.to(myId).emit('friends-list', friendsList);
			} else {
				// Gestion du cas sans amis (NO_FRIENDS)
				io.to(myId).emit('friends-list', []);
				console.log("L'utilisateur n'a pas encore d'amis.");
			}			
		});

		socket.on('friend-request', async (friendRequest)=> {
			const saved = await database.insertFriend(friendRequest.idFrom, friendRequest.idTo, friendRequest.vaultFrom);
			if (saved.success) {
					//console.log(`Demande d'ami envoyé à : ${friendRequest.idTo}`);
					io.to(friendRequest.idFrom).emit('friend-request-success', friendRequest );
					io.to(friendRequest.idTo).emit('friend-demand-success', friendRequest );
				} else if (saved.error === "ALREADY_EXISTS") {
					socket.emit('register-error', { message: "Cette demande d'ami a déjà été envoyée." });
				}
		});
		
		socket.on('friend-accept', async (friendAccept)=> {
			const saved = await database.acceptFriend(friendAccept.idTo, friendAccept.idFrom, friendAccept.vaultFrom);
			if (saved.success) {
					//console.log(`Demande d'ami accepté : ${friendAccept.idTo}`);
					await database.createChannel(friendAccept.idTo, friendAccept.idFrom, friendAccept.channelId)
					io.to(friendAccept.idFrom).emit('friend-accept-success', friendAccept );
					io.to(friendAccept.idTo).emit('friend-accepted-success', friendAccept );
				} else if (saved.error === "ALREADY_EXISTS") {
					socket.emit('register-error', { message: "Cette demande d'ami n'existe pas." });
				}
		});

		// Gestion du bouton "Charger plus"
		socket.on('load more', async (data) => {
			const limit = 20;
			const messagesMore = await database.getMessagesByChannel(data.channelId, limit + 1, data.lastId);
			const hasMore = messagesMore.length > limit;
			if (hasMore) {
				messagesMore.shift();
			}
			socket.emit('older messages', { 
				messagesMore: messagesMore, 
				hasMore: hasMore,
				userId: data.userId
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
				io.to(data.channelId).emit('chat message', data);
			} catch (err) {
				console.error("Erreur BDD:", err);
			}
		});
		
		socket.on('confirm received', async (id, userId, pseudo, channelId) => {
			const received = await database.getReactionReceivedByMessage(id);
			if (!received) {
				await database.insertMessageStatus(id, 'received', userId, pseudo);
				socket.to(channelId).emit('status update', { id: id, status: 'received' });
			}
		});
		
		socket.on('confirm read', async (id, userId, pseudo, channelId) => {
			const read = await database.getReactionReadByMessage(id);
			if (!read) {
				await database.insertMessageStatus(id, 'received', userId, pseudo);
				await database.insertMessageStatus(id, 'read', userId, pseudo);
				socket.to(channelId).emit('status update', { id: id, status: 'read' });
			}
		});

		// Typing indicators
		socket.on('typing', (pseudo, channelId) => { socket.to(channelId).emit('user typing', pseudo); });
		socket.on('stop typing', (channelId) => { socket.to(channelId).emit('user stop typing'); });

		// Déconnexion d'un channel
		socket.on('out-channel', (channelId) => {
			if (socket.userId && channelId) {
				console.log(`📡 ${socket.pseudo} (ID: ${socket.userId}) s'est déconnecté du chat ${channelId}`);
				delete userTimezones[socket.userId];
				// socket.to(channelId).emit('update users timezones', userTimezones);
				socket.leave(channelId);
			}
		});

		// Réaction
		socket.on('delete message', async (msg) => {
			if (msg.authorId === socket.userId) {
				try {
					await database.insertMessageStatus(msg.id, 'deleted', msg.authorId, msg.pseudo);
					console.log(" Message supprimé");
					io.to(msg.channelId).emit('message deleted', msg.id);
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
					io.to(msg.channelId).emit('message edited', { id: msg.id, text: msg.newText, pseudo: msg.pseudo, authorId: msg.authorId });
				} catch (err) {
					console.error("ERREUR d'écriture :", err);
				}
			} else {
				console.log("Tentative de modification non autorisée par :", socket.pseudo, msg.authorId, socket.userId);
			}
		});
		
		socket.on('message reaction', async (msg) => {
			await database.insertEmoji(msg.id, msg.emoji, msg.userId, msg.pseudo);
			socket.to(msg.channelId).emit('reaction added', { 
				id: msg.id, 
				emoji: msg.emoji, 
				userId: socket.userId 
			});
		});
	});
}

startApp();