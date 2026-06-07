# CardHarbor Mobile Build Guide

This app is set up with Expo React Native so you can test it on a real Android phone and build an APK.

## 1. Test on your phone with Expo Go

Install Expo Go from Google Play.

From the repo root:

```bash
cd apps/mobile
cp .env.example .env
npm install
npm run start
```

Scan the QR code with Expo Go.

If your phone cannot connect, use the tunnel command already configured:

```bash
npx expo start --tunnel
```

## 2. Point the mobile app at your backend

If your backend runs on a computer on the same Wi-Fi, use your computer LAN IP:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:8080
```

Do not use `localhost` from the phone unless the backend is running on the phone itself.

## 3. Build an installable Android APK

Install EAS CLI:

```bash
npm install -g eas-cli
```

Login:

```bash
eas login
```

Configure once:

```bash
eas build:configure
```

Build APK:

```bash
eas build -p android --profile preview
```

## 4. Build Play Store AAB

```bash
eas build -p android --profile production
```

## 5. Important production notes

Before real use:
- Replace mock API logic with live backend calls.
- Use KYC provider hosted flow.
- Use payment partner sandbox.
- Use tokenized card partner flow.
- Do not store raw card secrets.
- Add production privacy policy and terms URLs in app config.
- Add app icons and splash screens.
- Run security and compliance review.
