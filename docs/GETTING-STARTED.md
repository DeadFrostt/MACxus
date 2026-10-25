# Getting started / Primi passi

**[English](#english)** · **[Italiano](#italiano)**

---

## English

### Installing MACxus on a Mac, step by step (no experience needed)

Installing apps on a Mac is mostly drag-and-drop. MACxus needs a few extra tools, and we install them by **copying and pasting commands** into an app called **Terminal**. You don't need to understand the commands. Paste them, press **Return**, and wait.

The whole setup takes about 30–45 minutes, mostly waiting. You only do it once.

### Step 0: Check your Mac
Click the **Apple menu ()** (top-left corner of the screen) → **About This Mac**. Next to **Chip** it must say **Apple M1, M2, M3, M4 or M5**. On an Intel Mac, MACxus will not work.

### Step 1: Open Terminal
Press **Command (⌘) + Space**, type **Terminal**, press **Return**. A window with text opens. This is where you paste commands.

How to paste a command:
1. Select the command below and copy it (**⌘ + C**).
2. Click inside the Terminal window and paste (**⌘ + V**).
3. Press **Return**.
4. Wait until a new line with a `%` symbol appears. That means it finished.

If Terminal asks for your **Password**, type your Mac login password and press **Return**. **Nothing appears while you type, not even dots.** That's normal.

### Step 2: Install Rosetta 2 (lets Windows games run on Apple chips)
```
softwareupdate --install-rosetta --agree-to-license
```

### Step 3: Install Homebrew (a tool that installs other tools)
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
- It asks for your password, then says **"Press RETURN to continue"**. Press **Return**.
- It may install the "Command Line Tools". Let it, it can take 5–10 minutes.
- At the end it shows **"Next steps"**. Paste these two commands to finish:
```
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```
```
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Step 4: Install Git and protoc (needed to build part of MACxus)
```
brew install git protobuf
```

### Step 5: Install Rust (also needed to build MACxus)
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
When it asks you to choose, press **Return** (the default option). When it's done, **close Terminal completely** (**⌘ + Q**) so it picks up the new tools.

### Step 6: Install CrossOver
CrossOver provides the graphics layer that runs DirectX games on Macs. It is paid software with a free trial.
1. Download it from **https://www.codeweavers.com/crossover**.
2. Open the downloaded file. If you see a CrossOver app, drag it into the **Applications** folder.
3. Open CrossOver once from Applications and choose **Try Now** (trial) or enter your license. Then you can close it.

### Step 7: Install MACxus
1. Go to **https://github.com/fladnaG86/MACxus/releases** and download the latest **`MACxus-…-arm64.dmg`**.
2. Double-click the `.dmg` and drag **MACxus** into **Applications**.
3. MACxus is a beta and **not signed by Apple**, so macOS blocks it the first time. Open Terminal again and paste:
```
xattr -dr com.apple.quarantine /Applications/MACxus.app
```
Now open MACxus from Applications. (Alternative without Terminal: try to open it once, then go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.)

### Step 8: First-time setup inside MACxus
Open **Settings** in MACxus. (Prefer Italian? **Settings → Language → Interface language**.) Then:
1. **Xodus backend → "Build backend"**. Takes a few minutes; you'll see text scrolling. Wait until it says it's done.
2. **Nexus runtime → "Install Nexus runtime"**.
3. **Wine engine → "Install Highball engine"**. Recommended for newer games (Unreal Engine, DirectX 12).
4. **Sign in with Xodus**: log in with your Microsoft account (the one that owns the game or has PC Game Pass).
5. If macOS asks to access the **Keychain** (where passwords are stored), type your Mac password and click **Always Allow**. You may see this a few times.

### Step 9: Play
Go to the **Store** or **My Library**, install a game, and press **Play**.

**Low on disk space?** Settings → **"Game storage"** lets you install games on an external SSD. See [Games on an external SSD](../README.md#games-on-an-external-ssd).

### Updating MACxus later
Download the new `.dmg`, drag MACxus into Applications again (choose **Replace**), and run the `xattr` command from step 7 again. If the release notes say so, press **"Build backend"** again.

### Good to know
- Results depend on the game and on your chip. Games that **require ray tracing** need an **M3 or newer**. Games with **kernel anti-cheat** (for example Call of Duty) don't work.
- For games with **Easy Anti-Cheat**, the game's settings have **"Play offline without anti-cheat"**, for campaign / offline play only. **Don't play online in this mode.**
- Something not working? Enable **Settings → Game logging**, try again, and attach the file `~/Library/Application Support/MACxus/logs/<id>-latest.log` (review it first) to an issue: https://github.com/fladnaG86/MACxus/issues

---

## Italiano

### Installare MACxus sul Mac, passo per passo (nessuna esperienza richiesta)

Sul Mac le app si installano quasi sempre trascinandole. MACxus ha bisogno di qualche strumento in più, che installiamo **copiando e incollando comandi** in un'app chiamata **Terminale**. Non serve capire i comandi: incollali, premi **Invio** e aspetta.

Tutta la preparazione richiede circa 30–45 minuti, quasi tutti di attesa. Si fa una volta sola.

### Passo 0: controlla il Mac
Clicca sul **menu Apple ()** (in alto a sinistra) → **Informazioni su questo Mac**. Accanto a **Chip** deve esserci **Apple M1, M2, M3, M4 o M5**. Sui Mac Intel MACxus non funziona.

### Passo 1: apri il Terminale
Premi **Comando (⌘) + Spazio**, scrivi **Terminale**, premi **Invio**. Si apre una finestra con del testo: è lì che incolli i comandi.

Come incollare un comando:
1. Seleziona il comando qui sotto e copialo (**⌘ + C**).
2. Clicca nella finestra del Terminale e incollalo (**⌘ + V**).
3. Premi **Invio**.
4. Aspetta che compaia una nuova riga con il simbolo `%`: vuol dire che ha finito.

Se il Terminale chiede la **Password**, scrivi la password con cui accedi al Mac e premi **Invio**. **Mentre scrivi non compare nulla, nemmeno i puntini.** È normale.

### Passo 2: installa Rosetta 2 (fa girare i giochi Windows sui chip Apple)
```
softwareupdate --install-rosetta --agree-to-license
```

### Passo 3: installa Homebrew (uno strumento che installa altri strumenti)
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
- Chiede la password, poi scrive **"Press RETURN to continue"**: premi **Invio**.
- Potrebbe installare i "Command Line Tools". Lascialo fare, possono servire 5–10 minuti.
- Alla fine mostra **"Next steps"**. Incolla questi due comandi per completare:
```
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```
```
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Passo 4: installa Git e protoc (servono per compilare una parte di MACxus)
```
brew install git protobuf
```

### Passo 5: installa Rust (serve anche lui per compilare MACxus)
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
Quando chiede di scegliere, premi **Invio** (opzione predefinita). Alla fine **chiudi del tutto il Terminale** (**⌘ + Q**), così riconosce i nuovi strumenti.

### Passo 6: installa CrossOver
CrossOver fornisce lo strato grafico che fa girare i giochi DirectX sul Mac. È a pagamento, con una prova gratuita.
1. Scaricalo da **https://www.codeweavers.com/crossover**.
2. Apri il file scaricato. Se vedi l'app CrossOver, trascinala nella cartella **Applicazioni**.
3. Apri CrossOver una volta da Applicazioni e scegli **Try Now** (prova) o inserisci la licenza. Poi puoi chiuderlo.

### Passo 7: installa MACxus
1. Vai su **https://github.com/fladnaG86/MACxus/releases** e scarica l'ultimo **`MACxus-…-arm64.dmg`**.
2. Fai doppio clic sul `.dmg` e trascina **MACxus** in **Applicazioni**.
3. MACxus è una beta **non firmata da Apple**, quindi macOS la blocca la prima volta. Riapri il Terminale e incolla:
```
xattr -dr com.apple.quarantine /Applications/MACxus.app
```
Ora apri MACxus da Applicazioni. (In alternativa, senza Terminale: prova ad aprirla una volta, poi vai in **Impostazioni di Sistema → Privacy e sicurezza**, scorri in basso e clicca **Apri comunque**.)

### Passo 8: prima configurazione dentro MACxus
Apri **Settings** in MACxus e, per avere l'interfaccia in italiano, scegli **Language → Interface language → Italiano**. Poi cerca queste voci in **Impostazioni**:
1. **Backend Xodus → "Compila il backend"**. Ci vogliono alcuni minuti e vedrai scorrere del testo. Aspetta che dica che ha finito.
2. **Runtime Nexus → "Installa runtime Nexus"**.
3. **Motore Wine → "Installa motore Highball"**. Consigliato per i giochi recenti (Unreal Engine, DirectX 12).
4. **Accedi con Xodus**: accedi con il tuo account Microsoft (quello che possiede il gioco o ha PC Game Pass).
5. Se macOS chiede l'accesso al **Portachiavi** (dove sono salvate le password), scrivi la password del Mac e clicca **Consenti sempre**. Può succedere più volte.

### Passo 9: gioca
Vai nel **Negozio** o in **La mia libreria**, installa un gioco e premi **Gioca**.

**Poco spazio sul disco?** Impostazioni → **"Dove salvare i giochi"** permette di installare i giochi su un SSD esterno. Vedi [Giochi su SSD esterno](../README.md#giochi-su-ssd-esterno).

### Aggiornare MACxus in seguito
Scarica il nuovo `.dmg`, trascina di nuovo MACxus in Applicazioni (scegli **Sostituisci**) e ripeti il comando `xattr` del passo 7. Se le note della release lo indicano, premi di nuovo **"Compila il backend"**.

### Da sapere
- I risultati dipendono dal gioco e dal chip. I giochi che **richiedono il ray tracing** hanno bisogno di un **M3 o successivo**. I giochi con **anti-cheat a livello kernel** (per esempio Call of Duty) non funzionano.
- Per i giochi con **Easy Anti-Cheat**, nelle impostazioni del gioco c'è **"Gioca offline senza anti-cheat"**, solo per la campagna o il gioco offline. **Non giocare online in questa modalità.**
- Qualcosa non va? Attiva **Impostazioni → Registrazione dei giochi**, riprova e allega il file `~/Library/Application Support/MACxus/logs/<id>-latest.log` (controllalo prima) a una segnalazione: https://github.com/fladnaG86/MACxus/issues
