# Store Metadata

This directory contains metadata for submitting LiveWave to the App Store and Google Play.

## Files

- `ios-metadata.json` — App Store Connect metadata (title, description, keywords, privacy policy URL)
- `android-metadata.json` — Google Play Console metadata (title, short/long description, privacy policy URL)

## Usage with EAS Submit

### iOS
```bash
eas submit --platform ios --metadata store/ios-metadata.json
```

### Android
```bash
eas submit --platform android --metadata store/android-metadata.json
```

## Before Submitting

1. Replace placeholder URLs (`https://livewave.app/privacy`, `https://livewave.app/support`) with real URLs
2. Update `releaseNotes` for each new version
3. Add screenshots to the respective store consoles (App Store Connect, Google Play Console)
4. Update `buildNumber` and `versionCode` in `app.json` before each submission