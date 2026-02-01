<div id="top"></div>
<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->



<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Comics / Manga Downloader Extension</h3>

  <p align="center">
    A cross browser extension to download comics / manga as CBZ, PDF, or ZIP from any site!
    <br />
    <a href="#how-to-use"><strong>How to use »</strong></a>
    <br />
    <br />
    <!-- <a href="https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension">View Demo</a> -->
    <!-- · -->
    <a href="https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/issues">Report Bug</a>
    ·
    <a href="https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li>
      <a href="#features">Features</a>
    </li>
    <li>
      <a href="#how-to-use">How To Use</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
      	<li><a href="#installation">Installation</a>
      		<ul>
      			<li><a href="#firefox">Firefox</a></li>
      			<li><a href="#google-chrome">Google Chrome</a></li>
      		</ul>
      	</li>
        <li><a href="#development-setup">Development Setup</a>
        	<ul>
      			<li><a href="#prerequisites">Prerequisites</a></li>
      			<li><a href="#setting-up">Setting up</a></li>
      		</ul>
        </li>
      </ul>
    </li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

[![Comics / Manga Downloader Screen Shot][product-screenshot]](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension) 

A simple cross browser extension to download comics / manga as CBZ, PDF, or ZIP from any site.

**Although this extension was created to download comics / manga, it will also work on any website which has `<img>` or `<canvas>` attribute.**

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- FEATURES -->
## Features

- **Download format**
  - **Download as** options are ordered: **CBZ** → **PDF** → **ZIP**.
  - Default is **CBZ** on first run. Your chosen format is remembered (saved in browser storage) and restored the next time you open the popup.

- **Auto-detect pages**
  - An **Auto-detect pages (recommended)** toggle lets the extension automatically detect and select page images.
  - Default is **ON**; the toggle state is saved and restored.
  - **When ON:** The extension runs auto-detect and preselects likely pages.
  - **When OFF:** No auto-scan runs; all images are selected by default.
  - A **Rescan** button always runs auto-detect and updates the selection, regardless of the toggle state.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- HOW TO USE -->
## How to use
- Visit any website.
- Wait for all images to finish loading.
- Click the extension icon to open the extension popup.
- **Auto-detect (optional):** Use **Auto-detect pages** to have the extension preselect page images, or turn it off to select all images. Use **Rescan** to run auto-detect again at any time.
- Select or adjust the images you want to include in the output.
- You can filter images by image dimensions or by image URL.
- Enter a file name, choose **Download as** (**CBZ** by default; **PDF** or **ZIP**; your choice is remembered), choose a download method, and click **Download**.
  - **CBZ** (default): Direct download; images are packaged in page order (e.g. 001.jpg, 002.png).
  - **PDF**: Direct download or Built-in browser (print to PDF).
  - **ZIP**: Direct download only; images are packaged in page order.

### Download methods

**Direct Download**
- The file (CBZ, PDF, or ZIP) will be downloaded automatically.

**Built-in Browser**
- The browser’s print dialog will open.
- Set **Destination** to **Save as PDF**.
- Click **More settings**.
- Set **Margins** to **None**.
- Click **Save** to download the PDF.


<p align="right">(<a href="#top">back to top</a>)</p>


<!-- GETTING STARTED -->
## Getting Started

### Installation

#### Firefox

* Go to the [Releases](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/releases) page on GitHub.
* Open the latest release and download the **.xpi** asset.
* Install the extension in Firefox using one of:
  * **Option 1:** Open the downloaded **.xpi** file with Firefox (double-click or drag it into a Firefox window).
  * **Option 2:** In Firefox, open the Add-ons Manager (`about:addons`), click the gear icon, choose **Install Add-on From File…**, and select the **.xpi** file.

**Alternative: Install from the Release ZIP (Temporary Add-on)**

This method is for testing or development. The add-on is **temporary**—Firefox removes it when you restart the browser.

* Go to the [Releases](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/releases) page, open the latest release, and download the release **.zip** asset for firefox.
* Open Firefox and go to `about:debugging#/runtime/this-firefox`.
* Click **Load Temporary Add-on…**.
* Select the **.zip** file.

The **.xpi** is signed (from AMO approval) so it should install normally. To update, install the newest **.xpi** from the latest GitHub Release.

#### Google Chrome

* Visit the [releases](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/releases) page.
* Download the binary file from the latest release.
[![Download Release Screen Shot][release-screenshot]](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/releases)
* Unzip the downloaded file.
* Open Google Chrome and visit the `chrome://extensions` page.
* Turn on **Developer mode**.
* Click **Load unpacked** and select the unzipped folder.

[![Installation Chrome Screen Shot][installation-chrome-screenshot]](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension)

* To pin the extension on the toolbar, click the extensions icon and then click the pin icon next to the extension.
[![Pin Chrome Screen Shot][pin-chrome-screenshot]](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension)


### Development Setup

Please read the following to setup the project locally for development.

#### Prerequisites

* [Install node](https://nodejs.org/en/download/)
* Install Webpack
	```sh
	npm install -g webpack
	```

#### Setting up

1. Clone the repo
   ```sh
   git clone https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension.git
   ```

2. Install NPM packages
   ```sh
   npm install
   ```

3. **Build Commands** (one-time builds):
   
   For Firefox:
   ```sh
   npm run start:firefox
   ```
   
   For Chrome:
   ```sh
   npm run start:chrome
   ```
   
   These commands will bundle the project under **"dist"** directory without running the watcher.

4. **Development Commands** (watch mode - auto-rebuild on file changes):
   
   For Firefox:
   ```sh
   npm run dev:firefox
   ```
   
   For Chrome:
   ```sh
   npm run dev:chrome
   ```
   
   These commands will bundle the project under **"dist"** directory and watch for any code modification, automatically rebuilding when files change.

5. **Testing the Extension**:
   
   For Chrome:
   - Visit `chrome://extensions` page
   - Turn on "Developer mode"
   - Click "Load unpacked" and select the **"dist"** directory
   - Reload the extension manually to update after code changes
   
   For Firefox:
   ```sh
   npm run ext
   ```
   This will open Firefox browser automatically with the extension pre-installed and watch for any code changes. If you change anything in code, the extension will be reloaded automatically.

6. **Packaging the Extension** (for distribution):
   
   For Firefox only:
   ```sh
   npm run pack:firefox
   ```
   Creates a **.zip** file under **"web-ext-artifacts/firefox"** directory.
   
   For Chrome only:
   ```sh
   npm run pack:chrome
   ```
   Creates a **.zip** file at **"web-ext-artifacts/chrome/chrome-extension.zip"**.
   
   For both Firefox and Chrome:
   ```sh
   npm run pack:all
   ```
   Creates packaged extensions for both browsers in their respective directories. You can use these to distribute your extension.

7. **Production Build** (minified, optimized for release):
   
   Build with production mode (enables minification and optimizations). Use the `--prod` flag by passing it after `--`:
   
   For Firefox only:
   ```sh
   npm run pack:firefox -- --prod
   ```
   
   For Chrome only:
   ```sh
   npm run pack:chrome -- --prod
   ```
   
   For both Firefox and Chrome:
   ```sh
   npm run pack:all -- --prod
   ```
   Creates production-ready packaged extensions in the same output locations as the regular pack commands. Use these when preparing a release.



<p align="right">(<a href="#top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

- [x] Filtering images by url
- [x] Add select all checkbox
- [x] Add "Direct download" feature
- [x] Migrate to Manifest v3

See the [open issues](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Saptarshi Mondal - [@Saptarshi_77](https://twitter.com/Saptarshi_77) - mondalsaptarshi7@gmail.com

Project Link: [https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension)

Follow me on GitHub - [saptarshimondal](https://github.com/saptarshimondal)

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Chrome Extension Webpack Boilerplate](https://github.com/samuelsimoes/chrome-extension-webpack-boilerplate)
* [Web extensions webpack boilerplate](https://github.com/fstanis/webextensions-webpack-boilerplate)
* [Readme template](https://github.com/othneildrew/Best-README-Template)

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/saptarshimondal/Comics-Manga-Downloader-Extension?style=for-the-badge
[contributors-url]: https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/saptarshimondal/Comics-Manga-Downloader-Extension?style=for-the-badge
[forks-url]: https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/network/members
[stars-shield]: https://img.shields.io/github/stars/saptarshimondal/Comics-Manga-Downloader-Extension?style=for-the-badge
[stars-url]: https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/stargazers
[issues-shield]: https://img.shields.io/github/issues/saptarshimondal/Comics-Manga-Downloader-Extension?style=for-the-badge
[issues-url]: https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/issues
[license-shield]: https://img.shields.io/github/license/saptarshimondal/Comics-Manga-Downloader-Extension?style=for-the-badge
[license-url]: https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/saptarshi-mondal-732986126
[product-screenshot]: images/screenshot.jpg
[release-screenshot]: images/release.png
[installation-chrome-screenshot]: images/installation-chrome.gif
[pin-chrome-screenshot]: images/pin-chrome.gif
