# Supabase — Studio Joyo Baru 2

Database online ini dipakai supaya **layanan, harga, transaksi, pesanan, arsip, dan pengaturan** bisa dipakai dari beberapa komputer.

## 1. Buat project Supabase

Buka:
https://supabase.com/dashboard

Buat project baru. Untuk tahap awal pilih paket Free.

## 2. Buat database

Di project Supabase:
1. Buka **SQL Editor**.
2. Buat query baru.
3. Salin seluruh isi file `supabase-schema.sql` dari repository ini.
4. Klik **Run**.

## 3. Buat akun kasir

Buka **Authentication → Users**.
Buat akun email + password untuk aplikasi kasir.

Contoh:
- Email: email kasir milik toko
- Password: buat password yang kuat

Akun yang sama boleh dipakai di komputer kasir lain, atau buat akun terpisah untuk tiap pegawai.

## 4. Ambil URL dan Publishable/Anon Key

Di project Supabase buka **Project Settings → API**.

Yang diperlukan aplikasi browser:
- Project URL
- Publishable key (atau anon key pada project lama)

**Jangan pernah memasukkan service_role key ke aplikasi GitHub Pages.**

## 5. Hubungkan ke aplikasi

Setelah URL dan key tersedia, aplikasi GitHub Pages akan dikonfigurasi menggunakan dua nilai tersebut.

Alur akhirnya:
**Komputer A → Supabase ← Komputer B**

Jadi perubahan harga, layanan, transaksi, status pesanan, dan arsip dapat terlihat di komputer lain setelah sinkronisasi.

## 6. Data lama

Data yang sekarang tersimpan di browser tidak otomatis pindah ke Supabase.

Sebelum migrasi final:
1. Buka aplikasi lama.
2. Masuk **Pengaturan → Backup JSON**.
3. Simpan file backup.
4. Data layanan dan transaksi tersebut kemudian dapat diimpor ke database online.

## Catatan keamanan

RLS pada schema sudah diaktifkan dan tabel hanya dapat diakses oleh pengguna yang sudah login melalui Supabase Auth. Jangan membuat policy `anon` yang membuka seluruh data toko.
