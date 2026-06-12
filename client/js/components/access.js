// access.js
let userId = null;
		
const socket = io({
	transports: ['polling', 'websocket'],
	upgrade: true,
	reconnectionAttempts: 5,
	timeout: 10000
});

document.getElementById('access-view').addEventListener('click', (e) => {
    if (e.target && e.target.id === 'welcome-return') {
		e.preventDefault();
        document.getElementById('welcome-view').style.display = 'flex';
        document.getElementById('access-view').style.display = 'none';
    }	
});

document.getElementById('access-form').addEventListener('submit', async(e) => {
	e.preventDefault();
	const currentLang = localStorage.getItem('preferred-lang') || 'fr';
	var t = accessTranslations[currentLang];
	const typedPseudo = document.getElementById('input_pseudo').value.trim();
	const typedKey = document.getElementById('input_key').value.trim();
	if (!typedPseudo || !typedKey) {
		alert(t.alert_key_mandatory);
		return;
	}
	userId = await getUserId(typedPseudo,typedKey);
	const authHash = await generateAuthHash(userId);
	
    //const tempSocket = io({ transports: ['polling', 'websocket'] });
    socket.emit('login-user', { userId: userId, authHash: authHash });
    socket.on('login-success', (encryptedVault) => {
        try {
            const decryptedData = decryptVault(encryptedVault, typedKey);
			if (decryptedData.pseudo === typedPseudo) {
            	enterApp(decryptedData.pseudo, t, decryptedData.avatar);
			} else {alert("Identifiants incorrects.");}
        } catch (error) {
            alert("Clé de sécurité invalide. Impossible de déchiffrer le coffre.");
            socket.disconnect();
        }
    });
    socket.on('login-error', (err) => {
        alert("Erreur de connexion : " + err.message);
        socket.disconnect();
    });	
});

document.getElementById('access-new-form').addEventListener('submit', async (e) => {
	e.preventDefault();
	const currentLang = localStorage.getItem('preferred-lang') || 'fr';
	var t = accessTranslations[currentLang];
	const newPseudo = document.getElementById('input_pseudo_new').value.trim();
	const newKey = document.getElementById('input_key_new').value;
	if (newPseudo.length < 3 || newKey.length < 10) {
		alert(t.alert_key_length);
		return;
	}

	userId = await getUserId(newPseudo,newKey);
	const authHash = await generateAuthHash(userId);
	const vaultData = {
		pseudo: newPseudo,
		avatar: "assets/img/default-avatar.png"
	};
	const vaultString = JSON.stringify(vaultData);
	const encryptedVault = CryptoJS.AES.encrypt(vaultString, newKey).toString();

	socket.emit('register-user', {
		userId: userId,
		authHash: authHash,
		vault: encryptedVault
	});
	socket.once('register-success', () => {
		//socket.disconnect();
    	socket.emit('login-register-user', { userId: userId});
		enterApp(vaultData.pseudo, t, vaultData.avatar);
	});
	socket.on('register-error', (err) => {
		alert("Erreur : " + err.message);
		socket.disconnect();
	});	
});

document.getElementById('access_sec1_text').addEventListener('click', () => {
	document.getElementById('access-main').style.display = 'none';
	document.getElementById('access-new').style.display = 'block';	
});

async function enterApp(pseudo, t, avatar) {   
		const currentLang = localStorage.getItem('preferred-lang') || 'fr';
		var t = accessTranslations[currentLang];
		var pass = prompt(t.prompt_password);			
		//socket = io({
		//	transports: ['polling', 'websocket'],
		//	upgrade: true,
		//	reconnectionAttempts: 5,
		//	timeout: 10000
		//});
		socket.emit('check-auth', pass);
		socket.once('auth-result', async(response) => {
			if (response.success) {    
				await loadComponentFull(`home`);
            	await loadComponentJs(`socket-home`);
            	setupSocketHome();
				
				myPseudo = pseudo;
				myAvatar = avatar;
        		localStorage.setItem('user-id', userId);
				
				const isMobileTactile = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && (window.innerWidth <= 800);
				if (isMobileTactile) {
					setupMobileListeners();
				} else {
					// await loadLibsJs(`emoji-browser`);					
				}
				const headerImg = document.getElementById('header-avatar');
				if (headerImg && myAvatar) {
					headerImg.src = myAvatar;
				}
				document.getElementById('home_user_pseudo').textContent = myPseudo;				
				document.getElementById('access-view').style.display = 'none';
				document.getElementById('home-view').style.display = 'flex';
					
				var myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;				
					
				// On crée un contexte audio ou on joue un son bref pour "déverrouiller"
				var audio = new Audio('/assets/sounds/pop.mp3');
				audio.muted = true;
				audio.play().then(() => {
					console.log("Audio débloqué pour cette session !");
				}).catch(e => console.log("Déverrouillage audio échoué"));
				
				requestNotificationPermission();
		
			} else {
					alert(t.alert_access_denied);
					socket.disconnect();
			}
		});
};

async function getUserId(pseudo, userKey) {
    	const salt = "SALT_ID_GENERATOR"; 
		const encoder = new TextEncoder();
		const idData = encoder.encode(pseudo + userKey + salt);
		const idBuffer = await crypto.subtle.digest('SHA-256', idData);
		userId = Array.from(new Uint8Array(idBuffer))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('').substring(0, 14).toUpperCase();
    return userId;
};

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
};

function setupMobileListeners() {		
	document.addEventListener('touchmove', (e) => {
		if (e.scale !== 1) { 
			e.preventDefault(); }
	}, { passive: false });
		
	document.addEventListener('touchstart', (e) => {
		if (e.touches.length > 1) {
			e.preventDefault(); 
		}
	}, { passive: false });

	document.addEventListener('gesturestart', (e) => {
		e.preventDefault();
	});
};

function decryptVault(encryptedVault, key) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedVault, key);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedData) throw new Error("Clé incorrecte");
        
        return JSON.parse(decryptedData);
    } catch (e) {
        console.error("Erreur de déchiffrement :", e);
        return null;
    }
};

async function generateAuthHash(userId) {
    const salt = "TCPAJ"; 
    const encoder = new TextEncoder();
    const data = encoder.encode(userId + salt);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    // Conversion en hexadécimal, extraction des 10 premiers caractères et mise en majuscules
    return hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 10)
        .toUpperCase();
}