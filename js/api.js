// GANTI DENGAN URL DARI GOOGLE APPS SCRIPT ANDA
const API_URL = 'https://script.google.com/macros/s/AKfycbyWwYuf1lIbDMKTDQz1XIdwh8dwfnh0YYJ95AZfSNVGT2vXWDVcPZs7ZSHsAFExg0ISBg/exec';

async function fetchAPI(action, dataObj = {}) {
    try {
        dataObj.action = action;
        
        // Kita menggunakan FormData agar GAS mudah membacanya melalui e.parameter
        const formData = new URLSearchParams();
        for (const key in dataObj) {
            formData.append(key, dataObj[key]);
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error connecting to API:", error);
        return { success: false, message: "Gagal terhubung ke server. Periksa koneksi internet." };
    }
}