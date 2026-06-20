# Talk Board — Build Plan

*A communication app for nonspeaking children, with community-recorded dialect voices.*

This is our map. We build in order, top to bottom. Each phase produces something that works before we move on, so you always have a real app in your hands — never a half-finished mess.

---

## What we're building (in one paragraph)

A free app that helps nonspeaking children communicate with pictures and words. Tapping a picture speaks the word out loud. Words come in two languages (English + Arabic) and can be spoken in **any dialect**, because real people record the words in their own dialect and those recordings are stored online and shared with everyone. Free for all users. Money comes later, from ads, only once the app is large.

---

## The three big pieces of any app like this

Every app of this kind has three parts. It helps to picture them:

1. **The front end** — what people see and tap. This is the app itself, on the phone or in the browser. (We already have a strong start here.)
2. **The back end** — the server and database that live online. This holds the accounts, the picture list, and all the dialect recordings. It is the "brain" that every copy of the app talks to.
3. **Storage** — where the actual audio files and pictures physically live online.

Our whole plan is about building parts 2 and 3, and connecting them to the part 1 we already have.

---

## Guiding decisions (these shape everything)

- **Free for users, forever for the core features.** No paywall on communication. A child must never be blocked from talking.
- **Money comes from ads, and only later.** We design so ads can be switched on someday, but we do not build them now. Chasing money too early would slow us down and isn't needed yet.
- **The valuable thing is the recordings database, and it lives on our server.** The app on the phone is just a window. This is also our anti-theft answer: copying the app gives you an empty shell, because the voices and accounts stay on our protected server.
- **We build it ourselves, step by step.** Every phase is sized so we can do it together and you understand what we made.

---

## Phase 0 — Foundations (set up our workshop)

Before building, we set up the tools. One-time setup.

- Create a **GitHub account** and put our app code there. This saves every version safely and lets us undo mistakes.
- Set up a **free hosting account** so the website is live on the internet (Netlify or Vercel — both free to start).
- Pick our **backend service: Supabase.** It gives us accounts, a database, and audio storage in one place, has a generous free tier, and grows with us. (Firebase is the main alternative; we go with Supabase because the database is more standard and easier to move away from later if we ever need to.)

**End of Phase 0:** our app is live at a real web address, and we have an empty backend ready to fill.

---

## Phase 1 — Polish the app we already have

Make the current single-file app solid before connecting it to the internet.

- Organize the picture categories and finalize the starter word list.
- Make sure recording-your-own-voice works smoothly on real phones and tablets.
- Add a simple **"first / then" visual schedule** to help a child prepare for what's next.
- Confirm it works fully **offline** for the core board.

**End of Phase 1:** a genuinely useful free app, even before the online parts exist.

---

## Phase 2 — Accounts and the online database

Now we give the app a brain online.

- Turn on **Supabase accounts** so people can sign in (needed for contributors who record dialects, and later for saving settings across devices). Children/users do **not** need an account to use the board — only contributors do.
- Create the **database tables**:
  - *words* — the master list (English label, Arabic label, category, picture).
  - *recordings* — each contributed voice clip: which word, which dialect, who recorded it, and whether it's approved.
  - *dialects* — the list of dialects people can record in (Sudanese, Juba Arabic, and any we add).
- Move the **master word list** out of the app file and into this database, so we can add words anytime without updating the app.

**End of Phase 2:** the app loads its words from our server, and people can make contributor accounts.

---

## Phase 3 — Community dialect recording (the heart of your vision)

This is the feature that makes your app special.

- Build a **"Contribute a voice" screen**: a signed-in contributor picks a word and a dialect, records it, and uploads it.
- Store the audio in **Supabase storage**, permanently, online — shared with everyone.
- Build a simple **review step**: you (or trusted helpers) approve each recording before it goes live. *This is essential for a children's app — it stops wrong or inappropriate audio from reaching kids.*
- In the main app, let a user **choose a dialect**, and the app plays the approved community recordings for that dialect. Falls back to the computer voice for any word not yet recorded.

**End of Phase 3:** your core idea is real — dialects with no computer voice (Sudanese, Juba Arabic) now have real human voices, contributed by the community, stored forever online.

---

## Phase 4 — The 600 pictures

Bring in your real picture set.

- Upload your 600 pictures to storage and connect each to its word.
- Build a small **admin screen** for you to add, rename, or recategorize words and pictures without touching code.

**End of Phase 4:** the app uses your real pictures, and you can manage content yourself.

---

## Phase 5 — Turn the website into installable apps

Same app, now in the app stores.

- Wrap the web app with **Capacitor** so it becomes a real iPhone and Android app from the same code.
- Register the **developer accounts** (Apple ~$99/year, Google ~$25 one-time).
- Add **forced update** support: on launch the app asks our server "is this version still allowed?" and can require an update. (Standard, reliable, and genuinely useful for pushing fixes.)

**End of Phase 5:** Talk Board is downloadable from the App Store and Google Play.

---

## Phase 6 — Scale, and someday, ads

Only once you have real numbers of users.

- Watch costs as recordings grow; Supabase's paid tiers handle scale when the free tier is outgrown.
- When the user base is large, add **ads** (e.g. Google AdMob) in a way that never blocks a child from communicating — ads belong on menus and contributor screens, never on the talking board itself.
- Consider moving recordings to cheaper bulk storage if the audio library gets very large.

**End of Phase 6:** a free, self-sustaining, scalable product.

---

## Honest notes on the things you asked about

**"Lock it so it can't be stolen."** No app can be made truly uncopyable — anything on a phone can be extracted by a determined person. The real protection is the plan above: the **recordings and accounts live on our server**, so a stolen copy of the app is an empty shell. That gives you real control without chasing an impossible goal.

**"Force them to update."** Yes — this is the forced-update feature in Phase 5. The app checks our server on launch and can require the newest version.

**"Subscription in the future."** We're choosing **ads instead of subscriptions** based on your goal (free for users). The groundwork — accounts and a server that controls what's unlocked — is the same either way, so if you ever change your mind, we can add subscriptions without rebuilding.

---

## Rough cost picture (so there are no surprises)

While small and growing, this can run **nearly free**:

- Website hosting: free tier.
- Supabase (database + storage + accounts): free tier to start; paid only when you grow.
- Google Play developer account: ~$25 once.
- Apple developer account: ~$99/year (only when you want an iPhone app in the store).

Real bills arrive only with real scale — storage for thousands of recordings, and Supabase's paid tier. By then, you have the users that justify it, and ads to offset it.

---

## What I need from you to start Phase 0 → 1

1. Whether you want to start with **website-first** (my recommendation) and add app stores at Phase 5.
2. How your **600 pictures** are stored (image files in a folder? on a computer or phone?), so we can plan Phase 4.
3. Your go-ahead, and we begin setting up the workshop.

We'll move one phase at a time. You'll always have a working app, and you'll understand every piece we build.
