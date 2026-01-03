//load.js

async function loadJs() {
		
	var scripts = [
		"crypto-js.min.js",
		"/socket.io/socket.io.js",
		"security.js",
		"emoji-browser.js",
		"core.js",
		"socket-logic.js",
		"ui.js"
	];

	for (var src of scripts) {
		await new Promise((resolve, reject) => {
			if (document.querySelector(`script[src="${src}"]`)) {
				return resolve();
			}

			var s = document.createElement('script');
			s.src = src;
			s.async = false; 
			s.onload = () => {
				resolve();
			};
			s.onerror = () => reject(`❌ Erreur sur : ${src}`);
			document.body.appendChild(s);
		});
	}
}