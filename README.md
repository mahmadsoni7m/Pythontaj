# PythonТаҷ 🐍

Барномаи Android барои омӯзиши **Python ба забони тоҷикӣ**: 42 дарс дар 8 модул, машқҳои амалӣ бо иҷрои воқеии Python,
викторинаҳо, холҳо, силсилаи рӯзҳо, дарсҳои бе интернет ва навсозии дарсҳо бе APK-и нав.

| Чӣ | Чӣ тавр кор мекунад |
|---|---|
| Интерфейс | HTML/CSS/JS дар WebView (`index.html`, `css/`, `js/`), забонҳо: тоҷикӣ, русӣ, англисӣ |
| Python | Python 3.11 воқеӣ тавассути [Chaquopy](https://chaquo.com/chaquopy/) (`python/runner.py`) |
| Дарсҳо | `lessons/lesson-NNN.json` + `data/manifest.json` (SHA-256 барои ҳар файл) |
| Паҳнкунии дарсҳо | GitHub Pages (`.github/workflows/pages.yml`) |
| APK | GitHub Actions (`.github/workflows/build-apk.yml`) → Artifacts / Releases |
| Нигоҳдории оффлайн | IndexedDB (дарсҳо, пешрафт, файлҳо); `localStorage` танҳо барои танзимоти хурд |

## Оғоз зуд
1. `GITHUB_SETUP.md` — гузоштани лоиҳа ба GitHub ва гирифтани APK (қадам ба қадам).
2. `BUILD_APK.md` — тафсилоти сохтан ва ҳалли мушкилот.
3. `LESSON_AUTHORING.md` — чӣ тавр дарси нав илова кардан.
4. `TEST_REPORT.md` — чӣ санҷида шуд ва чӣ **санҷида нашуд**.

## Сохтори папкаҳо
```
index.html  css/  js/  assets/        ← барномаи веб (UI)
python/runner.py                      ← иҷрокунандаи Python (бе вобастагӣ ба Android)
lessons/  data/manifest.json          ← мундариҷа (42 дарс)
tools/  scripts/                      ← генератор, санҷишгар, сохтани манифест, нусхабардории assets
android/                              ← лоиҳаи Gradle (Kotlin + Chaquopy)
tests/                                ← санҷишҳои JS ва Python
.github/workflows/                    ← tests, build-apk, pages
```

## Фармонҳои муҳим (дар компютер ё Termux)
```bash
npm test                     # ҳамаи санҷишҳо (Node 20+ ва Python 3.11+)
npm run manifest             # пас аз тағйири lessons/*.json: sha256 ва версияҳоро нав мекунад
npm run build:content        # аз tools/content/*.py дарсҳоро аз нав месозад, ҳар мисолро воқеан иҷро мекунад
```

## Амният (мухтасар)
* Дарсҳои аз интернет боргиришуда **танҳо маълумот** (JSON) ҳастанд: санҷидани сохтор + SHA-256, ҳеҷ гоҳ худкор иҷро намешаванд.
* Матни дарсҳо ҳангоми намоиш `escape` мешавад (танҳо `` `код` `` ба `<code>` табдил мешавад).
* Код танҳо вақте иҷро мешавад, ки корбар худаш «Иҷро» / «Фиристодан»-ро пахш кунад. Маҳдудияти вақт (10 сония), ҳаҷми натиҷа (100 000 рамз), `open()` танҳо дар ҷузвдони корӣ;
  `os.system`, `subprocess` ва монанди инҳо манъ. Ин **муҳофизати кӯшишӣ** аст, на «sandbox»-и пурра.
* Навсозии APK: суроға бояд `https://github.com/<repo>/releases/download/…` бошад, SHA-256 санҷида мешавад, номи бастаю версия санҷида мешавад,
  Android худаш имзоро низ месанҷад.
* CSP дар `index.html` манбаъҳои скриптро ба худи барнома маҳдуд мекунад; WebView ба ҳеҷ сайти беруна намеравад.

Иҷозатнома: MIT.
