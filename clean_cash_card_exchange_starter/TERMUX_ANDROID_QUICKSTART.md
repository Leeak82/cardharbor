# Termux Android Quickstart

Use this to run the mobile prototype from Android/Termux.

## Install basics

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts git unzip -y
npm install -g npm
```

## Unzip and run

```bash
cd ~/storage/downloads
unzip clean_cash_card_exchange_mobile_ready.zip
cd clean_cash_card_exchange_starter/apps/mobile
cp .env.example .env
npm install
npm run start
```

Expo will print a QR/link. Open with Expo Go.

## Build APK from Termux using EAS cloud

```bash
cd ~/storage/downloads/clean_cash_card_exchange_starter/apps/mobile
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

When EAS finishes, it gives you a download link for the APK.

## Notes

- Building locally inside Termux is usually painful because Android SDK/Gradle/native toolchains are heavy.
- EAS cloud is the cleanest route.
- If API calls fail from phone, replace localhost with your backend server IP or deployed backend URL.
