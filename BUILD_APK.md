# Сохтани APK

## Дар GitHub Actions (тавсия)
Workflow `Build APK`: (1) санҷишҳо → (2) манифест + санҷиши мундариҷа → (3) нусхаи веб ба `android/app/src/main/assets/www`
бо `scripts/sync_assets.py` (суроғаи Pages, repo, версия худкор пур мешаванд) → (4) Gradle 8.9 + JDK 17 + Python 3.11 → (5) APK + SHA-256.

Версия: аз teg (`v1.2.0` → `1.2.0`); `versionCode` = рақами иҷрои workflow (ҳамеша меафзояд).

## Дар компютер (Android Studio)
```bash
python3 scripts/build_manifest.py
python3 scripts/sync_assets.py --dest android/app/src/main/assets/www --remote-base https://ЛОГИН.github.io/PythonTaj/ --repo ЛОГИН/PythonTaj --version 1.0.0
cd android && gradle wrapper --gradle-version 8.9   # як бор (wrapper-jar дар ZIP нест)
./gradlew assembleDebug
```
Python 3.11 бояд дар компютер бошад (Chaquopy ҳангоми сохтан истифода мебарад).

## Версияҳо (кӯшиш нашудаанд дар ин муҳит!)
AGP 8.5.2 · Kotlin 1.9.24 · Chaquopy 16.0.0 · Python 3.11 · compileSdk/targetSdk 34 · minSdk 26 (Android 8.0+).
Агар Gradle хатои мутобиқатӣ диҳад (масалан «Chaquopy … requires AGP …»), версияҳоро дар `android/build.gradle.kts` мувофиқ кунед
(ҷадвали мутобиқат: chaquo.com/chaquopy → Android Gradle plugin versions).

## Мушкилоти эҳтимолӣ
| Нишона | Сабаб / ҳал |
|---|---|
| `Could not find python` / Chaquopy build python | `actions/setup-python` бояд пеш аз Gradle бошад (аллакай ҳаст) |
| `Unsupported class file major version` | JDK 17 лозим аст |
| Барнома кушода мешавад, Python «танҳо дар Android кор мекунад» мегӯяд | `window.AndroidApp` вуҷуд надорад → WebView дуруст бор нашудааст; `adb logcat | grep PythonTaj` |
| «App not installed» ҳангоми навсозӣ | APK-и нав бо калиди дигар имзо шудааст → secrets-ро танзим кунед (`GITHUB_SETUP.md` қ.3.3) |
| Саҳифаи сафед | `android/app/src/main/assets/www/index.html` нест → `sync_assets.py` иҷро нашуд |
