const currentLang = localStorage.getItem('preferred-lang') || 'fr';
		
function setupSocketHome() {
	if (!socket) return;
	const currentUserId = localStorage.getItem('user-id');
    socket.on('friend-demand-success', (idTo) => {
        if(currentUserId != idTo){
            document.getElementById('friend_request_btn').style.html = '+1';
            document.getElementById('friend_request_btn').style.display = 'flex';
        }
    });
}