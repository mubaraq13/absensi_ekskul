// Element references
const btnCari = document.getElementById('btnCari');
const inputId = document.getElementById('idAnggota');
const formFields = document.getElementById('formFields');
const formAbsensi = document.getElementById('formAbsensi');
const alertBox = document.getElementById('alertBox');
const loadingScreen = document.getElementById('loadingScreen');
const successPanel = document.getElementById('successPanel');

// Utility untuk memunculkan pesan (toast/alert)
function showAlert(message, isSuccess = false) {
    alertBox.className = `alert ${isSuccess ? 'alert-success' : 'alert-danger'} d-block`;
    alertBox.innerText = message;
    // Hilangkan otomatis setelah 5 detik jika error
    if (!isSuccess) setTimeout(() => alertBox.classList.add('d-none'), 5000);
}

function showLoading(show) {
    loadingScreen.style.display = show ? 'flex' : 'none';
}

// 1. Fitur Cari Anggota
btnCari.addEventListener('click', async () => {
    // UPDATE UX: Paksa input menjadi huruf besar (Uppercase) dan hilangkan spasi
    const id = inputId.value.trim().toUpperCase(); 
    
    // Perbarui teks di kotak form agar siswa melihat perubahannya
    inputId.value = id;

    if (!id) return showAlert('Masukkan ID Anggota terlebih dahulu!');

    showLoading(true);
    const res = await fetchAPI('getMember', { id_anggota: id });
    showLoading(false);

    if (res.success) {
        // Buka gembok form jika ID valid
        formFields.disabled = false;
        document.getElementById('namaSiswa').value = res.data.nama;
        document.getElementById('kelasSiswa').value = res.data.kelas;
        
        inputId.readOnly = true; // Lock ID agar tidak diganti saat submit
        btnCari.disabled = true;
        
        alertBox.classList.add('d-none'); // Bersihkan error sebelumnya
    } else {
        showAlert(res.message);
        formFields.disabled = true;
    }
});

// 2. Fitur Submit Absensi
formAbsensi.addEventListener('submit', async (e) => {
    e.preventDefault(); // Mencegah reload halaman
    
    // UPDATE UX: Gunakan huruf besar juga saat submit sebagai perlindungan ganda
    const id = inputId.value.trim().toUpperCase();
    const status = document.getElementById('statusKehadiran').value;
    const keterangan = document.getElementById('keterangan').value.trim();

    showLoading(true);
    const res = await fetchAPI('submitAttendance', {
        id_anggota: id,
        status: status,
        keterangan: keterangan
    });
    showLoading(false);

    if (res.success) {
        // Sembunyikan form, tampilkan UI Sukses
        formAbsensi.classList.add('d-none');
        successPanel.classList.remove('d-none');
        alertBox.classList.add('d-none');
        
        // Isi data konfirmasi
        document.getElementById('resNama').innerText = res.data.nama;
        document.getElementById('resTanggal').innerText = res.data.tanggal;
        document.getElementById('resJam').innerText = res.data.jam;
        document.getElementById('resStatus').innerText = res.data.status;
    } else {
        showAlert(res.message); // Akan error jika double absen!
    }
});

// ==========================================
// CEK STATUS BUKA/TUTUP SAAT HALAMAN DIMUAT
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    const res = await fetchAPI('checkStatus');
    showLoading(false);

    if (res.success && res.data.status === 'TUTUP') {
        // Matikan fungsi pencarian dan beri peringatan
        inputId.disabled = true;
        btnCari.disabled = true;
        inputId.placeholder = "ABSENSI SEDANG DITUTUP";
        showAlert("MAAF, FORM ABSENSI SAAT INI SEDANG DITUTUP OLEH PENGURUS.", false);
    }
});