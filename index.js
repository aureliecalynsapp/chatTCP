const express = require('express');
const app = express();
app.use(express.static(__dirname)); 
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const fs = require('fs');

const io = new Server(server, {
    maxHttpBufferSize: 1e7 // 10Mo pour les photos chiffrées
});

const DATA_FILE = './messages.json';
let messagesSave = [];
const userTimezones = {};

// Chargement initial (On charge TOUT l'historique)
try {
    if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        messagesSave = fileContent ? JSON.parse(fileContent) : [];
    }
} catch (err) {
    console.error("Erreur lecture historique:", err);
    messagesSave = [];
}

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.get('/cgu', (req, res) => { res.sendFile(__dirname + '/cgu.html'); });

io.on('connection', (socket) => {
    console.log('Utilisateur connecté');
	
	// Écoute les erreurs envoyées par les clients
    socket.on('client error', (data) => {
        console.log(`❌ ERREUR CLIENT [${data.pseudo}]: ${data.message} à la ligne ${data.line} dans ${data.source}`);
    });
    
    // 1. Gestion de l'arrivée
    socket.on('join', (pseudo, timezone) => {
        socket.pseudo = pseudo;
        userTimezones[pseudo] = timezone;
        io.emit('update users timezones', userTimezones);
        
        // --- MODIFICATION ICI : On n'envoie que les 20 derniers à la connexion ---
        const last20 = messagesSave.slice(-20);
        socket.emit('load history', last20);
    });

    // --- NOUVEAU : Gestion du bouton "Charger plus" ---
    socket.on('load more', (currentCount) => {
        const total = messagesSave.length;
        const end = total - currentCount;
        const start = Math.max(0, end - 20);

        if (end > 0) {
            const olderBatch = messagesSave.slice(start, end);
            socket.emit('older messages', olderBatch);
        } else {
            socket.emit('older messages', []);
        }
    });

    // 2. Gestion des messages
    socket.on('chat message', (data) => {
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

       fs.writeFile(DATA_FILE, JSON.stringify(messagesSave), (err) => {
            if (err) console.error("Erreur sauvegarde:", err);
        });
        
        socket.broadcast.emit('chat message', data);
        socket.emit('message received', data.id);
    });

    // 3. Gestion du "LU"
    socket.on('message read', (msgId) => {
        let msg = messagesSave.find(m => m.id === msgId);
        if (msg) msg.read = true;

        socket.broadcast.emit('user read message', msgId);
        fs.writeFile(DATA_FILE, JSON.stringify(messagesSave), (err) => {
            if (err) console.error("Erreur sauvegarde read-status:", err);
        });
    });

    // 4. Typing indicators
    socket.on('typing', (pseudo) => { socket.broadcast.emit('user typing', pseudo); });
    socket.on('stop typing', () => { socket.broadcast.emit('user stop typing'); });

    // 5. Déconnexion
    socket.on('disconnect', () => {
        if (socket.pseudo) {
            delete userTimezones[socket.pseudo];
            io.emit('update users timezones', userTimezones);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});