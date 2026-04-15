# Portfolio App

A desktop Electron app for building a developer portfolio through a clean admin panel.  
Users can add themes, projects, descriptions, links, images, and a profile photo, then export everything into a fully static website.

[Русский](README.md) | [English](README.en.md)

[⬇ Download portable version](https://github.com/OWNER/REPO/releases/latest/download/YOUR_RELEASE_ASSET.exe)

---

## About the project

Portfolio App is a local app for quickly creating a portfolio without manual layout work.  
Everything is managed inside the application: you create themes, add projects, upload covers, write descriptions, and export a ready-made website for publishing.

This project is useful for:
- personal portfolios;
- student projects;
- work showcases;
- quickly building a website without a CMS.

---

## Features

- clean admin panel;
- create, rename, and delete themes;
- create, edit, and delete projects;
- upload project covers;
- add developer photo and bio;
- local data storage;
- export to a static website;
- search within the current theme;
- Windows portable build.

---

## Screenshots

Admin app with the ability to edit topics and projects

![Admin-app](assets/screenshoots/app.png)

The final exported site without the admin menu

![Website](assets/screenshoots/website.png)
---

## Tech stack

* Electron
* Node.js
* HTML
* CSS
* JavaScript

---

## How to run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

```bash
npm start
```

---

## How to build the portable version

### 1. Install dependencies

```bash
npm install
```

### 2. Build the portable exe

```bash
npm run dist
```

After the build, the portable file will appear in the `dist` folder.

---

## How export works

The app saves data locally and can export a ready-made website into a separate folder.

The export includes:

* `index.html`
* `styles.css`
* `script.js`
* `data.json`
* project images
* developer photo

The exported site can be opened in a browser or uploaded to hosting right away.

---

## Where data is stored

Local app data, photos, and covers are stored in the application's user directory.
This keeps projects safe after restarting the app.

---

## Project structure

```text
portfolio-app/
├── src/
│   ├── main.js
│   ├── preload.js
│   ├── renderer.js
│   ├── index.html
│   └── styles.css
├── build/
├── data/
├── covers/
├── export/
├── README.md
├── README.en.md
├── LICENSE
├── .gitignore
├── package.json
└── package-lock.json
```

---

## License

This project is distributed under the license specified in the `LICENSE` file.

Commercial use is not allowed.
For commercial licensing, please contact the author.

---

## Contact

* GitHub: `@ig_mizyovv`
* Email: `ig.mizyov@gmail.com`

```


