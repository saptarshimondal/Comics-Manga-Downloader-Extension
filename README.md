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
    A cross browser extension to download comics / manga as pdf file from any site!
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
      <a href="#how-to-use">How To Use</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
      	<li><a href="#installation">Installation</a>
      		<ul>
      			<li><a href="#google-chrome">Google Chrome</a></li>
      			<li><a href="#firefox">Firefox</a></li>
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

A simple cross browser extension to download comics / manga as pdf file from any site.

**Although this extension was created to download comics / manga, it will also work on any website which has `<img>` or `<canvas>` attribute.**

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- HOW TO USE -->
## How to use
* Visit any website
* Let all the images load completely
* Click on the extension icon to open the extension popup
* Select the images you want to include in your output pdf
* Set a file name and click on "Download" button
* It will open the default browser print popup
* Select "Destination" - "Save as pdf"
* Click on "More setting" 
* Set "Margins" to - "None"
* Finally click on "Save" button to save the pdf file.

<p align="right">(<a href="#top">back to top</a>)</p>


<!-- GETTING STARTED -->
## Getting Started

### Installation

* Visit [releases](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/releases) page
* Download the binary file from the latest release.
[![Download Release Screen Shot][release-screenshot]](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension/releases)
* Unzip the downloaded file

#### Google Chrome

* Open Google chrome and visit - `chrome://extensions` page
* Turn on "Developer mode"
* Click on "Load Unpacked" and select the unzipped folder. 

[![Installation Chrome Screen Shot][installation-chrome-screenshot]](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension)

* To pin the extension on tool bar click on extensions icon and then click on pin icon next to the extension
[![Pin Chrome Screen Shot][pin-chrome-screenshot]](https://github.com/saptarshimondal/Comics-Manga-Downloader-Extension)


#### Firefox

* Open Firefox and visit - `about:debugging#/runtime/this-firefox` page
* Click on "Load Temporary Add-on..." button
* Select **"manifest.json"** file inside of the unzipped folder.

_Please note that firefox will remove the extension if you restart the browser_


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

3. To start developing run -
   ```sh
   npm run dev
   ```
   It will bundle the project under **"dist"** directory and watch for any code modification.

   If you don't want to start the watcher, then run - 
   ```sh
   npm run start
   ```
   It will just bundle the project under **"dist"** directory without running the watcher.

4. If you want to run the project on chrome, then you have to visit `chrome://extensions` page and reload the extension manually to update the latest code changes.

5. If you want to run the project on firefox, then you can run -
	```sh
	npm run ext
	``` 
	It will open firefox browser automatically with the extension pre installed and watch for any code changes. If you change anything in code then the extension will be reloaded automatically.

6. If you want to pack the extension, then you can run -
	```sh
	npm run pack-ext
	```
	It will create a **.zip** file under **"web-ext-artifacts"** directory. You can use this to distribute your extension.



<p align="right">(<a href="#top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

- [x] Filtering images by url
- [x] Add select all checkbox
- [x] Add "Direct download" feature
- [ ] Migrate to Manifest v3

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
