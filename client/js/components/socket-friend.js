//socket-friend.js
		
function setupSocketFriend() {
    const myId = localStorage.getItem('user-id') || userId;
	if (!socket) return;
			
    socket.on('friends-list', (friends) => {
        const listFriends = document.getElementById('list-friends');
        const listRequests = document.getElementById('list-requests');
        const listSends = document.getElementById('list-sends');
        const secRequests = document.getElementById('section-requests');

        listSends.innerHTML = '';
        listFriends.innerHTML = '';
        listRequests.innerHTML = '';
        let requestCount = 0;

        friends.forEach(f => {            
            if (f.vault) {
                const sharedKey = generateSharedKey(myId, f.id);
                const decryptedData = decryptVault(f.vault, sharedKey);
                friendPseudo = decryptedData.pseudo; 
                friendAvatar = decryptedData.avatar;
            } else {
                friendPseudo = "Utilisateur " + f.id.substring(0, 5); 
                friendAvatar = "assets/img/default-avatar.png";
            }
            const html = `
                <div class="friend-item" id="${f.id}">
                    <img src="${friendAvatar}" class="friend-avatar">
                    <div class="friend-info">
                        <span class="friend-pseudo">${friendPseudo}</span>
                    </div>
                    ${f.status === 'pending' && !f.isRequester 
                        // ? `<button onclick="acceptFriend('${f.id}')">✅</button><button onclick="refuseFriend('${f.id}')">❌</button>` 
                        ? `<button onclick="acceptFriend('${f.id}')">✅</button>` 
                        : ``}
                    ${f.status === 'accepted' 
                        ? `<button onclick="joinChannel('${f.channelId}','${f.id}','${friendPseudo}','${friendAvatar}')">💬</button>` 
                        : ``}
                </div>
            `;

            if (f.status === 'accepted') {
                listFriends.innerHTML += html;
            } else if (!f.isRequester) {
                listRequests.innerHTML += html;
                requestCount++;
            } else if (f.isRequester) {
                listSends.innerHTML += html;
                requestCount++;
            }
        });

        secRequests.style.display = requestCount > 0 ? 'block' : 'none';
    });

    socket.on('friend-request-success', (friendRequest) => {             
        if (friendRequest.idFrom === myId){
            const listSends = document.getElementById('list-sends');
            const html = `
                <div class="friend-item" id="${friendRequest.idTo}">
                    <img src="assets/img/default-avatar.png" class="friend-avatar">
                    <div class="friend-info">
                        <span class="friend-pseudo">${friendRequest.idTo}</span>
                    </div>
                </div>
            `;
            document.getElementById('section-requests').style.display = 'block';
            listSends.innerHTML += html;        
//console.log(`friend-request-success`);
        } else {
            console.log(`Ce n'est pas ma demande d'ami`);}
    });
    
    socket.on('friend-demand-success', (friendRequest) => {             
        if (friendRequest.idTo === myId){
            const listSends = document.getElementById('list-requests');            
            const sharedKey = generateSharedKey(myId, friendRequest.idFrom);
            const decryptedData = decryptVault(friendRequest.vaultFrom, sharedKey);
            const friendPseudo = decryptedData.pseudo; 
            const friendAvatar = decryptedData.avatar;
            const html = `
                <div class="friend-item" id="${friendRequest.idFrom}">
                    <img src="${friendAvatar}" class="friend-avatar">
                    <div class="friend-info">
                        <span class="friend-pseudo">${friendPseudo}</span>
                    </div>
                    <button onclick="acceptFriend('${friendRequest.idFrom}')">✅</button><button onclick="refuseFriend('${friendRequest.idFrom}')">❌</button>
                </div>
            `;
            document.getElementById('section-requests').style.display = 'block';
            listSends.innerHTML += html;        
//console.log(`friend-demand-success`);
        } else {
            console.log(`Ce n'est pas ma demande d'ami`);}
    });
    
    socket.on('friend-accept-success', (friendAccept) => {        
        if (friendAccept.idFrom === myId){
            const friendElem = document.getElementById(friendAccept.idTo);
            if (friendElem) {
                friendElem.style.display = 'none'; //retire de la liste la demande acceptée
                const listFriends = document.getElementById('list-friends');
                const friendPseudo = friendElem.querySelector('.friend-pseudo').innerText;
                const friendAvatar = friendElem.querySelector('.friend-avatar').src;
                const html = `
                    <div class="friend-item" id="${friendAccept.idTo}">
                        <img src="${friendAvatar}" class="friend-avatar">
                        <div class="friend-info">
                            <span class="friend-pseudo">${friendPseudo}</span>
                        </div>
                        <button onclick="joinChannel('${friendAccept.channelId}','${friendAccept.idFrom}')">💬</button>
                    </div>
                `;
                listFriends.innerHTML += html;
            }
        } else {
            console.log(`Ce n'est pas ma demande d'ami`);}
    });
    
    socket.on('friend-accepted-success', (friendAccept) => {     
        if (friendAccept.idTo === myId){
            console.log(`C'est ma demande d'ami`);
            document.getElementById(friendAccept.idFrom).style.display = 'none'; //retire de la liste la demande envoyée
            const listFriends = document.getElementById('list-friends');     
            const sharedKey = generateSharedKey(myId, friendAccept.idFrom);
            const decryptedData = decryptVault(friendAccept.vaultFrom, sharedKey);
            const friendPseudo = decryptedData.pseudo; 
            const friendAvatar = decryptedData.avatar;
            const html = `
                <div class="friend-item" id="${friendAccept.idFrom}">
                    <img src="${friendAvatar}" class="friend-avatar">
                    <div class="friend-info">
                        <span class="friend-pseudo">${friendPseudo}</span>
                    </div>
                    <button onclick="joinChannel('${friendAccept.channelId}','${friendAccept.idFrom}')">💬</button>
                </div>
            `;
            listFriends.innerHTML += html;
        } else {
            console.log(`Ce n'est pas ma demande d'ami`);}
    });
}