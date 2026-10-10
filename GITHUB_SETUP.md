# Гузоштани PythonТаҷ ба GitHub ва гирифтани APK

Ҳама чиз ройгон аст. Лоиҳаро **public** (кушода) созед — GitHub Pages барои репозиторияи пӯшида пулӣ аст.

## 1. Репозитория созед
github.com → **New repository** → ном: `PythonTaj` → Public → Create (бе README).

## 2. Лоиҳаро фиристед (Termux)
```bash
termux-setup-storage
pkg update -y && pkg install -y git unzip
cd ~/storage/downloads
unzip PythonTaj.zip -d PythonTaj && cd PythonTaj
git init -b main
git config user.name  "НОМИ_ШУМО"
git config user.email "EMAIL_ШУМО"
git add -A
git commit -m "PythonTaj 1.0"
git remote add origin https://github.com/ЛОГИНИ_ШУМО/PythonTaj.git
git push -u origin main
```
Ҳангоми push GitHub **логин** ва **токен** мепурсад (парол не):
GitHub → Settings → Developer settings → Personal access tokens → *Tokens (classic)* → Generate →
иҷозатҳо: **repo** ва **workflow** (workflow ҳатмист, вагарна `.github/workflows` қабул намешавад).

> Папкаи `.github` пинҳон аст, вале дар ZIP ҳаст. Санҷед: `ls -a` (бояд `.github` намоиш диҳад).

## 3. Танзимоти репозитория (як бор)
1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Actions → General → Workflow permissions → Read and write permissions → Save.**
3. **Settings → Secrets and variables → Actions → New repository secret** — 4 адад (қиматҳо дар `signing/GITHUB_SECRETS.txt`):
   `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
   Бе инҳо APK бо калиди санҷишӣ (debug) сохта мешавад ва **навсозии APK-и насбшуда кор намекунад**.

## 4. Гирифтани APK
* Пас аз `git push` дар **Actions → Build APK** кор оғоз мешавад (~8–15 дақиқа). Дар охир, поёни саҳифа → **Artifacts → PythonTaj-apk**.
* Барои нашри расмӣ (бо навсозии дохили барнома):
  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```
  Дар **Releases** файлҳои `PythonTaj.apk` ва `PythonTaj.apk.sha256` пайдо мешаванд.
* APK-ро ба телефон гузоред ва насб кунед («Насб аз манбаъҳои номаълум»-ро иҷозат диҳед).

## 5. Дарсҳои нав бе APK-и нав
`lessons/` -ро тағйир диҳед → `npm run manifest` (ё танҳо push кунед; workflow манифестро худаш нав мекунад) → `git push`.
Pages дарсҳоро нав мекунад; барнома дар оғоз ё бо «Санҷиши навсозиҳо» нишон медиҳад. Расми `LESSON_AUTHORING.md`.

## Агар чизе нашуд
* Actions сурх шуд → кори сурхро кушоед, қадами сурхро нусхабардорӣ кунед ва ба ман фиристед (`BUILD_APK.md`).
* Дар барнома «Аз нусхаи дарунбарнома» навишта шудааст → Pages ҳанӯз фаъол нест (қадами 3.1) ё интернет нест.
