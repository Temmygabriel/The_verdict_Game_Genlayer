# 🎭 The Verdict — GenLayer Party Game

> Two players. One absurd statement. The AI is judge. May the best argument win.

Built on **GenLayer** — where AI consensus lives on-chain.

---

## 🚀 Deploy in 3 Steps

### Step 1 — Deploy the Contract

1. Go to [GenLayer Studio](https://studio.genlayer.com)
2. Create a new contract and paste the contents of `verdict_contract.py`
3. Click **Deploy**
4. Copy the contract address (looks like `0xABC...`)

### Step 2 — Add Your Contract Address

Open `app/page.tsx` and find line **~9**:

```ts
const CONTRACT_ADDRESS = "PASTE_YOUR_CONTRACT_ADDRESS_HERE";
```

Replace with your actual address:

```ts
const CONTRACT_ADDRESS = "0xYourActualAddressHere";
```

Save the file.

### Step 3 — Deploy to Vercel

1. Push this folder to a new GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Leave all settings as default — Vercel auto-detects Next.js
5. Click **Deploy** ✅

---

## 🎮 How to Play

| Step | What Happens |
|------|--------------|
| Player 1 clicks **Create Game** | AI generates a wild absurd topic on-chain |
| Player 1 shares the **Game ID** | Player 2 enters it on the Join screen |
| Both players submit arguments | Argue FOR or AGAINST the statement |
| **AI Judge decides** | Most creative & chaotic argument wins the round |
| First to **3 rounds** wins | Full match history with all verdicts shown |

---

## 🛠 Local Development (optional)

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

---

## 📁 File Structure

```
the-verdict/
├── app/
│   ├── layout.tsx       ← Page title & metadata
│   └── page.tsx         ← ⭐ MAIN GAME FILE (edit CONTRACT_ADDRESS here)
├── verdict_contract.py  ← GenLayer intelligent contract
├── package.json
├── next.config.js
├── tsconfig.json
└── README.md
```

---

Built for the GenLayer Playverse Challenge 🏆
