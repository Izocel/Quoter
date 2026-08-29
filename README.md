# Quoter: A Beginner's Guide

Quoter is a website that shows market prices and charts. This guide helps you open your own copy on your computer, see it running in a browser, and use GitHub Copilot to make small changes.

You do not need to be a programmer. Follow the steps in order and change one thing at a time.

## Before You Start

You need:

- A GitHub account that can access this project.
- An internet connection.
- About 15 minutes for the first setup.

You will install two free programs:

- **VS Code**: the program where you will open and change this project.
- **Node.js**: the program that lets your computer run this website.

## Step 1: Install VS Code

1. Go to [code.visualstudio.com](https://code.visualstudio.com/).
2. Select the download button for Windows.
3. Open the downloaded installer and accept the suggested options.
4. Open **Visual Studio Code** after it installs.

## Step 2: Install Node.js

1. Go to [nodejs.org](https://nodejs.org/).
2. Download the version marked **LTS**. LTS means the stable, recommended version.
3. Open the downloaded installer and keep the default choices.
4. When installation finishes, close VS Code completely and open it again.

## Step 3: Sign In and Turn On Copilot

1. In VS Code, select the small **Accounts** icon in the lower-left corner.
2. Select **Sign in with GitHub** and complete the sign-in in your browser.
3. Back in VS Code, select the Extensions icon in the left-hand bar. It looks like four small squares.
4. Search for **GitHub Copilot**.
5. Install the extension published by **GitHub** if it is not already installed.
6. Open Copilot Chat by selecting the Copilot icon near the top of VS Code, or press `Ctrl+Alt+I`.

Copilot is a chat assistant inside VS Code. You can ask it to explain the project, make a change, or help when an error appears. You still choose which changes to keep.

## Step 4: Download This Project

Downloading a project from GitHub is called “cloning.” VS Code can do this for you.

1. Open the project's page on GitHub.
2. Select the green **Code** button and copy the HTTPS address.
3. Return to VS Code and press `Ctrl+Shift+P`.
4. Type `Git: Clone` and select **Git: Clone** from the list.
5. Paste the address you copied, then press Enter.
6. Choose a folder where you would like to keep the project, such as Documents.
7. When VS Code asks whether to open the downloaded project, select **Open**.
8. If you see a trust message, choose **Yes, I trust the authors** only when this is the project you expected to download.

The file list on the left side of VS Code is now your own copy of the project.

## Step 5: Start the Website

1. In the VS Code menu, select **Terminal**, then **New Terminal**.
2. A panel opens at the bottom of the window. This is where you give the computer short instructions.
3. Copy and paste the first command below, then press Enter. Wait until it finishes.

```bash
npm install
```

4. Copy and paste the next command, then press Enter.

```bash
npm run dev
```

5. Look for an address similar to `http://localhost:5173/` in the terminal.
6. Hold `Ctrl` and select the address, or copy it into your web browser.

You should see Quoter in your browser. Leave the terminal open while you are using the website. When you save a change in VS Code, the browser normally updates by itself.

To stop the website later, select the terminal and press `Ctrl+C`.

## Step 6: Use Copilot to Explore

Start by asking questions. In Copilot Chat, paste one of these messages:

```text
@workspace Explain this project as if I have never programmed before.
```

```text
@workspace Which file changes the page I see in my browser? Explain what that file does, but do not edit anything.
```

```text
@workspace Suggest one small and visible change I could make to this website. Explain it before changing any files.
```

`@workspace` tells Copilot to look at the files in this project before answering.

When you feel ready, try a small change:

```text
@workspace Change the main page heading to “My Quoter Test”. Tell me which file you will edit, then make the change.
```

Read Copilot's proposed change before accepting it. Save the changed file and look at the browser. You should see the result right away.

## A Safe Way to Experiment

Use this routine each time:

1. Ask Copilot to explain what it plans to change.
2. Make one small change.
3. Save the file and check the browser.
4. Keep it, change it again, or undo it.

To undo the last change, press `Ctrl+Z`. To see all changed files, select the Source Control icon on the left side of VS Code. It looks like a branching line.

Good questions for Copilot include:

- `Explain this in simpler words.`
- `Show me where the color of this part of the page is chosen.`
- `Make this text larger, and tell me how to undo it.`
- `The page looks wrong. Look at the error and suggest the smallest fix.`
- `Do not change files yet. Give me three safe ideas to try.`

## When Something Goes Wrong

- If `npm` is not recognized, Node.js is probably not installed correctly. Install the LTS version again, then close and reopen VS Code.
- If the website does not open, make sure `npm run dev` is still running in the terminal and copy the address it shows.
- If a Copilot change breaks the page, press `Ctrl+Z`, save the file, and ask Copilot to explain what happened.
- Do not share passwords, API keys, or other private information in Copilot Chat or in project files.

## Useful Commands

These are optional commands you may use later in the VS Code terminal:

```bash
# Check the project for common code problems
npm run lint

# Prepare a version of the website for publishing
npm run build

# View the publishing version on your computer
npm run preview
```

The best way to learn this project is to make a small change, see the result, and ask Copilot about anything that does not make sense.
