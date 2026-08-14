const session = JSON.parse(sessionStorage.getItem('user_session'));
if (!session || session.role.toLowerCase() !== 'pembina') {
    window.location.href = 'login.html';
}

const loadingScreen = document.getElementById('loadingScreen');
let globalDataAbsensi = []; 
let globalDataAnggota = []; // Menyimpan data anggota
let chartInstance = null;
let modalRekapIndividuObj = null; // Object Modal

function logout() {
    sessionStorage.removeItem('user_session');
    window.location.href = 'index.html';
}

// ==== INISIALISASI HALAMAN ====
window.addEventListener('DOMContentLoaded', async () => {
    loadingScreen.style.display = 'flex';
    
    modalRekapIndividuObj = new bootstrap.Modal(document.getElementById('rekapAnggotaModal'));

    await loadStatistics();
    await fetchSemuaDataAbsen();
    await fetchSemuaAnggota(); // Ambil data anggota
    await fetchAuditLog();
    
    loadingScreen.style.display = 'none';

    // UI Tab Event
    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (event) => {
            document.querySelectorAll('.nav-link').forEach(btn => btn.classList.replace('text-dark', 'text-secondary'));
            event.target.classList.replace('text-secondary', 'text-dark');
        });
    });
});

// ==========================================
// 1. STATISTIK & GRAFIK
// ==========================================
async function loadStatistics() {
    const res = await fetchAPI('getStatistics');
    if (res.success) {
        const t = res.data.total_anggota, h = res.data.hadir, i = res.data.izin, s = res.data.sakit, a = res.data.alpa;
        const totalRecord = h + i + s + a;
        let persentase = totalRecord > 0 ? Math.round((h / totalRecord) * 100) : 0;

        document.getElementById('statTotal').innerText = t;
        document.getElementById('statHadir').innerText = h;
        document.getElementById('statPersentase').innerText = persentase + '%';
        document.getElementById('statAlpa').innerText = a;

        renderChart(h, i, s, a);
    }
}

function renderChart(hadir, izin, sakit, alpa) {
    const ctx = document.getElementById('chartKehadiran').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Hadir', 'Izin', 'Sakit', 'Alpa'],
            datasets: [{
                data: [hadir, izin, sakit, alpa],
                backgroundColor: ['#198754', '#0dcaf0', '#ffc107', '#dc3545'],
                hoverOffset: 10
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ==========================================
// 2. REKAP ABSENSI & VALIDASI
// ==========================================
async function fetchSemuaDataAbsen() {
    const res = await fetchAPI('getAttendance');
    if (res.success) {
        globalDataAbsensi = res.data;
        renderRekap();
        renderValidasi();
    }
}

function renderRekap() {
    const tbody = document.getElementById('tableBodyRekap');
    const kw = document.getElementById('searchRekap').value.toLowerCase();
    const blnThn = document.getElementById('filterBulan').value; 
    
    const filtered = globalDataAbsensi.filter(item => {
        const matchName = item.nama.toLowerCase().includes(kw) || item.id_anggota.toLowerCase().includes(kw);
        const matchBulan = blnThn === "" ? true : item.tanggal.startsWith(blnThn);
        return matchName && matchBulan;
    });
    
    tbody.innerHTML = '';
    if (filtered.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Tidak ada data.</td></tr>`;

    filtered.forEach(item => {
        let sc = item.status === 'Hadir' ? 'success' : (item.status === 'Izin' ? 'info' : (item.status === 'Sakit' ? 'warning' : 'danger'));
        tbody.innerHTML += `
            <tr>
                <td>${item.tanggal}</td><td>${item.id_anggota}</td><td class="text-start fw-bold">${item.nama}</td>
                <td>${item.kelas}</td><td><span class="badge bg-${sc}">${item.status}</span></td>
                <td class="text-start">${item.keterangan || '-'}</td>
            </tr>`;
    });
}

document.getElementById('searchRekap').addEventListener('input', renderRekap);
document.getElementById('filterBulan').addEventListener('change', renderRekap);
document.getElementById('btnResetFilter').addEventListener('click', () => {
    document.getElementById('searchRekap').value = '';
    document.getElementById('filterBulan').value = '';
    renderRekap();
});

function exportExcel() {
    const tabel = document.getElementById('tabelExport');
    const wb = XLSX.utils.table_to_book(tabel, {sheet: "Rekap_Absensi"});
    const namaFile = `Rekap_Absensi_${document.getElementById('filterBulan').value || 'Semua'}.xlsx`;
    XLSX.writeFile(wb, namaFile);
}

// TAB VALIDASI
function renderValidasi() {
    const tbody = document.getElementById('tableBodyValidasi');
    const butuhValidasi = globalDataAbsensi.filter(i => 
        (i.status === 'Izin' || i.status === 'Sakit') && 
        !(i.keterangan && i.keterangan.includes('Valid')) && 
        !(i.keterangan && i.keterangan.includes('Ditolak'))
    );
    
    tbody.innerHTML = '';
    if (butuhValidasi.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="text-success fw-bold">Semua data sudah bersih/divalidasi.</td></tr>`;

    butuhValidasi.forEach(item => {
        let sc = item.status === 'Izin' ? 'info' : 'warning';
        tbody.innerHTML += `
            <tr>
                <td>${item.tanggal}</td>
                <td class="fw-bold">${item.nama}</td><td>${item.kelas}</td>
                <td><span class="badge bg-${sc}">${item.status}</span></td>
                <td>${item.keterangan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-success me-1" onclick="prosesValidasi('${item.id_absensi}', 'Disetujui')">Sah</button>
                    <button class="btn btn-sm btn-danger" onclick="prosesValidasi('${item.id_absensi}', 'Ditolak')">Tolak</button>
                </td>
            </tr>`;
    });
}

async function prosesValidasi(idAbsensi, statusValidasi) {
    if (confirm(`Yakin ingin ${statusValidasi} izin/sakit ini?`)) {
        loadingScreen.style.display = 'flex';
        const res = await fetchAPI('validasiAbsen', { id_absensi: idAbsensi, status_validasi: statusValidasi });
        if (res.success) {
            await fetchSemuaDataAbsen();
            await fetchAuditLog();
        } else { alert("Gagal memvalidasi!"); }
        loadingScreen.style.display = 'none';
    }
}

// ==========================================
// 3. FITUR BARU: DATA ANGGOTA & REKAP INDIVIDU
// ==========================================
async function fetchSemuaAnggota() {
    const res = await fetchAPI('getAllMembers');
    if (res.success) {
        globalDataAnggota = res.data;
        renderTabelAnggota();
    }
}

function renderTabelAnggota() {
    const tbody = document.getElementById('tableBodyAnggota');
    const kw = document.getElementById('searchAnggota').value.toLowerCase();
    const kls = document.getElementById('filterKelasAnggota').value.toLowerCase();
    
    const filtered = globalDataAnggota.filter(i => 
        (i.nama.toLowerCase().includes(kw) || i.id_anggota.toLowerCase().includes(kw) || i.jabatan.toLowerCase().includes(kw)) &&
        (kls === "" || i.kelas.toLowerCase().includes(kls))
    );
    
    tbody.innerHTML = '';
    if (filtered.length === 0) return tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Tidak ada data anggota</td></tr>`;

    filtered.forEach(item => {
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
                    <button class="btn btn-sm btn-dark" onclick="bukaRekapIndividu('${item.id_anggota}', '${item.nama}')">👁️ Lihat Rekap</button>
                </td>
            </tr>`;
    });
}

// Event pencarian anggota
['searchAnggota', 'filterKelasAnggota'].forEach(id => {
    document.getElementById(id).addEventListener(id === 'searchAnggota' ? 'input' : 'change', renderTabelAnggota);
});

// Fungsi memunculkan Modal Rekap per Anggota
function bukaRekapIndividu(idAnggota, namaAnggota) {
    document.getElementById('namaSiswaRekap').innerText = namaAnggota;
    const tbody = document.getElementById('tableBodyRiwayatIndividu');
    
    // Filter riwayat absensi khusus untuk ID ini
    const riwayatSiswa = globalDataAbsensi.filter(item => item.id_anggota === idAnggota);
    
    let h = 0, i = 0, s = 0, a = 0;
    tbody.innerHTML = '';
    
    if (riwayatSiswa.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Belum ada riwayat absensi.</td></tr>`;
    } else {
        riwayatSiswa.forEach(absen => {
            if (absen.status === 'Hadir') h++; else if (absen.status === 'Izin') i++; else if (absen.status === 'Sakit') s++; else a++;
            let sc = absen.status === 'Hadir' ? 'success' : (absen.status === 'Izin' ? 'info' : (absen.status === 'Sakit' ? 'warning' : 'danger'));
            
            // Format jam (membuang 1899-...)
            let jamBersih = absen.jam;
            if (jamBersih && jamBersih.length > 10 && jamBersih.includes('T')) {
                jamBersih = new Date(jamBersih).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            }

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">${absen.tanggal}</td>
                    <td class="text-muted small">${jamBersih}</td>
                    <td><span class="badge bg-${sc}">${absen.status}</span></td>
                    <td class="text-start small">${absen.keterangan || '-'}</td>
                </tr>`;
        });
    }
    
    // Update kotak statistik individu
    document.getElementById('indHadir').innerText = h;
    document.getElementById('indIzin').innerText = i;
    document.getElementById('indSakit').innerText = s;
    document.getElementById('indAlpa').innerText = a;
    
    modalRekapIndividuObj.show();
}

// ==========================================
// 4. FETCH AUDIT LOG
// ==========================================
async function fetchAuditLog() {
    const res = await fetchAPI('getAuditLog');
    const tbody = document.getElementById('tableBodyLog');
    tbody.innerHTML = '';
    
    if (res.success && res.data.length > 0) {
        res.data.forEach(log => {
            tbody.innerHTML += `<tr>
                <td class="text-muted small">${log.waktu}</td>
                <td class="fw-bold">${log.user}</td>
                <td><span class="badge bg-secondary">${log.aksi}</span></td>
                <td>${log.keterangan}</td>
            </tr>`;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Belum ada log aktivitas.</td></tr>`;
    }
}