const formLogin = document.getElementById('formLogin');
const alertBox = document.getElementById('alertBox');
const loadingScreen = document.getElementById('loadingScreen');

// Redirect jika user sudah pernah login sebelumnya (punya sesi)
window.addEventListener('DOMContentLoaded', () => {
    const activeUser = JSON.parse(sessionStorage.getItem('user_session'));
    if (activeUser) {
        if (activeUser.role === 'sekretaris') window.location.href = 'sekretaris.html';
        if (activeUser.role === 'pembina') window.location.href = 'pembina.html';
    }
});

function showAlert(message) {
    alertBox.className = `alert alert-danger d-block`;
    alertBox.innerText = message;
    setTimeout(() => alertBox.classList.add('d-none'), 4000);
}

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;

    loadingScreen.style.display = 'flex';
    
    // Memanggil API dengan action 'login'
    const res = await fetchAPI('login', {
        username: user,
        password: pass
    });
    
    loadingScreen.style.display = 'none';

    if (res.success) {
        // Simpan sesi login ke memori browser (sementara)
        sessionStorage.setItem('user_session', JSON.stringify(res.data));
        
        // Arahkan (Redirect) sesuai jabatannya
        if (res.data.role.toLowerCase() === 'sekretaris') {
            window.location.href = 'sekretaris.html';
        } else if (res.data.role.toLowerCase() === 'pembina') {
            window.location.href = 'pembina.html';
        } else {
            showAlert('Role tidak dikenali oleh sistem.');
        }
    } else {
        showAlert(res.message);
    }
});