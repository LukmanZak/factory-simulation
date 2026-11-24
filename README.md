# Intralogistics Digital Twin — Pabrik (versi dipoles)

Digital twin gudang dan lini produksi, dipoles dari prototipe awal (`ai_studio_code.html`, tidak disertakan di repo ini) supaya terasa seperti pabrik dan gudang sungguhan.
three.js r128, skrip klasik (bukan module), tanpa build.

## Cara membuka
- Klik ganda `index.html` (butuh internet: three.js dari CDN dan aset Poly Haven), atau sajikan folder ini:
  `python -m http.server 8802 --bind 127.0.0.1` dari dalam folder ini, lalu buka `http://localhost:8802/`.
- `?offline=1` menguji cadangan: semua aset nyata dianggap gagal dan adegan memakai material prosedural.
- `H` menyembunyikan panel. Panel kiri/kanan bisa dilipat dengan tombol `–`.

## Yang berubah dari versi asli
- **Bangunan**: lantai epoxy dengan marka cat (satu kanvas, bukan bidang menyala), dinding kulit bergelombang + plinth beton + jendela clerestory, atap bergable, rangka baja, skylight, lampu LED high-bay, duct, pipa sprinkler, cable tray, hoist monorail, dock dengan rolling door/seal/bumper/leveler, halaman aspal dengan marka, pagar, kontainer, gardu jaga.
- **Cahaya**: tone mapping ACES, koreksi warna sRGB, HDRI interior (refleksi), HDRI langit, matahari dengan bayangan.
- **Kendaraan**: forklift counterbalance (overhead guard, mast bertingkat, garpu, ban bertapak), AMR dengan dek roller, truk + trailer.
- **Manusia** (`js/people.js`): proporsi tubuh nyata (±1,7 m, variasi tinggi dan warna kulit), wajah bertekstur (mata, alis, hidung, bibir, rambut, kacamata K3), helm K3 mengilap dengan ridge dan brim, rompi hi-vis terbuka di depan dengan strip reflektif, ikat pinggang, saku radio dan tanda pengenal, sarung tangan, sepatu bot bersol. Gerak: siklus jalan dengan putaran pinggul, tumit mendarat dan jinjit, ayunan lengan; berdiri bernapas dan menoleh; operator forklift duduk memegang setir; pekerja stasiun membawa tablet atau clipboard. Kecepatan jalan operator nyata (2,2 m/s, Shift = lari).
- **Elemen pabrik baru**: CNC berpintu geser + HMI + tower light, robot 6-sumbu dalam pagar pengaman, gerbang QC dengan laser, konveyor sabuk bergulir, papan andon, area packing + stretch wrapper berputar, pojok maintenance, APAR, panel listrik, cermin cembung, papan keselamatan, charger CHG-BAY, ruang kontrol prefab.
- **Perilaku**: kendaraan berbelok dengan jari-jari (tidak berputar di tempat), garpu rendah saat jalan, siklus ganda put-away + retrieval pada rak sungguhan (slot terisi/kosong sesuai angka panel), AMR berbasis misi dengan area parkir, depalet di kepala konveyor, barang berhenti di CNC/robot/QC, prioritas lalu lintas (forklift didahulukan) agar tidak buntu.
- **Tampilan awal bersih**: waypoint dan panah aliran mati (nyalakan dari panel), label zona diperkecil.
- Parameter yang diubah dari asli: kecepatan memakai m/s nyata (lane 10 km/h, aisle 5 km/h), truk masuk/keluar 1 palet per 60 detik (asli 16 detik), ambang charging 35% dan laju pengisian lebih lambat.

## Aset nyata (Poly Haven, CC0), dimuat saat berjalan, ±21 MB sekali unduh lalu ter-cache
HDRI `empty_warehouse_01`, `industrial_sunset_puresky`; tekstur 1k `concrete_floor_worn_001`, `corrugated_iron`, `asphalt_04`, `wood_planks`; model 1k `korean_fire_extinguisher_01`, `power_box_01`, `Barrel_01`, `cardboard_box_01`, `portable_welding_cart`, `industrial_storage_cart`.
Forklift, AMR, truk, robot, CNC, konveyor, pekerja, rak, palet dibuat dari kode (tidak ada modelnya di Poly Haven). Model manusia nyata yang gratis dan bisa dimuat langsung (three.js `Soldier`, `Michelle`; Khronos `CesiumMan`) sudah dicoba dan tidak cocok sebagai pekerja pabrik (tentara fiksi ilmiah, bergaya kartun, datar), jadi pekerja tetap dibuat dari kode. Bila kamu punya model GLB berskeleton (Mixamo, Ready Player Me, Sketchfab), bisa dipasang menggantikannya. `js/manifest.js` memuat peta URL model (dibuat dari `api.polyhaven.com/files/<id>`).

## Berkas
`index.html` (HUD) · `js/core.js` (renderer, cahaya, material, pemuat aset) · `hall.js` (bangunan, marka, halaman) · `zones.js` (rak, palet, staging, kantor, keselamatan) · `actors.js` (forklift, AMR, truk, pekerja) · `line.js` (lini produksi) · `sim.js` (logika simulasi, KPI, HUD) · `people.js` (pekerja) · `ui.js` (kamera, input, label, loop).

## Batas
Semi-realistis yang bersih, bukan foto. Kecepatan frame belum diukur pada GPU nyata (uji dilakukan di panel perender perangkat lunak). Matahari tetap menerangi interior melalui atap (atap tidak melempar bayangan, anggap skylight).
