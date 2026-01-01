//security.js

function startSecurityProcess() {            
    var lang = localStorage.getItem('preferred-lang') || (navigator.language.startsWith('fr') ? 'fr' : 'en');
    var t = translations[lang] || translations['fr'];
    
    var pass = prompt(t.prompt_password);

    socket = io();

    socket.emit('check-auth', pass);

    socket.on('auth-result', (response) => {
        if (response.success) {
            SECRET_KEY = prompt(t.prompt_secret_key); // La clé de chiffrement des messages
            
            if (!SECRET_KEY) {
                alert(t.alert_key_mandatory);
                return;
            }

            myPseudo = prompt(t.prompt_pseudo) || "Anonyme";
            setupSocketListeners(); 

            document.getElementById('welcome-screen').style.display = 'none';
            document.getElementById('chat-container').style.display = 'flex';

            var myTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
            socket.emit('join', myPseudo, myTZ);
        } else {
            alert(t.alert_access_denied);
            socket.disconnect();
        }
    });
}