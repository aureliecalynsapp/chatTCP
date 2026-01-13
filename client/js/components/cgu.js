// cgu.js

document.getElementById('cgu-view').addEventListener('click', (event) => {
    if (event.target && event.target.id === 'bridge-return') {
        document.getElementById('bridge-view').style.display = 'flex';
        document.getElementById('cgu-view').style.display = 'none';
    }
});