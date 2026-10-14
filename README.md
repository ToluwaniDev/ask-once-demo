# Ask once: demo app

A working demo of the Ask once smart bedside call bell. Patients tap what they need on a bedside screen, and the request goes straight to the right person's phone, the corridor screen and the ward dashboard, live.

> Demo only, with dummy data. It is not a medical device and must not be used with real patients.

## What you are building

One Node.js service does everything, so there is only one thing to host.

| Screen | Address | Runs on |
| --- | --- | --- |
| Launcher | `/` | Any device, links to everything else |
| Bedside screen | `/bedside.html?bed=12` | Tablet by the bed |
| Staff phone | `/staff.html?role=hcsw&name=Amara` | Phone |
| Corridor screen | `/corridor.html` | Laptop or TV |
| Ward dashboard | `/dashboard.html` | Laptop |

How it fits together:

- **Express** serves the pages and a small REST API (`/api/...`).
- **Socket.IO** pushes every change to every open screen instantly.
- **TypeScript** on the server, plain HTML, CSS and JavaScript in the browser, so there is no front-end build step.
- Data lives **in memory**. That keeps the demo simple and free; it resets when the server restarts.

```
ask-once/
  src/
    server.ts      Express routes, Socket.IO, error handling
    store.ts       Requests, bed settings, escalation timers, sample data
    config.ts      Which button goes to which role, escalation times
    types.ts       Shared TypeScript types
  public/
    index.html, bedside.html, staff.html, corridor.html, dashboard.html
    css/app.css    All styling
    js/common.js   Icons, API helper, live connection
    js/bedside.js, staff.js, corridor.js, dashboard.js
  package.json, tsconfig.json, render.yaml, .node-version, .gitignore
```

---

## Part 1: Install the tools (once)

All commands below are for **PowerShell on Windows**.

1. **Node.js 22 LTS** from nodejs.org. Accept the defaults.
2. **Git for Windows** from git-scm.com.
3. **VS Code** from code.visualstudio.com.
4. Free accounts on **GitHub** and **Render** (sign up to Render with your GitHub account; it makes step 6 easier).

Check they work. Open a new PowerShell window:

```powershell
node -v
npm -v
git --version
```

You should see version numbers. Node should start with `v22` (v20 or later works).

If `npm` says *running scripts is disabled on this system*, run this once and try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## Part 2: Create the project from scratch

### 2.1 Make the folders

```powershell
cd $HOME\Documents
mkdir ask-once
cd ask-once
mkdir src, public, public\js, public\css
```

### 2.2 Set up npm and install packages

```powershell
npm init -y
npm install express socket.io
npm install -D typescript tsx @types/express @types/node
```

`express` serves pages and the API, `socket.io` makes it live, `typescript` compiles the server, and `tsx` runs TypeScript directly while you develop.

### 2.3 Open it in VS Code

```powershell
code .
```

### 2.4 Create each file

Create every file listed in the tree above with the exact contents from this project (copy them from the zip). Work in this order so you can test as you go:

1. `package.json`: replace the generated one. The important part is the `scripts` block (`dev`, `build`, `start`).
2. `tsconfig.json`, `.gitignore`, `.node-version`, `render.yaml`.
3. `src/types.ts`, `src/config.ts`, `src/store.ts`, `src/server.ts`.
4. `public/css/app.css`, then `public/js/common.js`.
5. The five HTML pages and their scripts.

What each server file does:

- **types.ts** describes a request: its bed, need, role, status (`open`, `accepted`, `arrived`, `done`, `cancelled`) and level (1, 2 or 3).
- **config.ts** maps each button to a role. Toilet, Drink, Comfort and Help to move go to HCSWs; Pain and Talk to me go to nurses; Water jug and Spill go to housekeeping and catering. A ward could change these.
- **store.ts** holds the logic: creating requests, accepting, "I'm here", done, cancel. It also runs escalation. An unaccepted request moves from level 1 to level 2 (urgent, whole team), then level 3 (nurse in charge). Falls-risk patients asking for the toilet or help to move start at level 2.
- **server.ts** exposes that logic as an API and broadcasts every change over Socket.IO.

### 2.5 Run it

```powershell
npm run dev
```

You should see `Ask once demo running on http://localhost:3000`. Open that address in your browser.

---

## Part 3: Try the full flow on your computer

Open four browser windows side by side:

1. `http://localhost:3000/bedside.html?bed=12`
2. `http://localhost:3000/staff.html?role=hcsw&name=Amara`, then press **Start shift**
3. `http://localhost:3000/corridor.html`
4. `http://localhost:3000/dashboard.html`

Then:

1. On the bedside screen, tap **Toilet**. The staff window beeps, the corridor screen shows Bed 12 with a timer, and the dashboard counts it.
2. On the staff window, tap **Accept**. The bedside screen changes to *Amara is coming*.
3. Tap **I'm at the bedside**, then **Done**. The bedside screen says thank you and resets.
4. Tap **Drink** and leave it. After 45 seconds it turns urgent; after another 45 seconds it escalates. Open `staff.html?role=nic&name=Grace` to see the nurse in charge receive it.
5. On the bedside screen, open **Bed setup (staff)**, tick **Falls risk**, and tap Toilet again. It goes out as urgent straight away.
6. On the dashboard, press **Load a sample day** to fill the charts for your presentation.

To test on your phone at home, both devices must be on the same Wi-Fi. Find your computer's address with `ipconfig` (the IPv4 address, for example `192.168.1.20`) and open `http://192.168.1.20:3000` on the phone. Windows may ask to allow Node through the firewall; allow it on private networks.

---

## Part 4: Put the code on GitHub

1. On github.com, create a new repository called `ask-once-demo`. Leave it empty (no README).
2. In PowerShell, inside the project folder:

```powershell
git init
git add .
git commit -m "Ask once demo"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ask-once-demo.git
git push -u origin main
```

`.gitignore` keeps `node_modules` and `dist` out of GitHub; Render rebuilds them.

---

## Part 5: Host it on Render

### Option A: Blueprint (uses `render.yaml`, fewest clicks)

1. In the Render dashboard choose **New**, then **Blueprint**.
2. Connect your GitHub account and pick `ask-once-demo`.
3. Render reads `render.yaml` and shows one web service on the free plan. Approve it.

### Option B: Set it up by hand

1. **New**, then **Web Service**, then pick the repository.
2. Fill in:
   - Runtime: **Node**
   - Build command: `npm install --include=dev && npm run build`
   - Start command: `npm start`
   - Instance type: **Free**
3. Under **Environment**, add `NODE_VERSION` = `22`. Optionally add `ESCALATE_1_SECONDS` and `ESCALATE_2_SECONDS` to change escalation timing.
4. Set the health check path to `/api/health`.
5. Press **Create Web Service**.

The first build takes a few minutes. When the log says *Your service is live*, Render shows an address like `https://ask-once-demo.onrender.com`. Open it on any phone, tablet or laptop, anywhere.

Every time you `git push`, Render redeploys automatically.

---

## Part 6: Demo-day checklist

- **Wake it up early.** Free Render services go to sleep after about 15 minutes without visitors, and the first visit afterwards can take up to a minute. Open the site 5 minutes before you present and leave the corridor screen running so it stays awake.
- **Devices:** a tablet for the bedside, your phone as the HCSW, a second phone as the nurse in charge, and a laptop on the corridor screen or dashboard.
- **Press Start shift** on each staff phone so they can beep. Turn the phone volume up and take it off silent.
- **Reset** from the dashboard before you start, then **Load a sample day** so the dashboard isn't empty.
- **Hospital Wi-Fi** may block some sites. Test on it beforehand, or use your phone's mobile data as a hotspot.
- **Tell the story in 60 seconds:** a patient needs the toilet, taps once, the right person's phone buzzes, she accepts, the patient is told she's coming, and the data lands on the dashboard.
- If you redeploy or Render restarts, all demo data clears. That is expected.

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `npm` says scripts are disabled | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `Port 3000 is already in use` | Close the other terminal running the app, or run `$env:PORT=3001; npm run dev` |
| Staff phone doesn't beep | Press **Start shift** first; browsers only allow sound after a tap. iPhones don't support vibration from websites |
| Read aloud is silent | Turn it on in Bed setup, and check the tablet isn't muted |
| Yellow *Reconnecting* banner | The server is waking up or restarting. Wait; the page reloads its data when it reconnects |
| Render build fails on `tsc` | Make sure the build command includes `--include=dev` |
| Changes don't appear on Render | Check you committed and pushed, then watch the deploy log |

---

## Taking it further after the competition

- **Save data:** swap the in-memory store for MongoDB Atlas, using collections for wards, beds, staff, requests and request events, as in the build guide.
- **Rooms:** send Socket.IO events only to the relevant ward and role instead of broadcasting.
- **Sign-in:** replace the demo name box with Trust accounts.
- **Governance before any real use:** a DCB0129/DCB0160 clinical safety case, a DPIA and DTAC, with the Trust's Clinical Safety Officer involved from the start.
