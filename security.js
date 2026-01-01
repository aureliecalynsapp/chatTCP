//security.js

function startSecurityProcess() {			
	var lang = localStorage.getItem('preferred-lang') || (navigator.language.startsWith('fr') ? 'fr' : 'en');
	var t = translations[lang] || translations['fr']
	var pass = prompt(t.prompt_password);
	var secret = process.env.CHAT_PASSWORD;

	if (pass === secret) {
		SECRET_KEY = prompt(t.prompt_secret_key);
				
		if (!SECRET_KEY) {
			alert(t.alert_key_mandatory);
			return;
		}

		myPseudo = prompt(t.prompt_pseudo) || "Anonyme";

		// --- C'EST ICI QU'ON LANCE LA CONNEXION ---
		socket = io(); // On initialise la connexion seulement maintenant !

		// On définit les écouteurs AVANT de faire le join
		setupSocketListeners(); 

		document.getElementById('welcome-screen').style.display = 'none';
		document.getElementById('chat-container').style.display = 'flex';

		var myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
		socket.emit('join', myPseudo, myTZ);
		
	} else {
		alert(t.alert_access_denied);
	}
}