# Air Talk

## Project info

**URL**: https://github.com/vijaykumar-1247/AirTalk.git

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Bun installed - [install Bun](https://bun.sh/)

Follow these steps:

```sh
# Step 1: Clone the repository using the project'sAct as an expert React and Capacitor developer. The generated Android app is looking great, but I have two critical issues to fix:
​1. Session Persistence (App Restart Issue): > When the user closes the app and reopens it, it resets to the Welcome/Intro screen and requires re-login. Please fix this by implementing robust state persistence using localStorage or @capacitor/preferences. Store the user's profile, session token, and a hasSeenIntro flag. Update the main Router or App.tsx logic to check this persisted state immediately on app load. If the user is already logged in, redirect them directly to the Home screen seamlessly without any UI glitch or flashing the welcome screen.
​2. Wi-Fi Direct Plugin Error & Unhandled Promise Rejection: > On the Settings > Device Diagnostics page, it shows 'WifiDirectTransport plugin not available on this build' and throws an 'Unhandled promise rejection' toast error when scanning. Since this is a Capacitor wrapper and not bare React Native, please fix this logic. Ensure the diagnostic checks and the Wi-Fi Direct live scan fail gracefully without throwing unhandled promise rejections. Add try/catch blocks. If there's a specific Capacitor community plugin needed for local network/P2P, stub it out cleanly so it doesn't crash the app.
​Please apply these logical fixes. Then, run the git commands to add all changes, commit with the message 'Fix session persistence and handle Wi-Fi Direct plugin errors', and push to the main branch to trigger the GitHub Actions buid."
 Git URL.
git clone https://github.com/vijaykumar-1247/AirTalk.git

# Step 2: Navigate to the project directory.
cd AirTalk

# Step 3: Install the necessary dependencies.
bun install

# Step 4: Start the development server with auto-reloading and an instant preview.
bun run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
