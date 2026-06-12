let currentBridge = {
    channelId: null,
    friendId: null,
    bridgeKey: null
};

document.getElementById('main-header').addEventListener('click', (e) => {
    if (e.target && e.target.id === 'return_btn') {
		e.preventDefault();
        document.getElementById('home-view').style.display = 'flex';
        document.getElementById('friend-view').style.display = 'none';
        document.getElementById('return_btn').style.display = 'none';
    }	
});

function initFriends() {
    const myId = localStorage.getItem('user-id') || userId;
    document.getElementById('display-my-id').textContent = myId;

    socket.emit('get-my-friends', myId);

    window.copyMyId = () => {
        navigator.clipboard.writeText(myId);
        alert("Code Ami copié !");
    };

    window.sendFriendRequest = () => {
        const targetId = document.getElementById('input-target-id').value.trim().toUpperCase();        
        if (!targetId || targetId.length < 14) {
            alert("ID invalide");
            document.getElementById('input-target-id').value="";
            return;
        }
        const existFriend = document.getElementById(targetId);    
        if (existFriend) {
            alert("Ami déjà dans une des listes");
            document.getElementById('input-target-id').value="";
            //return;
        }
        if (targetId === myId) {
            alert("Vous ne pouvez pas vous ajouter vous-même.");
            document.getElementById('input-target-id').value="";
            return;
        }
        const vaultData = {
            pseudo: myPseudo,
            avatar: myAvatar
        };
        const vaultString = JSON.stringify(vaultData);
        const sharedKey = generateSharedKey(myId, targetId);
        const myEncryptedVault = CryptoJS.AES.encrypt(vaultString, sharedKey).toString();
        socket.emit('friend-request', { 
            idTo: targetId, 
            idFrom: myId,
            vaultFrom: myEncryptedVault
        });
        document.getElementById('input-target-id').value="";
    };

    window.acceptFriend = async (friendId) => {
        const vaultData = {
            pseudo: myPseudo,
            avatar: myAvatar
        };
        const vaultString = JSON.stringify(vaultData);
        const sharedKey = generateSharedKey(myId, friendId);
        const channelId = await generateChannelId(myId, friendId);
        const myEncryptedVault = CryptoJS.AES.encrypt(vaultString, sharedKey).toString();
        socket.emit('friend-accept', {
            idTo: friendId, 
            idFrom: myId,
            vaultFrom: myEncryptedVault,
            channelId: channelId
        });
    };
    
    window.refuseFriend = (friendId) => {
        socket.emit('friend-refuse', { // à developper
            idTo: friendId, 
            idFrom: myId
        });
    };
    
    window.joinChannel = async (channelId, friendId, friendPseudo, friendAvatar) => {
        try {			
				await loadComponentFull(`bridge`);
				await loadComponentJs(`ui`);
				await loadComponentJs(`socket-logic`);
				document.getElementById('friend-view').style.display = 'none';
				document.getElementById('bridge-view').style.display = 'flex';
                
                const friendHeader = document.getElementById('friend-header');                
                const html = `
                    <img src="${friendAvatar}" class="friend-avatar">
                `;
                friendHeader.innerHTML += html;

                currentBridge.channelId = channelId;
                currentBridge.friendId = friendId;
                currentBridge.bridgeKey = generateBridgeKey(myId, currentBridge.friendId, currentBridge.channelId);
                if (!window.listenersInitialized) {
                    setupSocketListeners(); 
                    setupDynamicListeners();
                    window.listenersInitialized = true; // Flag global
                }
//console.log("currentBridge.channelId dans friend.js :", currentBridge.channelId);
                //socket.off('load history');
                socket.emit('join-channel', { pseudo: myPseudo, tz: myTZ, userId: userId, channelId: channelId });
				
			} catch (err) {
				console.error("Erreur de chargement des scripts :", err);
			}
        //socket.emit('joinChannelFriend', { 
        //    channelId: generateSharedKey(myId, friendId)
        //});
    };
}

function generateSharedKey (id1, id2) {
    const sortedIds = [id1, id2].sort().join('-');
    return CryptoJS.SHA256(sortedIds).toString();
};

async function generateChannelId(id1, id2) {
    const sortedIds = [id1, id2].sort().join('XO-XO');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(sortedIds);
    
    //const channelId = CryptoJS.SHA256(sortedIds).toString()
    
    const hashSortedIds = await crypto.subtle.digest('SHA-256', data);
    const channelId = Array.from(new Uint8Array(hashSortedIds));
    // Conversion en hexadécimal, extraction des 15 premiers caractères et mise en majuscules
    return channelId
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 15)
        .toUpperCase();
};

function generateBridgeKey (id1, id2, id3) {
    const sortedIds = [id1, id2, id3].sort().join('-');
    return CryptoJS.SHA256(sortedIds).toString();
};