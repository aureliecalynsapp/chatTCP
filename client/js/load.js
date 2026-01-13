//load.js

async function loadComponentStyle(name) {
    if (document.getElementById(`${name}-style`)) return;

    return new Promise((resolve) => {
        var link = document.createElement('link');
        link.id = `${name}-style`;
        link.rel = 'stylesheet';
        link.href = `../css/components/${name}.css`; // Utilise la variable name
        link.onload = () => resolve(); // On attend que le CSS soit prêt
        document.head.appendChild(link);
    });
}

async function loadComponentHtml(name) {
	var container = document.getElementById(`${name}-view`);
	if (container && container.innerHTML.trim() !== "") {
        return; 
    }
    try {
        var response = await fetch(`../components/${name}.html`);
        var htmlContent = await response.text();
        if (container) {
            container.innerHTML = htmlContent;
        }
    } catch (error) {
        console.error(`Erreur lors du chargement de ${name}-view :`, error);
    }
}

async function loadComponentTranslation(name) {		
	var src = `i18n/components/${name}-translation.js`;
	return new Promise((resolve, reject) => {
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

async function loadComponentJs(name) {		
	var src = `js/components/${name}.js`;
	return new Promise((resolve, reject) => {
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

async function loadLibsJs(name) {		
	var src = `js/libs/${name}.js`;
	return new Promise((resolve, reject) => {
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

function applyLanguageComponent(name) {
	const currentLang = localStorage.getItem('preferred-lang') || 'fr';
    var translations = window[`${name}Translations`];
    
    if (!translations || !translations[currentLang]) {
        console.error(`❌ Dictionnaire [${name}Translations] introuvable pour : ${currentLang}`);
        return;
    }

    var dict = translations[currentLang];

	Object.keys(dict).forEach(id => {
		var el = document.getElementById(id);
		if (el) {
			if (el.hasAttribute('placeholder')) {
				el.placeholder = dict[id];
			} else {
				el.textContent = dict[id]; 
			}
		}
	});	
	
	if (name === 'welcome') {
		displayDailyQuote(currentLang);
	}
	
	var selectors = ['welcome-lang-selector', 'access-lang-selector', 'bridge-lang-selector', 'cgu-lang-selector']; 
	selectors.forEach(id => {
		var el = document.getElementById(id);
		if (el) {
			el.value = currentLang;
		}
	});
    
    console.log(`🌍 Module [${name}] traduit en [${currentLang}]`);
}

async function loadComponentFull(name) {
    console.log(`🚀 Chargement complet du composant : ${name}...`);

    try {
        await loadComponentStyle(name);
        await loadComponentHtml(name);
        await loadComponentTranslation(name);
        await loadComponentJs(name);
		
        applyLanguageComponent(name);		

        console.log(`✅ ${name} est prêt !`);
    } catch (error) {
        console.error(`❌ Erreur lors du chargement de ${name}:`, error);
    }
}

function onLanguageChange(newLang) {
    localStorage.setItem('preferred-lang', newLang);
    const modules = ['welcome', 'access', 'bridge', 'cgu'];    
    modules.forEach(name => {
        if (window[`${name}Translations`]) {
            applyLanguageComponent(name, newLang);
        }
    });
}