document.getElementById('home-view').addEventListener('click', async(e) => {
    if (e.target && e.target.id === 'profil_btn') {
		e.preventDefault();
        try {
            await loadComponentFull(`profile`);
            updateProfileView();
            document.getElementById('home-view').style.display = 'none';
            document.getElementById('profile-view').style.display = 'flex';	
            document.getElementById('return_btn').style.display = 'flex';
			document.getElementById('avatar_display').src = myAvatar;
        } catch (err) {
            console.error("Erreur de chargement du module profile :", err);
        }
    }	
});

document.getElementById('home-view').addEventListener('click', async(e) => {
    if (e.target && (e.target.id === 'friend_btn' || e.target.id === 'friend_request_btn')) {
		e.preventDefault();
        try {
            await loadComponentFull(`friend`);
            await loadComponentJs(`socket-friend`);
            setupSocketFriend();
            initFriends();
            //updateProfileView();
            document.getElementById('home-view').style.display = 'none';
            document.getElementById('friend-view').style.display = 'flex';	
            document.getElementById('return_btn').style.display = 'flex';
			//document.getElementById('avatar_display').src = myAvatar;
        } catch (err) {
            console.error("Erreur de chargement du module profile :", err);
        }
    }	
});

document.getElementById('home-view').addEventListener('click', async(e) => {
    if (e.target && e.target.id === 'cgu_btn') {
		e.preventDefault();
        try {
            await loadComponentFull(`cgu`);
            document.getElementById('home-view').style.display = 'none';
            document.getElementById('cgu-view').style.display = 'flex';	
            document.getElementById('return_btn').style.display = 'flex';
        } catch (err) {
            console.error("Erreur de chargement du module profile :", err);
        }
    }	
});

function logout() {
    localStorage.removeItem('user-id');
    
    window.myPseudo = null;
    window.SECRET_KEY = null;
    window.myAvatar = null;
    window.currentUserId = null;

    sessionStorage.clear();

    window.location.reload();
}