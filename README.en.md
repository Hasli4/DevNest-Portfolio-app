# DevNest Portfolio

A desktop Electron app for building a developer portfolio through a clean admin panel.  
Users can add themes, projects, descriptions, links, images, and a profile photo, switch the interface language, and export everything into a fully static website.

[Русский](README.md) | [English](README.en.md)

[⬇ Download portable version](https://github.com/Hasli4/DevNest-Portfolio-app/releases)
|
[Website with description and installation instructions](https://hasli4.github.io/DevNest/index.html)
---

## About the project

Portfolio App is a local app for quickly creating a portfolio without manual layout work.  
Everything is managed inside the application: you create themes, add projects, upload covers, write descriptions, switch the interface language, and export a ready-made website for publishing.

This project is useful for:
- personal portfolios;
- student projects;
- work showcases;
- quickly building a website without a CMS.

---

## Features

- clean admin panel;
- Russian and English interface switch;
- create, rename, and delete themes;
- create, edit, and delete projects;
- upload project covers;
- add developer photo and bio;
- bilingual fields for themes, project cards, and the developer profile;
- local data storage;
- export to a static website in the selected language;
- export a bilingual static website with a language switch;
- search within the current theme;
- exported website stays compatible with standard static hosting, including GitHub Pages;
- Windows portable build.

---

## Localization and bilingual mode

- A `RU / EN` switch is available in the top-right corner of the main app area and changes the language of the entire interface.
- The selected language is stored in the local application data and reused on the next launch.
- If `Two-language support` is disabled, the exported website is generated in a single language: the one selected in the app at export time.
- If `Two-language support` is enabled, the forms show additional fields for Russian and English text:
  - theme name;
  - developer name and bio;
  - project title;
  - project description;
  - additional project information.
- In bilingual mode, the exported website gets its own built-in language switch and still remains fully static.
- Content translation is manual on purpose: this keeps the site autonomous, avoids external APIs, and preserves compatibility with GitHub Pages.

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

Export respects the current language settings:

- if bilingual mode is disabled, the site is exported in one selected language only;
- if bilingual mode is enabled, the site includes a `RU / EN` switch and both text variants that were filled in.

The exported site stays fully static: it can be opened locally in a browser or uploaded to standard hosting right away.

---

## Where data is stored

Local app data, photos, covers, and language settings are stored in the application's user directory.
This keeps projects safe after restarting the app.

---

## Project structure

```text
portfolio-app/
├── src/
│   ├── main.js
│   ├── i18n.js
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


