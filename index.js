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
const userTimezones = {}; // Stockage des fuseaux hors de l'écouteur

// Chargement initial
try {
    if (fs.existsSync(DATA_FILE)) {
        messagesSave = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
} catch (err) {
    console.error("Erreur lecture historique:", err);
}

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.get('/cgu', (req, res) => { res.sendFile(__dirname + '/cgu.html'); });

io.on('connection', (socket) => {
    console.log('Utilisateur connecté');
    
    // 1. Gestion de l'arrivée (Pseudo + Timezone)
    socket.on('join', (pseudo, timezone) => {
        socket.pseudo = pseudo;
        userTimezones[pseudo] = timezone;
        io.emit('update users timezones', userTimezones);
        // On envoie l'historique seulement après le "join" pour être sûr
        socket.emit('load history', messagesSave);
    });

    // 2. Gestion des messages (Texte et Images chiffrées)
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