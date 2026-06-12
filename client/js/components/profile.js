
document.getElementById('main-header').addEventListener('click', (e) => {
    if (e.target && e.target.id === 'return_btn') {
		e.preventDefault();
        document.getElementById('home-view').style.display = 'flex';
        document.getElementById('profile-view').style.display = 'none';
        document.getElementById('return_btn').style.display = 'none';
    }	
});

function updateProfileView() {
    // 1. Remplissage des textes
    const pseudoDisplay = document.getElementById('profil_pseudo');
    if(pseudoDisplay) pseudoDisplay.textContent = myPseudo;

    const avatarBtn = document.getElementById('avatar-btn');
    const avatarInput = document.getElementById('avatar-input');
    const avatarDisplay = document.getElementById('avatar_display');

    if (!avatarBtn || !avatarInput) return; // Sécurité

    // 2. Faire le lien entre le bouton et l'input caché
    avatarBtn.onclick = () => avatarInput.click();

    // 3. Gestion de l'aperçu quand un fichier est choisi
    avatarInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = 100; // Taille finale
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');

                    // --- CALCUL DU RECADRAGE ---
                    let sourceX = 0;
                    let sourceY = 0;
                    let sourceWidth = img.width;
                    let sourceHeight = img.height;

                    if (img.width > img.height) {
                        // Image paysage : on coupe les côtés
                        sourceWidth = img.height;
                        sourceX = (img.width - img.height) / 2;
                    } else {
                        // Image portrait : on coupe le haut et le bas
                        sourceHeight = img.width;
                        sourceY = (img.height - img.width) / 2;
                    }

                    // On dessine uniquement le carré central de l'image source
                    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);

                    const miniBase64 = canvas.toDataURL('image/jpeg', 0.8);

                    // Mise à jour des affichages
                    document.getElementById('avatar_display').src = miniBase64;
                    const headerImg = document.getElementById('header-avatar');
                    if (headerImg) headerImg.src = miniBase64;
                    
                    saveProfileChanges(myPseudo, miniBase64);
                };
            };
            reader.readAsDataURL(file);
        }
    };
};

async function saveProfileChanges(newPseudo, newAvatarB64) {
    const updatedVaultData = {
        pseudo: newPseudo,
        avatar: newAvatarB64
    };

    // On chiffre avec ta clé secrète (que tu as gardée en mémoire lors du login)
    const encryptedVault = CryptoJS.AES.encrypt(JSON.stringify(updatedVaultData), SECRET_KEY).toString();

    // On génère le hash d'auth pour prouver au serveur qu'on a le droit de modifier ce userId
    const userId = localStorage.getItem('user-id');
    const authHash = await generateAuthHash(userId);

    // On envoie le tout au serveur
    socket.emit('update-vault', {
        userId: userId,
        authHash: authHash,
        newVault: encryptedVault
    });
}