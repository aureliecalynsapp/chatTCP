// quotes.js
var positiveQuotes = [
	{ 
        fr: "Chaque jour est une nouvelle chance de briller.", 
        en: "Every day is a new chance to shine.", 
        zh: "每一天都是个闪耀的新机会。" 
    },
    { 
        fr: "Le succès est la somme de petits efforts répétés.", 
        en: "Success is the sum of small efforts repeated.", 
        zh: "成功是点滴努力的不断积累。" 
    },
    { 
        fr: "Cultivez l'optimisme, c'est un aimant à bonheur.", 
        en: "Cultivate optimism; it's a happiness magnet.", 
        zh: "培养乐观，它是幸福的磁铁。" 
    },
    { 
        fr: "Ta seule limite est celle que tu t'imposes.", 
        en: "Your only limit is the one you set yourself.", 
        zh: "你唯一的限制就是你自己设定的那个。" 
    },
    { 
        fr: "La patience est amère, mais son fruit est doux.", 
        en: "Patience is bitter, but its fruit is sweet.", 
        zh: "忍耐是苦涩的，但它的果实是甜美的。" 
    },
    { 
        fr: "Fais de ta vie un rêve, et d'un rêve, une réalité.", 
        en: "Make your life a dream, and a dream, a reality.", 
        zh: "把你的生活变成梦想，再把梦想变成现实。" 
    },
    { 
        fr: "Le bonheur ne se trouve pas, il se crée.", 
        en: "Happiness is not found, it is created.", 
        zh: "幸福不是寻找来的，而是创造出来的。" 
    },
    { 
        fr: "Rien n'est impossible à celui qui croit.", 
        en: "Nothing is impossible to those who believe.", 
        zh: "对相信的人来说，没有什么是不可能的。" 
    },
    { 
        fr: "La gratitude transforme ce que nous avons en assez.", 
        en: "Gratitude turns what we have into enough.", 
        zh: "感恩能让我们把拥有的变成足够。" 
    },
    { 
        fr: "Souris au monde et le monde te sourira.", 
        en: "Smile at the world and the world will smile back.", 
        zh: "向世界微笑，世界也会向你微笑。" 
    }
];

/**
 * Fonction pour récupérer la citation du jour selon la langue
 */
function getDailyQuote(lang) {
    var today = new Date();
    // On utilise le jour de l'année pour que la citation change chaque jour
    var dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    var index = dayOfYear % positiveQuotes.length;
    
    // On retourne la citation dans la langue demandée (ou fr par défaut)
    return positiveQuotes[index][lang] || positiveQuotes[index]['fr'];
}

/**
 * Fonction pour mettre à jour la citation du jour selon la langue
 */
function displayDailyQuote(forcedLang) {
	var currentLang = forcedLang || localStorage.getItem('preferred-lang') || 'fr';
	var quoteText = getDailyQuote(currentLang);
	var quoteEl = document.getElementById('quote-text');
	if (quoteEl) {
		quoteEl.innerText = quoteText;
	}
}