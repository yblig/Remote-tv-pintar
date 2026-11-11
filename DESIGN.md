# Remote TV Pintar — DESIGN

**Konsep:** Remote TV di HP yang benar-benar mengontrol TV, plus keyboard untuk mengetik
langsung ke TV. Aplikasi WAJIB terhubung ke TV dulu (pindai Wi-Fi / pairing / pilih merek IR)
sebelum layar remote terbuka.

**Interpretasi brief:** "mengontrol remote" = remote penuh (arah, OK, volume, channel, power,
angka, media, warna). "Keyboard untuk di TV" = ketik di HP → teks masuk ke kolom yang aktif di
TV (pencarian YouTube, login, dll). 30 fitur tambahan dipilih untuk penggunaan sehari-hari di
Indonesia (Android TV/Google TV paling umum: Xiaomi, TCL, Sharp, Coocaa, Sony; plus Samsung,
LG, Roku, dan TV biasa via IR di HP Xiaomi/Redmi/POCO). Tanpa musik latar — ini aplikasi alat,
musik akan mengganggu; semua interaksi tetap ada efek suara + getar.

## Cara terhubung (protokol)
| Jenis TV | Protokol | Pairing | Keyboard |
|---|---|---|---|
| Android TV / Google TV | Android TV Remote v2 (TLS 6466/6467, protobuf) | kode 6 digit di layar TV | IME batch edit |
| Samsung Tizen | WebSocket wss :8002 (fallback ws :8001) | "Izinkan" di TV, token disimpan | SendInputString |
| LG webOS | SSAP WebSocket ws :3000 / wss :3001 | prompt di TV, client-key disimpan | ime/insertText, mouse pointer asli |
| Roku / TCL Roku | ECP HTTP :8060 | cek device-info | Lit_<huruf> |
| TV biasa | Infra merah (ConsumerIrManager) | wizard: tes tombol Power per merek | – |

Native (Java, `TvBridgePlugin`): ATV TLS+protobuf+sertifikat self-signed buatan sendiri (DER),
WebSocket (OkHttp, trust-all untuk sertifikat TV), HTTP, pemindaian mDNS (NsdManager
`_androidtvremote2._tcp`) + SSDP, IR transmit, Wake-on-LAN, input suara (RecognizerIntent),
tombol volume HP. Logika Samsung/LG/Roku/IR ada di JS (`src/protocols`).

## 30 fitur
Koneksi: 1 Pindai TV otomatis di Wi-Fi · 2 Pairing Android/Google TV kode 6 digit · 3 Samsung
Smart TV · 4 LG webOS · 5 Roku TV · 6 Mode IR untuk TV biasa (Samsung, LG, Sony, Panasonic,
Sharp, Toshiba, Philips) · 7 Pencari merek IR otomatis · 8 Simpan banyak TV & ganti cepat ·
9 Sambung ulang otomatis ke TV terakhir · 10 Wake-on-LAN (nyalakan via Wi-Fi)
Remote: 11 D-pad + OK · 12 Touchpad geser (LG: kursor mouse asli) · 13 Volume/mute/channel ·
14 Tahan tombol = ulang cepat · 15 Numpad + tombol warna + Input/Info/Guide · 16 Kontrol media ·
17 Tombol volume HP mengatur volume TV · 18 Kocok HP untuk mute
Keyboard: 19 Ketik langsung ke TV · 20 Ketik pakai suara · 21 Tempel dari clipboard ·
22 Teks favorit (frasa cepat) · 23 Riwayat ketikan
Konten: 24 Peluncur aplikasi (YouTube, Netflix, Vidio, Disney+, Prime Video, Spotify) ·
25 Cari YouTube langsung di TV · 26 Kirim link ke TV
Otomasi: 27 Makro (urutan tombol) · 28 Timer tidur (TV mati otomatis) · 29 Channel favorit
Gaya: 30 Tema gelap/terang + 6 warna aksen
Tambahan (permintaan user): 31 Lihat layar TV dari HP (ADB :5555 screencap di Android TV, ssap executeOneShot di LG) · 32 Bagikan layar HP ke TV (buka Cast/Smart View sistem)
(+ pengaturan suara/getar, tutorial pertama kali.)

## Layar
Onboarding (3 slide, sekali) → **Hubungkan TV** (gerbang: daftar TV tersimpan, hasil pindai,
tambah manual, IR) → sheet pairing per protokol → **Utama** dengan tab bar:
Remote · Keyboard · Aplikasi · Layar · Lainnya (Makro, Timer tidur, Channel favorit, Wake-on-LAN,
Pengaturan, Ganti TV). Header: nama TV + titik status + tombol Power.
Back Android: tutup sheet → tab Remote → keluar (tekan 2x).

## Gaya visual
"Midnight Glass": bg #0b0e17, surface #151a28, surface2 #1d2336, garis #2a3147,
primary #6c7bff (aksen bisa diganti: #6c7bff, #3dd6c6, #ff7a59, #f5b83d, #ff5fa2, #8bd450),
danger #ff5c6c, success #3ddc97, teks #eef1fb / #9aa3bd. Tema terang: bg #f3f5fb, surface #fff.
Font Plus Jakarta Sans. D-pad bulat besar dengan gradien radial, tombol berdepth (bayangan +
highlight atas), tekan = skala 0.94 + glow aksen. Animasi: slide antar tab, pulse radar saat
pindai, gelombang saat menunggu izin TV.

## Suara (sfx.json)
tap (tombol remote), select (tab), confirm (terhubung), whoosh (sheet), back, error,
type (ketik), notify (pairing diminta), toggle. Getar: tap di setiap tombol, success saat
terhubung, error saat gagal.

## Disimpan
TV tersimpan (jenis, host, nama, token/kunci, MAC, merek IR), TV terakhir, sertifikat klien ATV
(native SharedPreferences), teks favorit, riwayat ketik, makro, channel favorit, tema/aksen,
suara/getar/kocok/tombol volume.


## Update: Fitur Jahil (prank, Android TV)
33 Kirim gambar kejutan ke TV (preload ADB push ke /data/local/tmp + am start VIEW, beberapa fallback) · 34 Preview layar TV di atas remote (screenview singleton bersama) · 35 Ngomong lewat TV: rekam suara (capacitor-voice-recorder → push → am VIEW audio) + teks jadi suara (TTS HP synthesizeToFile → push → play). Native baru: adbShell, adbPush (base64 chunked ≤ maxData), ttsToFile. Jujur: dengar mic TV tidak didukung tanpa root; tampil gambar/audio bergantung pemutar di TV (semua error ditampilkan + bisa disalin).
