# Ping

Ping is a portrait-mode rhythm game for Android. Tap each shrinking ring at the
right moment, build a combo, and beat your high score. The game supports five UI
languages (Simplified Chinese, English, Traditional Chinese, Japanese, and Korean)
and selects one from the device language.

## Build the Android app

Requirements: Node.js 20+, Android SDK 36, and JDK 21. Android Studio is recommended
for installing SDK components and testing on a device.

```powershell
npm install
npm run lint
npm run android:sync
npm run android:open
```

`android:sync` creates the web build and copies it into the native Android project.
In Android Studio, run the `app` configuration to test, or use **Build > Generate
Signed Bundle / APK > Android App Bundle** to create the `.aab` for Play Console.

On Windows, `npm run android:bundle` builds a signed release bundle from the
command line. It stops if signing credentials are not configured. The generated
file is `android\app\build\outputs\bundle\release\app-release.aab`. Create a release
keystore and configure it in
`android\keystore.properties` (copy the ignored `android\keystore.properties.example`
template). For example:

```powershell
keytool -genkeypair -v -keystore android\ping-upload-key.jks -alias ping-upload -keyalg RSA -keysize 2048 -validity 10000
Copy-Item android\keystore.properties.example android\keystore.properties
```

Edit the copied properties file with the passwords you entered. Keep the keystore
and its passwords backed up securely; never commit them.

To build a signed installable APK instead of the Play Store bundle, run
`npm run android:apk`. The generated file is
`android\app\build\outputs\apk\release\app-release.apk`.

The default Android application ID is `com.ping.rhythm`. Choose the final unique ID
before the first Play Console upload; it cannot be changed for an existing listing.

## Gameplay progression

The title screen offers three modes:

- **Duo:** two players share one device in top/bottom lanes. Each lane has its
  own score and combo; a missed target ends the match, and the higher score wins.
- **Zen:** endless play with progressively faster targets. Missing a target ends
  the run.
- **2-minute solo:** the timer pauses with the game. Missing a target removes it
  and resets the combo, but play continues until time runs out.
- In every mode, each score counter celebrates when it crosses 100, 1,000,
  10,000, and each subsequent power-of-ten milestone. Duo players celebrate
  their own score milestones independently.
- Duo places each player's score and a shared-match pause control at the top of
  that player's half of the screen.

- The first 7 successful targets have one ring. A second ring unlocks after 8
  successful targets; a third after 10; and a fourth after 25.
- Once 3 rings are unlocked, 3-ring targets have a 20% spawn chance. Once 4 are
  unlocked, 3-ring and 4-ring targets each have a 20% chance; the remaining chance
  is split evenly between 1-ring and 2-ring targets.
- No more than 3 multi-ring targets can be active at once. Single-ring targets
  do not count toward that limit.
- After 25 successful targets, the first geometry tracing challenge appears the
  next time the target screen is clear; subsequent opportunities use a 1-in-8
  chance. Each challenge has a 12-second time limit.
- Pausing freezes active target and round timers. Resuming continues the current
  targets; only starting or restarting a run resets progress.

## Online services

Google Play Games sign-in, leaderboards, Firebase, and rank-change push
notifications have been removed from this release. Scores and settings remain
on the device. Do not configure Play Games or Firebase for this version, and do
not advertise online leaderboard or rank-alert features.

The privacy policy is included at `public\privacy-policy.html`; Vite copies it
unchanged to `dist\privacy-policy.html` during the web build. To host it on
Render:

1. Push this project to a GitHub repository.
2. In Render, choose **New > Static Site** and connect that repository and the
   branch you want to deploy.
3. Leave **Root Directory** empty. Set **Build Command** to
   `npm ci && npm run build` and **Publish Directory** to `dist`.
4. Create the site and wait for its deploy to finish. The policy URL will be
   `https://<your-render-site-name>.onrender.com/privacy-policy.html`. Open that
   URL in a private browser window to confirm it loads without signing in, then
   paste the exact HTTPS URL into Play Console's privacy-policy field.

Render static sites automatically redeploy when new commits are pushed to the
connected branch. Before publishing, add a real support email to the Play Store
listing; the policy directs users to the support contact shown on that listing.
Complete Play Console Data safety declarations according to the actual behavior
of the final uploaded build.

## Play Console checklist

- Finish signing the release bundle with your own upload key and enroll in Play App
  Signing when prompted.
- Create the Play Console listing, provide original screenshots and store graphics,
  complete the content-rating and Data safety forms, and select countries/pricing.
- Publish the included [privacy policy](./public/privacy-policy.html) at a public HTTPS URL
  and enter that URL in Play Console. Replace the contact instructions with a
  monitored developer support contact before publishing.
- Review the Play Console's current target API and account/testing requirements.
  A successful local build does not submit or publish the app.

## App icon

The original vector source is `assets\icon.svg`. The Play listing icon is
`assets\icon-512.png`; generated Android launcher and splash assets are included in
the native project.

## Local development

```powershell
npm run dev
```
