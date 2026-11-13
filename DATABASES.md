# Databases

| Database | Firebase project | Stores |
|---|---|---|
| **main**   | sakindutopup (the original one) | all TEXT data, exactly as before: users, wallets, orders, wallet requests, games, store settings, reviews, redeem codes, Shell users & Shell pins, banner/account text + links |
| **images** | sakindustore-f9526 (new)        | every IMAGE: payment proofs (receipts), game & package images, ad banners, event banners, upcoming-event image, account-store photos, profile pictures |

The config for the images database is in `firebase-init.js` (`EXTRA_FIREBASE_CONFIGS.images`).
In the main database an image is replaced by a short reference (`img:...`); the picture itself is stored once in
the images database. Old records that still hold an embedded picture keep working.

## Do this once after uploading
1. Firebase console -> project **sakindustore-f9526** -> **Build -> Firestore Database -> Create database**
   (if you have not yet) and set its **Rules** like your main project's rules.
2. Open the admin panel -> **🗄 Databases** tab -> **Move old images now**. It moves the pictures that are already in
   the main database (old receipts, game/package images, banners, event image, account photos, avatars) into the
   images database. Safe to run again.

New uploads go to the images database automatically.
`images.js` (the built-in default game icons) is part of the website files, not a database.
