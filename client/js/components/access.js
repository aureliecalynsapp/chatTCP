// access.js

document.getElementById('access-view').addEventListener('click', (e) => {
    if (e.target && e.target.id === 'welcome-return') {
		e.preventDefault();
        document.getElementById('welcome-view').style.display = 'flex';
        document.getElementById('access-view').style.display = 'none';
    }	
});

document.getElementById('access-view').addEventListener('submit', (e) => {
	e.preventDefault();
    // if (e.target.id === 'access_btn') {
		var typedPseudo = document.getElementById('input_pseudo').value.trim();
		var typedKey = document.getElementById('input_key').value.trim();
		const currentLang = localStorage.getItem('preferred-lang') || 'fr';
		var t = accessTranslations[currentLang];    
		if (!typedPseudo || !typedKey) {
			alert(t.alert_key_mandatory);
			return;
		}

		var pass = prompt(t.prompt_password);
			
		socket = io({
			transports: ['polling', 'websocket'],
			upgrade: true,
			reconnectionAttempts: 5,
			timeout: 10000
		});
		socket.emit('check-auth', pass);
		socket.once('auth-result', async(response) => {
			if (response.success) {    
				await loadComponentFull(`bridge`);
				await loadComponentJs(`ui`);
				await loadComponentJs(`socket-logic`);
				await loadLibsJs(`crypto-js.min`);
					
				myPseudo = typedPseudo;
				SECRET_KEY = typedKey;
			
				setupSocketListeners(); 
				setupDynamicListeners();
				
				const isMobileTactile = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && (window.innerWidth <= 800);
				if (isMobileTactile) {
					setupMobileListeners();
				} else {
					await loadLibsJs(`emoji-browser`);					
				}
				
				document.getElementById('access-view').style.display = 'none';
				document.getElementById('bridge-view').style.display = 'flex';
					
				var myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
				socket.emit('join', myPseudo, myTZ);					
					
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
	// }	  
});