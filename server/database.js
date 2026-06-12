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
					channel_id TEXT NOT NULL,
					user_id TEXT NOT NULL,
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
			
			await dbRun(`CREATE INDEX IF NOT EXISTS idx_channel ON messages(channel_id)`);
			await dbRun(`CREATE INDEX IF NOT EXISTS idx_channel_user ON messages(channel_id, user_id)`);

			// Table des reactions
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
			
			// Table des users
			await dbRun(`
				CREATE TABLE IF NOT EXISTS users (
					user_id TEXT NOT NULL,
					auth_hash TEXT NOT NULL,
					vault TEXT NOT NULL,	-- pseudo + avatar
					created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
					modified_date DATETIME,
					PRIMARY KEY (user_id)
				)
			`);
			
			// Table des friends
			await dbRun(`
				CREATE TABLE IF NOT EXISTS friends (
					user_id_1 TEXT NOT NULL,
					user_id_2 TEXT NOT NULL,
					status TEXT DEFAULT 'pending',
					action_user_id TEXT, -- Qui a envoyé la demande
					vault_1 TEXT,
					vault_2 TEXT,
					created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
					modified_date DATETIME,
					PRIMARY KEY (user_id_1, user_id_2)
				)
			`);

			// Table des channels
			await dbRun(`
				CREATE TABLE IF NOT EXISTS channels (
					channel_id TEXT NOT NULL,
					type TEXT,
					created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (channel_id)
				)
			`);
			
			// Table des channel_members
			await dbRun(`
				CREATE TABLE IF NOT EXISTS channel_members (
					channel_id TEXT NOT NULL,
					user_id TEXT,
					PRIMARY KEY (channel_id, user_id),
					FOREIGN KEY (channel_id) REFERENCES channels(channel_id),
					FOREIGN KEY (user_id) REFERENCES users(user_id)
				)
			`);

			console.log("Tables initialisées avec succès.");
		} catch (err) {
			console.error("Erreur lors de l'initialisation :", err);
		}
	},

	async insertUser(userId, authHash, vault) {
		const sql = `INSERT INTO users (user_id, auth_hash, vault) VALUES (?, ?, ?)`;		
		try {
			const result = await dbRun(sql, [userId, authHash, vault]);
			return {
				success: true
			};
		} catch (err) {
			// Gestion spécifique du doublon (si l'utilisateur existe déjà)
			if (err.message.includes("UNIQUE constraint failed")) {
				return {
					success: false,
					error: "ALREADY_EXISTS"
				};
			}
			console.error("Erreur DB lors de l'insertion utilisateur:", err);
			throw err;
		}
	},

	async updateUser(userId,newVault) {
		// On met à jour la colonne vault pour l'ID correspondant
		const sql = `UPDATE users SET vault = ?, modified_date = CURRENT_TIMESTAMP WHERE user_id = ?`;
		
		try {
			const result = await dbRun(sql, [newVault, userId]);
			return {
				success: true
			};
		} catch (err) {
			console.error("Erreur DB lors de la mise à jour du vault:", err);
			return {
				success: false,
				error: err.message
			};
		}
	},

	async getUser(userId, authHash) {
		const sql = `SELECT vault FROM users WHERE user_id = ? AND auth_hash = ?`;		
		try {
			const row = await dbGet(sql, [userId, authHash]);			
			if (row) {
				return {
					success: true,
					vault: row.vault
				};
			} else {
				return {
					success: false,
					error: "AUTH_FAILED"
				};
			}
		} catch (err) {
			console.error("Erreur DB lors de la récupération utilisateur:", err);
			throw err;
		}
	},

	async getFriends(userId) {
		/*const sql = `SELECT DISTINCT f.*, cm1.channel_id 
					FROM friends f
					LEFT JOIN channel_members AS cm1 ON (f.user_id_1 = cm1.user_id AND f.status = 'accepted')
					LEFT JOIN channel_members AS cm2 ON (f.user_id_2 = cm2.user_id AND cm1.channel_id = cm2.channel_id) 
					WHERE (user_id_1 = ? OR user_id_2 = ?)`;	*/
					

		const sql = `SELECT DISTINCT f.*, m.channel_id 
					FROM friends f
					LEFT JOIN 
					(SELECT cm1.channel_id, cm1.user_id AS u1, cm2.user_id AS u2
					FROM channel_members AS cm1
					INNER JOIN channel_members AS cm2 ON  cm1.channel_id = cm2.channel_id AND cm1.user_id != cm2.user_id) AS m
					ON m.u1 = f.user_id_1 AND m.u2 = f.user_id_2
					WHERE (user_id_1 = ? OR user_id_2 = ?)`;	
					
		try {
			const rows = await dbAll(sql, [userId, userId]);	
			
			//console.log("Données brutes SQL :", rows);
			return {
				success: true,
				friends: (rows && rows.length > 0) ? rows.map(row => this.mapFriend(row)): []
			};
		} catch (err) {
			console.error("Erreur DB lors de la récupération des amis:", err);
			return { 
				success: false, 
				error: "DB_ERROR", 
				friends: [] };
		}

	},

	async insertFriend(idFrom, idTo, vaultFrom) {
		const [u1, u2, u3, u4] = idFrom < idTo ? [idFrom, idTo, vaultFrom, null] : [idTo, idFrom, null, vaultFrom];
		const sql = `INSERT INTO friends (user_id_1, user_id_2, action_user_id, vault_1, vault_2) VALUES (?, ?, ?, ?, ?)`;
		try {
			const result = await dbRun(sql,[u1,u2,idFrom,u3,u4]);
			return {
				success: true
			}
		} catch (err) {
			if (err.message.includes("UNIQUE constraint failed")) {
				return {
					success: false,
					error: "ALREADY_EXISTS"
				};
			}
			console.error("Erreur DB lors de l'insertion d'ami:", err);
			throw err;
		}
	},
	
	async acceptFriend(idTo, idFrom, vaultFrom) {
		if(idFrom < idTo) {
			const sql = `UPDATE friends SET status = 'accepted', modified_date = CURRENT_TIMESTAMP, vault_1 = ?
						WHERE user_id_1 = ? and user_id_2 = ? and action_user_id != ?`;		
			try {
				const result = await dbRun(sql, [vaultFrom, idFrom, idTo, idFrom]);
				return {
					success: true
				};
			} catch (err) {
				console.error("Erreur DB lors de la mise à jour d'ami accepté:", err);
				return {
					success: false,
					error: err.message
				};
			}
		} else {
			const sql = `UPDATE friends SET status = 'accepted', modified_date = CURRENT_TIMESTAMP, vault_2 = ?
						WHERE user_id_1 = ? and user_id_2 = ? and action_user_id != ?`;		
			try {
				const result = await dbRun(sql, [vaultFrom, idTo, idFrom, idFrom]);
				return {
					success: true
				};
			} catch (err) {
				console.error("Erreur DB lors de la mise à jour d'ami accepté:", err);
				return {
					success: false,
					error: err.message
				};
			}

		}
	},

	async createChannel(userID1, userId2, channelId) {
		const sql = `INSERT INTO channels (channel_id, type) VALUES (?, ?)`;
		try {
			const result = await dbRun(sql,[channelId,'one-to-one']);
			const sql2 = `INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)`;
			try {
				const result = await dbRun(sql2,[channelId,userID1]);
				try {
					const result = await dbRun(sql2,[channelId,userId2]);
					return {
						success: true
					}
				} catch (err) {
					if (err.message.includes("UNIQUE constraint failed")) {
						return {
							success: false,
							error: "ALREADY_EXISTS"
						};
					}
					console.error("Erreur DB lors de l'insertion d'un canal:", err);
					throw err;
				}
			} catch (err) {
				if (err.message.includes("UNIQUE constraint failed")) {
					return {
						success: false,
						error: "ALREADY_EXISTS"
					};
				}
				console.error("Erreur DB lors de l'insertion d'un canal:", err);
				throw err;
			}
		} catch (err) {
			if (err.message.includes("UNIQUE constraint failed")) {
				return {
					success: false,
					error: "ALREADY_EXISTS"
				};
			}
			console.error("Erreur DB lors de l'insertion d'un canal:", err);
			throw err;
		}
		
		
	},

	async saveMessage(msgData) {
		const bytes = Buffer.byteLength(msgData.content, 'utf8');
		const sql = `INSERT INTO messages (message_id, channel_id, user_id, pseudo, type, content, bytes_size) VALUES (?, ?, ?, ?, ?, ?, ?)`;		
		try {
			const result = await dbRun(sql, [msgData.id, msgData.channelId, msgData.authorId, msgData.pseudo, msgData.type, msgData.content, bytes]);
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
	
	async getMessagesByChannel(channelId, limit = 20, lastId = null) {
		let sql = `
			SELECT msg.*, rcvd.received, rd.read
			, COALESCE(modified_date, created_date) AS effective_date
			, (SELECT GROUP_CONCAT(emoji) FROM reactions WHERE message_id = msg.message_id AND reaction = 'emoji') as emoji_list
			FROM messages msg
			LEFT JOIN (SELECT message_id, true as received FROM reactions WHERE reaction = 'received') rcvd ON msg.message_id = rcvd.message_id 
			LEFT JOIN (SELECT message_id, true as read FROM reactions WHERE reaction = 'read') rd ON msg.message_id = rd.message_id 
			LEFT JOIN (SELECT message_id FROM reactions WHERE reaction = 'deleted') dltd ON msg.message_id = dltd.message_id 
			WHERE channel_id = ? AND dltd.message_id IS NULL
		`;
		let params = [channelId];
		
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

	async getChannelConsumption(channelId) {
		const sql = `SELECT SUM(bytes_size) as total_bytes FROM messages WHERE channel_id = ?`;
		const result = await dbGet(sql, [channelId]);
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
	
	mapFriend(dbRow) {
		return {			
			userId1: dbRow.user_id_1,
			vault1: dbRow.vault_1,
			userId2: dbRow.user_id_2,
			vault2: dbRow.vault_2,
			status: dbRow.status,
			actionUserId: dbRow.action_user_id,
			channelId: dbRow.channel_id
		};
	},

	mapMessage(dbRow) {
		return {
			id: dbRow.message_id,
			channelId: dbRow.channel_id,
			authorId: dbRow.user_id,
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
	},

	async updateUserVault(userId, authHash, newVault) {
		try {
			const userVault = await database.getUser(userId, authHash) ; 
			if (!userVault) {
				return { success: false, message: "Utilisateur introuvable" };
			}
			
			await database.updateUser(userId, newVault);

			console.log(`[DB] Vault mis à jour avec succès pour ${userId}`);
			return { success: true };

		} catch (error) {
			console.error("[DB] Erreur updateUserVault:", error);
			return { success: false, error: error.message };
		}
	}
}

module.exports = database;
