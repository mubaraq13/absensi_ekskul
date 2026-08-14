const session = JSON.parse(sessionStorage.getItem('user_session'));
if (!session || session.role.toLowerCase() !== 'sekretaris') {
    window.location.href = 'login.html';
}

const loadingScreen = document.getElementById('loadingScreen');
let globalDataAbsensi = []; 
let globalDataAnggota = [];
let currentStatusAbsen = 'BUKA'; 

let modalEditObj = null;
let modalAnggotaObj = null;

// Fungsi Helper: Mendapatkan Tanggal Hari Ini (WIB) untuk Filter
function getTodayString() {
    let d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
    let m = '' + (d.getMonth() + 1), day = '' + d.getDate(), y = d.getFullYear();
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return [y, m, day].join('-');
}

// Fungsi Helper: Memperbaiki Format Jam Google Sheets yang Error (1899-...)
function fixTimeFormat(timeStr) {
    if (!timeStr) return '-';
    if (timeStr.length > 10 && timeStr.includes('T')) {
        const d = new Date(timeStr);
        if (!isNaN(d)) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return timeStr;
}

function logout() {
    sessionStorage.removeItem('user_session');
    window.location.href = 'index.html';
}

// ==== INISIALISASI ====
window.addEventListener('DOMContentLoaded', async () => {
    modalEditObj = new bootstrap.Modal(document.getElementById('editModal'));
    modalAnggotaObj = new bootstrap.Modal(document.getElementById('anggotaModal'));
    
    // Set default kalender Rekap ke hari ini
    document.getElementById('filterTanggalRekap').value = getTodayString();

    loadingScreen.style.display = 'flex';
    await loadStatusAbsensi();
    await fetchSemuaDataAbsen();
    await loadTableAnggota();
    loadingScreen.style.display = 'none';

    // UI Tab warna biru
    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (event) => {
            document.querySelectorAll('.nav-link').forEach(btn => btn.classList.replace('text-primary', 'text-secondary'));
            event.target.classList.replace('text-secondary', 'text-primary');
        });
    });
});

// ==========================================
// 1. KONTROL BUKA/TUTUP ABSEN (WAKTU WIB)
// ==========================================
const switchAbsen = document.getElementById('switchAbsen');
const teksStatusAbsen = document.getElementById('teksStatusAbsen');
const inputWaktuTutup = document.getElementById('waktuTutupAbsen');
const teksSisaWaktu = document.getElementById('teksSisaWaktu');

async function loadStatusAbsensi() {
    const res = await fetchAPI('checkStatus');
    if (res.success) updateUIStatus(res.data);
}

function updateUIStatus(data) {
    switchAbsen.disabled = false;
    currentStatusAbsen = data.status;
    
    if (data.status === 'BUKA') {
        switchAbsen.checked = true;
        inputWaktuTutup.disabled = true; // Kunci input jam saat sedang jalan
        teksStatusAbsen.innerHTML = '<span class="text-success fw-bold">🟢 TERBUKA</span>';
        
        if (data.waktuTutup) {
            inputWaktuTutup.value = data.waktuTutup; 
            teksSisaWaktu.classList.remove('d-none');
            teksSisaWaktu.innerHTML = `⏳ Akan ditutup otomatis pada <b>${data.waktuTutup} WIB</b>`;
        } else {
            inputWaktuTutup.value = "";
            teksSisaWaktu.classList.add('d-none'); 
        }
    } else {
        switchAbsen.checked = false;
        inputWaktuTutup.disabled = false; // Buka kunci input jam 
        teksStatusAbsen.innerHTML = '<span class="text-danger fw-bold">🔴 DITUTUP</span>';
        teksSisaWaktu.classList.add('d-none');
    }
    renderLiveAbsensi(); // Tampilkan/Sembunyikan tabel Live
}

switchAbsen.addEventListener('change', async () => {
    switchAbsen.disabled = true;
    teksStatusAbsen.innerText = "Memproses...";
    
    const payload = {};
    if (switchAbsen.checked) {
        const jamDitentukan = inputWaktuTutup.value;
        if (jamDitentukan) {
            payload.waktuTutup = jamDitentukan;
        }
    }

    const res = await fetchAPI('toggleAttendance', payload);
    
    if (res.success) {
        updateUIStatus(res.data);
    } else {
        alert(res.message || "Gagal merubah status!");
        switchAbsen.checked = !switchAbsen.checked; 
        switchAbsen.disabled = false;
    }
});

// ==========================================
// 2. FETCH & RENDER DATA ABSENSI
// ==========================================
async function fetchSemuaDataAbsen() {
    const res = await fetchAPI('getAttendance');
    if (res.success) {
        globalDataAbsensi = res.data;
        renderLiveAbsensi();
        renderRekapAbsensi();
    }
}

// RENDER TAB 1: LIVE (HILANG JIKA DITUTUP)
function renderLiveAbsensi() {
    const containerLive = document.getElementById('containerLiveAbsen');
    const alertTutup = document.getElementById('alertTutupSesi');
    const tbody = document.getElementById('tableBodyLive');
    
    // Jika ditutup, sembunyikan tabel dan tampilkan Alert
    if (currentStatusAbsen === 'TUTUP') {
        containerLive.classList.add('d-none');
        alertTutup.classList.remove('d-none');
        return;
    }

    // Jika BUKA, tampilkan khusus hari ini
    containerLive.classList.remove('d-none');
    alertTutup.classList.add('d-none');
    
    const today = getTodayString();
    const dataHariIni = globalDataAbsensi.filter(i => i.tanggal === today);
    
    let h = 0, i = 0, s = 0, a = 0;
    tbody.innerHTML = '';
    
    if (dataHariIni.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Belum ada absen masuk hari ini</td></tr>`;
    } else {
        dataHariIni.forEach(item => {
            if (item.status === 'Hadir') h++; else if (item.status === 'Izin') i++; else if (item.status === 'Sakit') s++; else a++;
            let sc = item.status === 'Hadir' ? 'success' : (item.status === 'Izin' ? 'info' : (item.status === 'Sakit' ? 'warning' : 'danger'));
            let jamBersih = fixTimeFormat(item.jam);
            tbody.innerHTML += `<tr>
                <td class="fw-bold text-primary">${jamBersih}</td>
                <td>${item.id_anggota}</td><td class="fw-bold text-start">${item.nama}</td><td>${item.kelas}</td>
                <td><span class="badge bg-${sc}">${item.status}</span></td><td>${item.keterangan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-warning mb-1" onclick="bukaModalEditAbsensi('${item.id_absensi}')">Edit</button>
                    <button class="btn btn-sm btn-danger mb-1" onclick="hapusAbsensi('${item.id_absensi}')">Hapus</button>
                </td>
            </tr>`;
        });
    }
    
    document.getElementById('statLiveHadir').innerText = h;
    document.getElementById('statLiveIzin').innerText = i;
    document.getElementById('statLiveSakit').innerText = s;
    document.getElementById('statLiveAlpa').innerText = a;
}

// RENDER TAB 2: REKAP (TAMPIL SEMUA SESUAI FILTER)
function renderRekapAbsensi() {
    const tbody = document.getElementById('tableBodyRekap');
    const kw = document.getElementById('searchRekap').value.toLowerCase();
    const tgl = document.getElementById('filterTanggalRekap').value;
    const stat = document.getElementById('filterStatusRekap').value;
    const kls = document.getElementById('filterKelasRekap').value.toLowerCase();
    
    const filtered = globalDataAbsensi.filter(item => 
        (item.nama.toLowerCase().includes(kw) || item.id_anggota.toLowerCase().includes(kw)) &&
        (tgl === "" || item.tanggal === tgl) &&
        (stat === "" || item.status === stat) &&
        (kls === "" || item.kelas.toLowerCase().includes(kls))
    );
    
    let h = 0, iz = 0, s = 0, a = 0;
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Tidak ada data rekap pada tanggal/filter ini</td></tr>`;
    } else {
        filtered.forEach(item => {
            if (item.status === 'Hadir') h++; else if (item.status === 'Izin') iz++; else if (item.status === 'Sakit') s++; else a++;
            let sc = item.status === 'Hadir' ? 'success' : (item.status === 'Izin' ? 'info' : (item.status === 'Sakit' ? 'warning' : 'danger'));
            let jamBersih = fixTimeFormat(item.jam);
            tbody.innerHTML += `<tr>
                <td><span class="fw-bold">${item.tanggal}</span><br><small class="text-muted">${jamBersih}</small></td>
                <td>${item.id_anggota}</td><td class="fw-bold text-start">${item.nama}</td><td>${item.kelas}</td>
                <td><span class="badge bg-${sc}">${item.status}</span></td><td>${item.keterangan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-warning mb-1" onclick="bukaModalEditAbsensi('${item.id_absensi}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger mb-1" onclick="hapusAbsensi('${item.id_absensi}')">Hapus</button>
                </td>
            </tr>`;
        });
    }
    
    document.getElementById('statRekapHadir').innerText = h;
    document.getElementById('statRekapIzin').innerText = iz;
    document.getElementById('statRekapSakit').innerText = s;
    document.getElementById('statRekapAlpa').innerText = a;
}

// EVENT LISTENER UNTUK FILTER REKAP
['searchRekap', 'filterTanggalRekap', 'filterStatusRekap', 'filterKelasRekap'].forEach(id => {
    document.getElementById(id).addEventListener(id === 'searchRekap' ? 'input' : 'change', renderRekapAbsensi);
});

// FUNGSI EDIT & HAPUS ABSEN
function bukaModalEditAbsensi(id) {
    const data = globalDataAbsensi.find(i => i.id_absensi === id);
    if(data) {
        document.getElementById('editIdAbsensi').value = data.id_absensi;
        document.getElementById('editNama').value = data.nama;
        document.getElementById('editStatus').value = data.status;
        document.getElementById('editKeterangan').value = data.keterangan || '';
        modalEditObj.show();
    }
}

document.getElementById('formEdit').addEventListener('submit', async (e) => {
    e.preventDefault();
    modalEditObj.hide();
    loadingScreen.style.display = 'flex';
    await fetchAPI('updateAttendance', {
        id_absensi: document.getElementById('editIdAbsensi').value,
        status: document.getElementById('editStatus').value,
        keterangan: document.getElementById('editKeterangan').value
    });
    await fetchSemuaDataAbsen(); 
    loadingScreen.style.display = 'none';
});

async function hapusAbsensi(id) {
    if (confirm('Hapus absensi ini?')) {
        loadingScreen.style.display = 'flex';
        await fetchAPI('deleteAttendance', { id_absensi: id });
        await fetchSemuaDataAbsen();
        loadingScreen.style.display = 'none';
    }
}

// ==========================================
// 3. BLOK FITUR KELOLA ANGGOTA
// ==========================================
async function loadTableAnggota() {
    const res = await fetchAPI('getAllMembers');
    if (res.success) {
        globalDataAnggota = res.data;
        renderTabelAnggota(globalDataAnggota);
    }
}

function renderTabelAnggota(data) {
    const tbody = document.getElementById('tableBodyAnggota');
    tbody.innerHTML = '';
    if (data.length === 0) return tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Tidak ada data anggota</td></tr>`;

    data.forEach(item => {
        let badgeColor = item.status === 'Aktif' ? 'success' : 'secondary';
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${item.id_anggota}</td>
                <td class="text-start fw-bold">${item.nama}</td>
                <td>${item.kelas}</td>
                <td>${item.jurusan}</td>
                <td>${item.jabatan}</td>
                <td><span class="badge bg-${badgeColor}">${item.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary mb-1" onclick="bukaModalAnggota('edit', '${item.id_anggota}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger mb-1" onclick="hapusAnggota('${item.id_anggota}')">Hapus</button>
                </td>
            </tr>`;
    });
}

function bukaModalAnggota(mode, id = null) {
    document.getElementById('formAnggotaMode').value = mode;
    document.getElementById('formAnggota').reset();
    
    const header = document.getElementById('anggotaModalHeader');
    const title = document.getElementById('anggotaModalTitle');

    if (mode === 'tambah') {
        header.className = 'modal-header bg-primary text-white';
        title.innerText = 'Tambah Anggota Baru';
        document.getElementById('anggotaId').value = '';
    } else {
        header.className = 'modal-header bg-warning text-dark';
        title.innerText = 'Edit Data Anggota';
        
        const data = globalDataAnggota.find(i => i.id_anggota === id);
        if (data) {
            document.getElementById('anggotaId').value = data.id_anggota;
            document.getElementById('anggotaNama').value = data.nama;
            document.getElementById('anggotaKelas').value = data.kelas;
            document.getElementById('anggotaJurusan').value = data.jurusan === '-' ? '' : data.jurusan;
            document.getElementById('anggotaJabatan').value = data.jabatan === '-' ? '' : data.jabatan;
            document.getElementById('anggotaStatus').value = data.status;
        }
    }
    modalAnggotaObj.show();
}

document.getElementById('formAnggota').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = document.getElementById('formAnggotaMode').value;
    const payload = {
        nama: document.getElementById('anggotaNama').value,
        kelas: document.getElementById('anggotaKelas').value,
        jurusan: document.getElementById('anggotaJurusan').value,
        jabatan: document.getElementById('anggotaJabatan').value,
        status: document.getElementById('anggotaStatus').value
    };

    let action = 'addMember';
    if (mode === 'edit') {
        action = 'updateMember';
        payload.id_anggota = document.getElementById('anggotaId').value;
    }

    modalAnggotaObj.hide();
    loadingScreen.style.display = 'flex';
    const res = await fetchAPI(action, payload);
    if (res.success) {
        await loadTableAnggota();
    } else {
        alert("Gagal menyimpan data: " + res.message);
    }
    loadingScreen.style.display = 'none';
});

async function hapusAnggota(id) {
    if (confirm('Menghapus anggota akan menghapus datanya dari sistem. Lanjutkan?')) {
        loadingScreen.style.display = 'flex';
        await fetchAPI('deleteMember', { id_anggota: id });
        await loadTableAnggota();
        loadingScreen.style.display = 'none';
    }
}

['searchAnggota', 'filterKelasAnggota'].forEach(id => {
    document.getElementById(id).addEventListener(id === 'searchAnggota' ? 'input' : 'change', () => {
        const kw = document.getElementById('searchAnggota').value.toLowerCase();
        const kls = document.getElementById('filterKelasAnggota').value.toLowerCase();
        
        const filtered = globalDataAnggota.filter(i => 
            (i.nama.toLowerCase().includes(kw) || i.id_anggota.toLowerCase().includes(kw) || i.jabatan.toLowerCase().includes(kw)) &&
            (kls === "" || i.kelas.toLowerCase().includes(kls))
        );
        renderTabelAnggota(filtered);
    });
});