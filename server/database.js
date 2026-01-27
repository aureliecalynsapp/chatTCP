const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const dbPath = path.join(__dirname, 'data', 'chat.db'); 

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("ERREUR d'ouverture de la base :", err.message);
    } else {
        console.log("Connecté à la base SQLite à :", dbPath);
    }
});

const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbGet = promisify(db.get.bind(db));

const database = {
	async initdatabase() {
		try {
			// Table des messages
			await dbRun(`
				CREATE TABLE IF NOT EXISTS messages (
					message_id TEXT NOT NULL,
					canal_id TEXT NOT NULL,
					author_id TEXT NOT NULL,
					pseudo TEXT NOT NULL,
					type TEXT NOT NULL,
					content TEXT NOT NULL,
					created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
					modified_date DATETIME,
					bytes_size INTEGER,
					reply_to TEXT,
					FOREIGN KEY (reply_to) REFERENCES messages(message_id)
				)
			`);
			
			// INDEX pour charger les messages d'un canal instantanément
			await dbRun(`CREATE INDEX IF NOT EXISTS idx_canal ON messages(canal_id)`);
			
			// INDEX pour filtrer par auteur au sein d'un canal
			await dbRun(`CREATE INDEX IF NOT EXISTS idx_canal_author ON messages(canal_id, author_id)`);

			// Table des status
			await dbRun(`
				CREATE TABLE IF NOT EXISTS reactions (
					message_id TEXT NOT NULL,
					user_id TEXT NOT NULL,
					pseudo TEXT,
					reaction TEXT NOT NULL,
					emoji TEXT,
					created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (message_id, user_id, reaction),
					FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE
				)
			`);
			
			await dbRun(`CREATE INDEX IF NOT EXISTS idx_message ON reactions(message_id)`);
			
			// Table des réactions
			// await dbRun(`
				// CREATE TABLE IF NOT EXISTS reactions (
					// message_id TEXT,
					// user_id TEXT,
					// emoji TEXT,
					// PRIMARY KEY (message_id, user_id, emoji),
					// FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE
				// )
			// `);

			console.log("Tables initialisées avec succès.");
		} catch (err) {
			console.error("Erreur lors de l'initialisation :", err);
		}
	},

	async saveMessage(msgData) {
		const bytes = Buffer.byteLength(msgData.content, 'utf8');
		const sql = `INSERT INTO messages (message_id, canal_id, author_id, pseudo, type, content, bytes_size) VALUES (?, ?, ?, ?, ?, ?, ?)`;		
		try {
			const result = await dbRun(sql, [msgData.id, '1', msgData.authorId, msgData.pseudo, msgData.type, msgData.content, bytes]);
			return {
				success: true,
				messageId: msgData.id,
				size: bytes
			};
		} catch (err) {
			console.error("Erreur DB:", err);
			throw err;
		}
	},
		
	async insertMessageStatus(id, status, userId, pseudo) {
		const sql = `INSERT INTO reactions (message_id, user_id, pseudo, reaction) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`;
		
		try {
			const result = await dbRun(sql, [id, userId, pseudo, status]);
			return {
				success: true
			};
		} catch (err) {
			console.error("Erreur DB:", err);
			throw err;
		}
	},
	
	async insertEmoji(id, emoji, userId, pseudo) {
		const sql = `INSERT INTO reactions (message_id, user_id, pseudo, reaction, emoji) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`;
		
		try {
			const result = await dbRun(sql, [id, userId, pseudo, 'emoji', emoji]);
			return {
				success: true
			};
		} catch (err) {
			console.error("Erreur DB:", err);
			throw err;
		}
	},

	async getReactionReceivedByMessage(messageId) {
		const sql = `SELECT 1 FROM reactions WHERE message_id = ? and reaction = 'received'`;
		try {
			const result = await dbGet(sql, [messageId]);
			return !!result; 
		} catch (err) {
			console.error("Erreur récupération messages status:", err);
			return [];
		}
	},
	
	async getReactionReadByMessage(messageId) {
		const sql = `SELECT 1 FROM reactions WHERE message_id = ? and reaction = 'read'`;
		try {
			const result = await dbGet(sql, [messageId]);
			return !!result; 
		} catch (err) {
			console.error("Erreur récupération messages status:", err);
			return [];
		}
	},
	
	async getMessagesByCanal(canalId, limit = 20, lastId = null) {
		let sql = `
			SELECT msg.*, rcvd.received, rd.read
			, COALESCE(modified_date, created_date) AS effective_date
			, (SELECT GROUP_CONCAT(emoji) FROM reactions WHERE message_id = msg.message_id AND reaction = 'emoji') as emoji_list
			FROM messages msg
			LEFT JOIN (SELECT message_id, true as received FROM reactions WHERE reaction = 'received') rcvd ON msg.message_id = rcvd.message_id 
			LEFT JOIN (SELECT message_id, true as read FROM reactions WHERE reaction = 'read') rd ON msg.message_id = rd.message_id 
			LEFT JOIN (SELECT message_id FROM reactions WHERE reaction = 'deleted') dltd ON msg.message_id = dltd.message_id 
			WHERE canal_id = ? AND dltd.message_id IS NULL
		`;
		let params = [canalId];
		
		if (lastId) {
            // Sous-requête : on cherche les messages dont la date est 
            // inférieure à celle du message 'lastId'
            sql += ` AND created_date < (SELECT created_date FROM messages WHERE message_id = ?)`;
            params.push(lastId);
        }
		
		sql += ` ORDER BY created_date DESC LIMIT ?`;
        params.push(limit);
// console.log("SQL:", sql);
// console.log("Params:", params);
		try {
			const rows = await dbAll(sql, params);
			return rows.reverse().map(row => this.mapMessage(row));
		} catch (err) {
			console.error("Erreur récupération messages :", err);
			return [];
		}
	},

	async getCanalConsumption(canalId) {
		const sql = `SELECT SUM(bytes_size) as total_bytes FROM messages WHERE canal_id = ?`;
		const result = await dbGet(sql, [canalId]);
		return result.total_bytes || 0;
	},
	
	async getAuthorConsumption(authorId) {
		const sql = `SELECT SUM(bytes_size) as total_bytes FROM messages WHERE author_id = ?`;
		const result = await dbGet(sql, [authorId]);
		return result.total_bytes || 0;
	},
	
	async updateMessage(messageId, newContent) {
		const sql = `UPDATE messages SET content = ?, modified_date = CURRENT_TIMESTAMP WHERE message_id = ?`;
		try {
			await dbRun(sql, [newContent, messageId]);
			return true;
		} catch (err) {
			console.error("Erreur update SQLite:", err);
			return false;
		}
	},
	
	mapMessage(dbRow) {
		return {
			id: dbRow.message_id,
			canalId: dbRow.canal_id,
			authorId: dbRow.author_id,
			pseudo: dbRow.pseudo,
			type: dbRow.type,
			content: dbRow.content,
			utcDate: dbRow.effective_date,
			received: dbRow.received,
			read: dbRow.read,
			modifiedDate: dbRow.modified_date,
			emojis: dbRow.emoji_list ? dbRow.emoji_list.split(',') : []
			// bytesSize: dbRow.bytes_size,
			// replyTo: dbRow.reply_to
		};
	}
}

module.exports = database;
