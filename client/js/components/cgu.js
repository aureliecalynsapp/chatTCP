// cgu.js

document.getElementById('main-header').addEventListener('click', (event) => {
    var returnWelcome = localStorage.getItem('returnWelcome')
    if (event.target && event.target.id === 'return_btn') {
        if (returnWelcome === 'yes') {
            document.getElementById('welcome-view').style.display = 'flex';
            document.getElementById('cgu_btn_wc').style.display = '';
            localStorage.setItem('returnWelcome', 'no');
        } else {
            document.getElementById('home-view').style.display = 'flex';
        }        
        document.getElementById('cgu-view').style.display = 'none';
        document.getElementById('return_btn').style.display = 'none';
    }
});
